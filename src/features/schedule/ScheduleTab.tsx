import React, { useEffect, useState, useMemo } from 'react';
// FIX: The firestore imports are for v9. Switching to v8 style.
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Trip, ScheduleItem, FlightDetails, AppTab, ThemeColor, LogEntry } from '../../types';
import { Card, Button } from '../../components/ui/Layout';
import { Plus, Plane, RefreshCw, AlertTriangle, Sparkles, Settings, Lock, LogIn, LogOut, Calendar, MapPin, Bed, ArrowRight } from 'lucide-react';

// Imported Sub-Components
import { TypeIcon, AvatarPile, AvatarFilter, ParticipantTags, getTicketTheme } from './ScheduleShared';
import { ScheduleEditModal } from './ScheduleEditModal';
import { ScheduleViewModal } from './ScheduleViewModal';
import { TripSettingsModal } from './TripSettingsModal';

interface ScheduleTabProps {
  trip: Trip;
  onTabChange?: (tab: AppTab, subTab?: string) => void;
}

// --- HELPERS ---

function getDaysArray(start: string, end: string) {
    const arr = [];
    if (!start || !end) return [];
    const [sY, sM, sD] = start.split('-').map(Number);
    const [eY, eM, eD] = end.split('-').map(Number);
    
    let dt = new Date(sY, sM - 1, sD);
    const endDate = new Date(eY, eM - 1, eD);
    if (dt > endDate) return [start]; 

    const MAX_DAYS = 365; 
    let count = 0;

    while (dt <= endDate && count < MAX_DAYS) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        arr.push(`${y}-${m}-${d}`);
        dt.setDate(dt.getDate() + 1);
        count++;
    }
    return arr;
}

function formatDateShort(dateStr: string) {
    if(!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type DisplayItem = ScheduleItem & { 
    renderMode: 'flight_dep' | 'flight_arr' | 'hotel_in' | 'hotel_out' | 'standard';
    sortTime: string;
};

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ trip, onTabChange }) => {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  
  // MODAL STATES
  const [isAdding, setIsAdding] = useState(false);
  const [viewingItemId, setViewingItemId] = useState<string | null>(null); 
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  
  // LOADING / ERROR
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [refreshingItems, setRefreshingItems] = useState<Set<string>>(new Set());

  // SETTINGS
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  // FILTER
  const [selectedPassenger, setSelectedPassenger] = useState<string | 'all'>(user?.email || 'all');

  // VIEW STATE
  const allDates = useMemo(() => {
    const range = getDaysArray(trip.startDate, trip.endDate);
    const extraDates = new Set<string>();
    items.forEach(i => {
        if(i.date) extraDates.add(i.date);
        if(i.endDate) extraDates.add(i.endDate);
        if(i.type === 'flight' && i.flightDetails?.arrivalDate) extraDates.add(i.flightDetails.arrivalDate);
    });
    const unique = Array.from(new Set([...range, ...Array.from(extraDates)]));
    unique.sort();
    return unique.length > 0 ? unique : [trip.startDate];
  }, [trip.startDate, trip.endDate, items]);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
      const today = new Date().toISOString().split('T')[0];
      if (allDates.includes(today)) return today;
      return allDates[0] || trip.startDate;
  });

  // --- DATA FETCHING ---
  useEffect(() => {
    setLoading(true);
    setErrorState(null);

    const q = db.collection(`trips/${trip.id}/schedule`)
      .orderBy('date')
      .orderBy('time');

    const unsubscribe = q.onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduleItem[];
      setItems(data);
      setLoading(false);
      setErrorState(null);
    }, (error: any) => {
        console.error("Schedule snapshot error:", error);
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            setErrorState({
                code: 'missing-index',
                message: "Database index missing. Please check browser console."
            });
        } else if (error.code === 'permission-denied') {
            setErrorState({
                code: 'permission-denied',
                message: "Permission denied."
            });
        } else {
            setErrorState({
                code: 'error',
                message: "Failed to load schedule."
            });
        }
        setItems([]);
        setLoading(false);
    });
    return () => unsubscribe();
  }, [trip.id, retryTrigger]);

  // --- AUTO ASSIGN COLORS ---
  useEffect(() => {
      if (items.length === 0) return;
      
      const itemsMissingColor = items.filter(i => !i.themeColor);
      
      if (itemsMissingColor.length > 0) {
          const colors: ThemeColor[] = ['blue', 'green', 'orange'];
          
          itemsMissingColor.forEach(item => {
              const randomColor = colors[Math.floor(Math.random() * colors.length)];
              db.collection(`trips/${trip.id}/schedule`).doc(item.id).update({
                  themeColor: randomColor
              }).catch(err => console.warn("Failed to auto-assign color", err));
          });
      }
  }, [items, trip.id]);

  // Auto-refresh flight status
  useEffect(() => {
    if(loading || items.length === 0) return;
    items.forEach(item => {
        if(item.type === 'flight' && item.flightDetails?.flightNumber && !item.flightDetails.status) {
            refreshFlightStatus(item, true);
        }
    });
  }, [items]);

  const refreshFlightStatus = async (item: ScheduleItem, silent = false) => {
    if (!item.flightDetails?.flightNumber || refreshingItems.has(item.id)) return;
    if(!silent) setRefreshingItems(prev => new Set(prev).add(item.id));

    await new Promise(r => setTimeout(r, 800));
    const newStatus = 'Unavailable';

    try {
      await db.collection(`trips/${trip.id}/schedule`).doc(item.id).update({
          'flightDetails.status': newStatus,
          'flightDetails.lastUpdated': new Date().toISOString()
      });
    } catch (err) { console.error("Failed to update status", err); } 
    finally {
        if(!silent) setRefreshingItems(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setErrorState(null);
    setRetryTrigger(prev => prev + 1);
  };

  // --- LOGGING HELPER ---
  const logActivity = async (action: 'create' | 'update' | 'delete', title: string, details: string) => {
      try {
          await db.collection(`trips/${trip.id}/logs`).add({
              tripId: trip.id,
              timestamp: new Date().toISOString(),
              category: 'plan',
              action,
              title,
              details,
              userUid: user?.uid || 'unknown',
              userName: user?.displayName || user?.email?.split('@')[0] || 'Member'
          });
      } catch (err) {
          console.error("Failed to log activity", err);
      }
  };

  // --- ACTIONS ---

  const handleSaveSettings = async (start: string, end: string) => {
      try {
          await db.collection('trips').doc(trip.id).update({
              startDate: start,
              endDate: end
          });
          logActivity('update', 'Trip Dates', `Start Date updated to ${start}\nEnd Date updated to ${end}`);
      } catch (err) {
          console.error(err);
          alert("Failed to update trip dates.");
      }
  };

  const handleSaveItem = async (newItem: Partial<ScheduleItem>, flightData: FlightDetails) => {
    try {
      const payload: any = { ...newItem };

      if (newItem.type === 'flight') {
        payload.flightDetails = {
            ...flightData,
            arrivalDate: flightData.arrivalDate || newItem.date
        };
        if (!payload.title) payload.title = `Flight to ${flightData.destination}`;
        delete payload.endDate; 
      } else {
        if (!payload.endDate) payload.endDate = payload.date;
      }

      if (editingItem) {
        await db.collection(`trips/${trip.id}/schedule`).doc(editingItem.id).update(payload);
        
        // Calculate diff for log
        const changes: string[] = [];
        
        // Helper to check and push changes
        const checkChange = (field: keyof ScheduleItem, label: string) => {
            if (editingItem[field] !== payload[field]) {
                changes.push(`${label} updated from "${editingItem[field]}" to "${payload[field]}"`);
            }
        };

        checkChange('time', 'Time');
        checkChange('date', 'Date');
        checkChange('title', 'Title');
        checkChange('endDate', 'End Date');
        checkChange('endTime', 'End Time');

        // Participants diff
        const oldP = editingItem.participants || [];
        const newP = payload.participants || [];
        if (oldP.length !== newP.length || !oldP.every(p => newP.includes(p))) {
            const added = newP.filter((p: string) => !oldP.includes(p));
            const removed = oldP.filter((p: string) => !newP.includes(p));
            if (added.length > 0) changes.push(`Added participants: ${added.join(', ')}`);
            if (removed.length > 0) changes.push(`Removed participants: ${removed.join(', ')}`);
        }
        
        if (editingItem.type === 'flight' && payload.flightDetails) {
             const oldF = editingItem.flightDetails || {} as FlightDetails;
             const newF = payload.flightDetails;
             if (oldF.flightNumber !== newF.flightNumber) changes.push(`Flight # updated from "${oldF.flightNumber}" to "${newF.flightNumber}"`);
             if (oldF.origin !== newF.origin) changes.push(`Origin updated from "${oldF.origin}" to "${newF.origin}"`);
             if (oldF.destination !== newF.destination) changes.push(`Destination updated from "${oldF.destination}" to "${newF.destination}"`);
        }

        const logMsg = changes.length > 0 ? changes.join('\n') : 'Updated details';
        logActivity('update', payload.title, logMsg);

      } else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection(`trips/${trip.id}/schedule`).add(payload);
        
        const detailLines = [];
        detailLines.push(`Date: ${payload.date}`);
        detailLines.push(`Time: ${payload.time}`);
        if(payload.type === 'flight' && payload.flightDetails) {
            detailLines.push(`Flight: ${payload.flightDetails.flightNumber} (${payload.flightDetails.origin} -> ${payload.flightDetails.destination})`);
        }
        
        logActivity('create', payload.title, detailLines.join('\n'));
      }
      
      setIsAdding(false);
      setEditingItem(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save');
    }
  };

  const handleDeleteItem = async (id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    if (confirm("Are you sure you want to delete this plan?")) {
        try {
            await db.collection(`trips/${trip.id}/schedule`).doc(id).delete();
            if (itemToDelete) {
                const detailLines = [];
                detailLines.push(`Original Date: ${itemToDelete.date}`);
                detailLines.push(`Original Time: ${itemToDelete.time}`);
                if (itemToDelete.type === 'flight' && itemToDelete.flightDetails) {
                     detailLines.push(`Flight: ${itemToDelete.flightDetails.flightNumber}`);
                }
                logActivity('delete', itemToDelete.title, detailLines.join('\n'));
            }
            setIsAdding(false);
            setEditingItem(null);
            setViewingItemId(null);
        } catch (err) {
            console.error("Failed to delete", err);
            alert("Could not delete item");
        }
    }
  };

  const handleItemClick = (item: ScheduleItem) => {
      if (item.type === 'transport' && onTabChange) {
          onTabChange(AppTab.Bookings, 'transport');
          return;
      }
      if ((item.type === 'flight' || item.type === 'hotel') && onTabChange) {
          onTabChange(AppTab.Bookings, item.type);
          return;
      }
      setViewingItemId(item.id);
  };

  const handleEditFromView = (item: ScheduleItem) => {
      setEditingItem(item);
      setIsAdding(true);
  };
  
  const viewingItem = useMemo(() => items.find(i => i.id === viewingItemId) || null, [items, viewingItemId]);

  const daysItems = useMemo(() => {
    const filtered = items.filter(item => {
        if (selectedPassenger === 'all') return true;
        if (item.participants && item.participants.length > 0) {
            return item.participants.includes(selectedPassenger);
        }
        return true;
    });

    const displayItems: DisplayItem[] = [];

    filtered.forEach(item => {
        if (item.type === 'flight') {
            if (item.date === selectedDate) displayItems.push({ ...item, renderMode: 'flight_dep', sortTime: item.time });
            if (item.flightDetails?.arrivalDate === selectedDate && item.date !== selectedDate) displayItems.push({ ...item, renderMode: 'flight_arr', sortTime: item.flightDetails.arrivalTime || '00:00' });
            return;
        }
        if (item.type === 'hotel') {
            if (item.date === selectedDate) displayItems.push({ ...item, renderMode: 'hotel_in', sortTime: item.time });
            if (item.endDate === selectedDate && item.endDate !== item.date) {
                 displayItems.push({ ...item, renderMode: 'hotel_out', sortTime: item.endTime || '11:00' });
            }
            return;
        }
        if (item.date === selectedDate) displayItems.push({ ...item, renderMode: 'standard', sortTime: item.time });
    });

    return displayItems.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  }, [items, selectedDate, selectedPassenger]);


  // --- ERROR VIEWS ---
  if (errorState?.code === 'missing-index') {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={24} /></div>
        <h3 className="font-bold text-ink mb-2">Setup Required</h3>
        <p className="text-gray-500 text-sm mb-4 max-w-xs">Please check your browser console and click the Firebase link.</p>
        <Button onClick={handleRetry} className="py-2 h-auto text-sm"><RefreshCw size={16} /> Retry</Button>
      </div>
    );
  }
  if (errorState?.code === 'permission-denied') {
      return (
          <div className="flex flex-col items-center justify-center py-20 px-6 opacity-50">
             <div className="text-4xl mb-4 text-center"><Lock size={48} /></div>
             <h3 className="font-bold text-lg mb-2 text-center">Schedule Restricted</h3>
             <p className="text-center text-sm max-w-[200px] mb-6">This schedule is currently private or restricted by security rules.</p>
             <Button variant="secondary" onClick={logout} className="py-2 text-xs">Logout</Button>
          </div>
      );
  }

  return (
    <div className="pb-24">
      {/* --- STICKY HEADER --- */}
      <div className="sticky top-[calc(5.1rem+env(safe-area-inset-top))] z-40 -mx-4 -mt-6 mb-6 bg-paper/95 backdrop-blur-md border-b border-gray-200 shadow-sm transition-all duration-300">
        {/* --- DATE SCROLLER --- */}
        <div className="flex items-center">
             <div className="flex-1 overflow-x-auto flex gap-3 px-4 pb-4 pt-4 no-scrollbar snap-x">
                {allDates.map(date => {
                    const d = new Date(date + 'T00:00:00');
                    const isSelected = date === selectedDate;
                    const hasPlans = items.some(i => i.date === date || i.endDate === date || (i.type === 'flight' && i.flightDetails?.arrivalDate === date));

                    return (
                    <button 
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`snap-start flex-shrink-0 flex flex-col items-center justify-center w-[72px] h-[84px] rounded-3xl border-2 transition-all duration-300 ${
                        isSelected 
                            ? 'bg-brand border-brand text-white shadow-md scale-105 rotate-1' 
                            : 'bg-white border-gray-300 text-gray-400 hover:border-brand/50 hover:scale-105'
                        }`}
                    >
                        <span className="text-xs font-bold uppercase tracking-wide">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className={`text-2xl font-black font-rounded ${isSelected ? 'text-white' : 'text-ink'}`}>{d.getDate()}</span>
                        {hasPlans && (<div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-brand'}`}></div>)}
                    </button>
                    );
                })}
            </div>
            <div className="pr-4 pl-2">
                <button 
                    onClick={() => setIsEditingSettings(true)}
                    className="w-12 h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-gray-400 hover:text-brand hover:border-brand transition-colors shadow-sm"
                >
                    <Settings size={20} />
                </button>
            </div>
        </div>

        {/* --- PARTICIPANT FILTER --- */}
        <div className="px-4 pb-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 min-w-max px-1">
                <button 
                    onClick={() => setSelectedPassenger('all')}
                    className={`px-4 py-1.5 rounded-full border-2 text-xs font-bold transition-all ${selectedPassenger === 'all' ? 'bg-ink text-white border-ink' : 'bg-white text-gray-400 border-gray-200'}`}
                >
                    ALL
                </button>
                {trip.allowedEmails.map(email => (
                    <AvatarFilter 
                        key={email} 
                        email={email} 
                        active={selectedPassenger === email} 
                        onClick={() => setSelectedPassenger(email)} 
                    />
                ))}
            </div>
        </div>
      </div>

      {loading && <div className="text-center text-gray-400 mt-10 flex flex-col items-center gap-2"><RefreshCw className="animate-spin" size={20} /> Checking schedule...</div>}
      
      {/* --- DAY VIEW CONTENT --- */}
      {!loading && (
        <div className="animate-in fade-in duration-500">
           <div className="flex items-center gap-2 mb-6 px-2">
             <div className="h-[2px] bg-brand/10 flex-1 rounded-full"></div>
             <h3 className="font-bold text-gray-400 text-[10px] uppercase tracking-widest font-rounded px-2">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
             </h3>
             <div className="h-[2px] bg-brand/10 flex-1 rounded-full"></div>
           </div>

           {daysItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-gray-300 rounded-3xl bg-white/50 mx-2">
               <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm">
                 <Sparkles size={32} />
               </div>
               <h3 className="font-bold text-ink text-lg font-rounded">Free Day!</h3>
               <p className="text-gray-400 text-sm mb-6 max-w-[200px]">No plans yet for {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long'})} for {selectedPassenger === 'all' ? 'everyone' : selectedPassenger.split('@')[0]}.</p>
               <Button onClick={() => { setEditingItem(null); setIsAdding(true); }} variant="secondary" className="!py-2 !px-4 text-sm">
                 <Plus size={16} /> Add Activity
               </Button>
             </div>
           ) : (
             <div className="flex flex-col gap-6 relative pb-20">
                {daysItems.map((item, index) => {
                  const uniqueKey = `${item.id}_${item.renderMode}`;
                  const isLast = index === daysItems.length - 1;
                  
                  // --- FLIGHT CARD (BOARDING PASS) ---
                  if (item.renderMode === 'flight_dep' || item.renderMode === 'flight_arr') {
                    const statusText = item.flightDetails?.status || 'Scheduled';
                    let statusColorClass = 'text-gray-500';
                    let statusDotClass = 'bg-gray-400';
                    let statusBgClass = 'bg-gray-50';
                    
                    if (statusText === 'Unavailable') {
                        statusColorClass = 'text-yellow-600'; statusDotClass = 'bg-yellow-500'; statusBgClass = 'bg-yellow-50';
                    } else if (statusText.toLowerCase().includes('delayed')) {
                        statusColorClass = 'text-orange-600'; statusDotClass = 'bg-orange-500'; statusBgClass = 'bg-orange-50';
                    } else if (statusText === 'On Time') {
                        statusColorClass = 'text-green-600'; statusDotClass = 'bg-green-500'; statusBgClass = 'bg-green-50';
                    }
                    
                    const theme = getTicketTheme(item.themeColor);

                    if (item.renderMode === 'flight_dep') {
                        return (
                          <div key={uniqueKey} className="relative z-10 flex gap-3 group cursor-pointer pl-0.5" onClick={() => handleItemClick(item)}>
                             {!isLast && (<div className="absolute left-[19px] top-8 bottom-0 w-[2px] bg-gray-300 z-0 rounded-full"></div>)}
                             
                             <div className="flex flex-col items-center pt-1 w-10">
                                <div className={`w-10 h-10 rounded-full bg-white border-2 ${theme.border} flex items-center justify-center z-10 shadow-sm group-hover:scale-110 transition-transform`}>
                                   <Plane className={theme.icon} size={18} />
                                </div>
                                <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-500 font-mono">{item.time}</div>
                             </div>

                             <div className="flex-1">
                                {/* REDESIGN: Boxy Boarding Pass (Small Radius, Gray Border, Soft Shadow) */}
                                <div className={`bg-white rounded-md shadow-soft border-2 border-gray-200 overflow-hidden transition-all group-hover:shadow-soft-hover group-hover:-translate-y-1`}>
                                    {/* Header */}
                                    <div className="p-4 bg-white border-b border-gray-100 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Plane size={16} className="text-gray-400" />
                                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.text}`}>Boarding Pass</span>
                                        </div>
                                        {item.flightDetails?.bookingReference && (
                                            <span className="text-[10px] font-sans font-medium text-gray-300">Ref: {item.flightDetails.bookingReference}</span>
                                        )}
                                    </div>

                                    {/* Main Content */}
                                    <div className="p-5">
                                        {/* Soft UI Flight Number Box */}
                                        <div className="flex justify-center mb-6">
                                            <div className="px-8 py-4 rounded-2xl bg-white shadow-[4px_4px_10px_#e5e7eb,-4px_-4px_10px_#ffffff] border border-gray-50 flex flex-col items-center min-w-[160px]">
                                                <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Flight Number</div>
                                                <div className="text-4xl font-black text-ink tracking-tight font-sans">{item.flightDetails?.flightNumber || 'TBD'}</div>
                                            </div>
                                        </div>

                                        {/* Route Row */}
                                        <div className="flex justify-between items-center mb-6 relative">
                                            <div className="text-left w-1/3">
                                                <div className="text-4xl font-black text-ink font-sans leading-none">{item.flightDetails?.origin || 'ORG'}</div>
                                                <div className="text-[10px] uppercase font-bold text-gray-400 mt-2 tracking-wider">Departs</div>
                                                <div className="text-lg font-black text-ink mt-0.5 font-sans">{item.time}</div>
                                            </div>
                                            
                                            <div className="flex-1 flex flex-col items-center px-2 relative -top-2">
                                                {/* Arrow Line */}
                                                <div className="w-full h-[2px] bg-gray-200 relative">
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-1">
                                                        <ArrowRight size={16} className="text-gray-300" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right w-1/3">
                                                <div className="text-4xl font-black text-ink font-sans leading-none">{item.flightDetails?.destination || 'DST'}</div>
                                                <div className="text-[10px] uppercase font-bold text-gray-400 mt-2 tracking-wider">Arrives</div>
                                                <div className="text-lg font-black text-ink mt-0.5 font-sans">{item.flightDetails?.arrivalTime || '--:--'}</div>
                                            </div>
                                        </div>

                                        {/* Passengers & Status */}
                                        <div className="flex justify-between items-end border-t border-gray-100 pt-4">
                                            <div>
                                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Passengers</div>
                                                <ParticipantTags emails={item.participants || []} className="justify-start gap-1" />
                                            </div>
                                            
                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusBgClass}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`}></div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wide ${statusColorClass}`}>{statusText}</span>
                                                <button onClick={(e) => { e.stopPropagation(); refreshFlightStatus(item); }} className="ml-1 text-gray-400 hover:text-brand"><RefreshCw size={10} /></button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Visual Detail: Perforated Edge */}
                                    <div className="h-3 bg-gray-50 flex gap-1.5 px-2 border-t border-gray-100 overflow-hidden">
                                        {[...Array(20)].map((_, i) => (
                                            <div key={i} className="w-3 h-3 rounded-full bg-white border border-gray-100 -mt-2"></div>
                                        ))}
                                    </div>
                                </div>
                             </div>
                          </div>
                        );
                    } else {
                         // Arrival mode (simpler card, matching boxy style)
                         return (
                            <div key={uniqueKey} className="relative z-10 flex gap-3 group cursor-pointer pl-0.5" onClick={() => handleItemClick(item)}>
                                {!isLast && (<div className="absolute left-[19px] top-8 bottom-0 w-[2px] bg-gray-300 z-0 rounded-full"></div>)}
                                <div className="flex flex-col items-center pt-1 w-10">
                                    <div className="w-10 h-10 rounded-full bg-white border-2 border-brand/30 flex items-center justify-center z-10 shadow-sm opacity-50">
                                        <Plane className="text-brand rotate-90" size={16} />
                                    </div>
                                    <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-400 font-mono">{item.flightDetails?.arrivalTime}</div>
                                </div>
                                <div className="flex-1">
                                    <div className="bg-white rounded-md shadow-soft border-2 border-dashed border-gray-200 overflow-hidden opacity-70 group-hover:opacity-100 transition-opacity">
                                        <div className="p-3 bg-gray-50 flex items-center justify-between border-b border-gray-100">
                                            <div className="flex items-center gap-2 text-gray-400 font-bold"><Plane size={14} className="rotate-90" /><span className="text-[10px] uppercase tracking-widest font-black">Arrival</span></div>
                                            <div className="text-[10px] font-mono font-bold text-gray-400">{item.flightDetails?.flightNumber}</div>
                                        </div>
                                        <div className="p-4 flex justify-between items-center">
                                            <div>
                                                <div className="text-2xl font-black text-gray-500 font-sans">{item.flightDetails?.destination}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">Arrives {item.flightDetails?.arrivalTime}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">From</div>
                                                <div className="text-lg font-black text-gray-500 font-sans">{item.flightDetails?.origin}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }
                  }

                  // --- HOTEL CARD (REMAINS UNCHANGED) ---
                  if (item.renderMode === 'hotel_in' || item.renderMode === 'hotel_out') {
                      const isCheckOut = item.renderMode === 'hotel_out';
                      const label = isCheckOut ? 'Check Out' : 'Check In';
                      const time = isCheckOut ? (item.endTime || '11:00') : item.time;
                      return (
                        <div key={uniqueKey} className="relative z-10 flex gap-3 group cursor-pointer" onClick={() => handleItemClick(item)}>
                            {!isLast && (<div className="absolute left-[19px] top-8 bottom-0 w-[2px] bg-gray-300 z-0 rounded-full"></div>)}
                            <div className="flex flex-col items-center pt-1">
                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 shadow-sm transition-transform group-hover:scale-110 ${isCheckOut ? 'bg-white border-red-200 text-red-500' : 'bg-white border-purple-200 text-purple-500'}`}>
                                    {isCheckOut ? <LogOut size={16} className="ml-0.5" /> : <LogIn size={16} className="mr-0.5" />}
                                </div>
                                <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-500 font-mono">{time}</div>
                            </div>
                            <div className="flex-1">
                                <Card className={`!p-4 flex flex-col gap-2 relative overflow-hidden group-hover:-translate-y-1 transition-transform border-2 ${isCheckOut ? 'border-red-100 bg-red-50/30' : 'border-purple-100 bg-purple-50/30'}`}>
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isCheckOut ? 'text-red-400' : 'text-purple-400'}`}>{label}</div>
                                            <h4 className="font-bold text-ink text-lg leading-tight font-rounded">{item.title}</h4>
                                            <div className="mt-2">
                                                 <ParticipantTags emails={item.participants || []} className="justify-start" />
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                            <div className={`p-2 rounded-full ${isCheckOut ? 'bg-red-100 text-red-500' : 'bg-purple-100 text-purple-500'}`}><Bed size={16} /></div>
                                        </div>
                                    </div>
                                    {item.locationLink && (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                                            <MapPin size={10} /> View Map
                                        </div>
                                    )}
                                    {item.notes && (
                                        <div className="bg-white rounded-2xl p-3 border border-dashed border-gray-300 shadow-sm mt-2">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Notes</div>
                                            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{item.notes}</p>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                      );
                  }

                  // --- STANDARD NOTEBOOK STRIP (REMAINS UNCHANGED) ---
                  return (
                    <div key={uniqueKey} className="relative z-10 flex gap-3 group cursor-pointer" onClick={() => handleItemClick(item)}>
                       {!isLast && (<div className="absolute left-[19px] top-8 bottom-0 w-[2px] bg-gray-300 z-0 rounded-full"></div>)}
                       <div className="flex flex-col items-center pt-1">
                          <div className="w-10 h-10 rounded-full bg-white border-2 border-brand flex items-center justify-center z-10 shadow-sm group-hover:scale-110 transition-transform">
                             <TypeIcon type={item.type} />
                          </div>
                          <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-500 font-mono flex flex-col items-center leading-none py-1 gap-0.5 min-w-[32px]">
                             <span>{item.time}</span>
                             {item.endTime && (<><span className="text-gray-300">↓</span><span>{item.endTime}</span></>)}
                          </div>
                       </div>
                       <div className="flex-1">
                          <Card className="!p-4 flex flex-col gap-2 relative overflow-hidden group-hover:-translate-y-1 transition-transform group-hover:border-brand">
                             <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <h4 className="font-bold text-ink text-lg leading-tight font-rounded">{item.title}</h4>
                                    {item.endDate && item.endDate !== item.date && (
                                        <div className="text-[10px] font-bold text-purple-500 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-full self-start mt-1">
                                            <Calendar size={10} /> Ends {formatDateShort(item.endDate)}
                                        </div>
                                    )}
                                    <div className="mt-2">
                                        <ParticipantTags emails={item.participants || []} className="justify-start" />
                                    </div>
                                </div>
                             </div>
                             
                             {item.locationLink && (
                                 <div className="text-xs text-blue-500 flex items-center gap-1 font-bold">
                                     <MapPin size={12} /> Map Link
                                 </div>
                             )}
                             {item.notes && (
                                <div className="bg-white rounded-2xl p-3 border border-dashed border-gray-300 shadow-sm mt-2">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Notes</div>
                                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{item.notes}</p>
                                </div>
                             )}
                          </Card>
                       </div>
                    </div>
                  );
                })}
             </div>
           )}
        </div>
      )}

      {/* --- MODALS --- */}
      
      <ScheduleViewModal 
        item={viewingItem} 
        onClose={() => setViewingItemId(null)}
        onEdit={handleEditFromView}
      />

      {isAdding && (
          <ScheduleEditModal 
            trip={trip}
            itemToEdit={editingItem}
            selectedDate={selectedDate}
            onSave={handleSaveItem}
            onDelete={handleDeleteItem}
            onClose={() => { setIsAdding(false); setEditingItem(null); }}
          />
      )}

      {isEditingSettings && (
          <TripSettingsModal 
            trip={trip} 
            onSave={handleSaveSettings}
            onClose={() => setIsEditingSettings(false)}
          />
      )}

      {/* Floating Add Button */}
      <button
        onClick={() => { setEditingItem(null); setIsAdding(true); }}
        className="fixed bottom-24 right-4 w-14 h-14 bg-brand text-white rounded-full shadow-soft hover:shadow-soft-hover hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-40"
      >
        <Plus size={28} />
      </button>

    </div>
  );
};