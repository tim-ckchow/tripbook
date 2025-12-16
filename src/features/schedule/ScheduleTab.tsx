import React, { useEffect, useState, useMemo } from 'react';
// FIX: The firestore imports are for v9. Switching to v8 style.
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Trip, ScheduleItem, ScheduleType, FlightDetails, AppTab } from '../../types';
import { Card, Button, Input } from '../../components/ui/Layout';
import { MapPin, Coffee, Bed, Bus, Plus, X, Plane, Users, AlertTriangle, RefreshCw, Calendar, Sparkles, Settings, Trash2, ArrowRight, Lock, LogIn, LogOut } from 'lucide-react';

interface ScheduleTabProps {
  trip: Trip;
  onTabChange?: (tab: AppTab) => void;
}

const TypeIcon: React.FC<{ type: ScheduleType }> = ({ type }) => {
  switch (type) {
    case 'sightseeing': return <MapPin className="text-blue-500" size={18} />;
    case 'food': return <Coffee className="text-orange-500" size={18} />;
    case 'hotel': return <Bed className="text-purple-500" size={18} />;
    case 'transport': return <Bus className="text-green-500" size={18} />;
    case 'flight': return <Plane className="text-brand" size={18} />;
  }
};

// Updated AvatarPile to support sizes
const AvatarPile: React.FC<{ emails: string[], size?: 'sm' | 'md' }> = ({ emails, size = 'sm' }) => {
  if (!emails || emails.length === 0) return null;
  
  const dims = size === 'md' ? 'w-9 h-9 text-[10px]' : 'w-6 h-6 text-[8px]';

  return (
    <div className="flex -space-x-2">
      {emails.slice(0, 4).map((email, i) => (
        <div key={email} className={`${dims} rounded-full bg-paper border-2 border-white flex items-center justify-center font-bold text-gray-600 uppercase shadow-sm`} title={email}>
          {email[0]}
        </div>
      ))}
      {emails.length > 4 && (
        <div className={`${dims} rounded-full bg-gray-100 border-2 border-white flex items-center justify-center font-bold text-gray-500 shadow-sm`}>
          +{emails.length - 4}
        </div>
      )}
    </div>
  );
};

const AvatarFilter: React.FC<{ 
    email: string; 
    active: boolean; 
    onClick: () => void 
}> = ({ email, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all flex-shrink-0 ${active ? 'bg-ink text-white border-ink' : 'bg-white text-gray-400 border-gray-200'}`}
    >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-white text-ink' : 'bg-gray-100 text-gray-500'}`}>
            {email[0].toUpperCase()}
        </div>
        <span className="text-xs font-bold">{email.split('@')[0]}</span>
    </button>
);

// --- HELPERS ---

// Helper to generate all dates between start and end (inclusive)
function getDaysArray(start: string, end: string) {
    const arr = [];
    if (!start || !end) return [];

    // Parse YYYY-MM-DD manually to avoid timezone shifts
    const [sY, sM, sD] = start.split('-').map(Number);
    const [eY, eM, eD] = end.split('-').map(Number);
    
    let dt = new Date(sY, sM - 1, sD);
    const endDate = new Date(eY, eM - 1, eD);

    // Safety check for infinite loops
    if (dt > endDate) return [start]; 

    const MAX_DAYS = 365; // Sanity limit
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

// Extends ScheduleItem to include render context
type DisplayItem = ScheduleItem & { 
    renderMode: 'flight_dep' | 'flight_arr' | 'hotel_in' | 'hotel_out' | 'standard';
    sortTime: string;
};

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ trip, onTabChange }) => {
  const { logout } = useAuth();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // Track which item is being edited
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [refreshingItems, setRefreshingItems] = useState<Set<string>>(new Set());

  // Settings / Edit Dates State
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editDateRange, setEditDateRange] = useState({ start: trip.startDate, end: trip.endDate });
  const [savingSettings, setSavingSettings] = useState(false);

  // Filter State
  const [selectedPassenger, setSelectedPassenger] = useState<string | 'all'>('all');

  // VIEW STATE
  const allDates = useMemo(() => {
    const range = getDaysArray(trip.startDate, trip.endDate);
    
    // Also include any dates that existing items have (including flight arrivals or hotel checkouts)
    const extraDates = new Set<string>();
    items.forEach(i => {
        if(i.date) extraDates.add(i.date);
        if(i.endDate) extraDates.add(i.endDate);
        if(i.type === 'flight' && i.flightDetails?.arrivalDate) extraDates.add(i.flightDetails.arrivalDate);
    });
    
    // Combine and sort
    const unique = Array.from(new Set([...range, ...Array.from(extraDates)]));
    unique.sort();
    return unique.length > 0 ? unique : [trip.startDate];
  }, [trip.startDate, trip.endDate, items]);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
      // Default to today if within range, otherwise start date
      const today = new Date().toISOString().split('T')[0];
      if (allDates.includes(today)) return today;
      return allDates[0] || trip.startDate;
  });

  // Form State
  const [newItem, setNewItem] = useState<Partial<ScheduleItem>>({
    type: 'sightseeing',
    date: selectedDate,
    endDate: selectedDate,
    time: '09:00',
    endTime: '',
    title: '',
    participants: trip.allowedEmails // Default to everyone
  });
  
  const [flightData, setFlightData] = useState<FlightDetails>({
    flightNumber: '', origin: 'ABC', destination: 'XYZ', arrivalTime: '', seat: '', arrivalDate: ''
  });

  // Sync new item date when switching tabs (only if not editing)
  useEffect(() => {
    if (!editingId) {
      setNewItem(prev => ({ ...prev, date: selectedDate, endDate: selectedDate }));
      setFlightData(prev => ({ ...prev, arrivalDate: selectedDate }));
    }
  }, [selectedDate, editingId]);

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

  // Auto-refresh flight status on load if missing
  useEffect(() => {
    if(loading || items.length === 0) return;
    
    items.forEach(item => {
        if(item.type === 'flight' && item.flightDetails?.flightNumber) {
            // Force status to unavailable if not present
            if(!item.flightDetails.status) {
                refreshFlightStatus(item, true); // Silent auto refresh
            }
        }
    });
  }, [items]);

  const refreshFlightStatus = async (item: ScheduleItem, silent = false) => {
    if (!item.flightDetails?.flightNumber) return;
    if (refreshingItems.has(item.id)) return;

    if(!silent) {
      setRefreshingItems(prev => new Set(prev).add(item.id));
    }

    // Mock API Latency
    await new Promise(r => setTimeout(r, 800));
    
    // User requested "Unavailable" (Yellow) until API is integrated
    const newStatus = 'Unavailable';

    try {
      await db.collection(`trips/${trip.id}/schedule`).doc(item.id).update({
          'flightDetails.status': newStatus,
          'flightDetails.lastUpdated': new Date().toISOString()
      });
    } catch (err) {
        console.error("Failed to update status", err);
    } finally {
        if(!silent) {
          setRefreshingItems(prev => {
              const next = new Set(prev);
              next.delete(item.id);
              return next;
          });
        }
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setErrorState(null);
    setRetryTrigger(prev => prev + 1);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingSettings(true);
      try {
          await db.collection('trips').doc(trip.id).update({
              startDate: editDateRange.start,
              endDate: editDateRange.end
          });
          setIsEditingSettings(false);
      } catch (err) {
          console.error(err);
          alert("Failed to update trip dates.");
      } finally {
          setSavingSettings(false);
      }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setNewItem({ 
      title: '', 
      notes: '', 
      type: 'sightseeing',
      date: selectedDate, 
      endDate: selectedDate,
      time: '09:00',
      endTime: '',
      participants: trip.allowedEmails
    }); 
    setFlightData({ flightNumber: '', origin: 'ABC', destination: 'XYZ', arrivalTime: '', seat: '', arrivalDate: selectedDate });
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.title && newItem.type !== 'flight') return; // Flight might rely on flight# as title logic in future, but basic check is good

    try {
      const payload: any = {
        ...newItem
      };

      if (newItem.type === 'flight') {
        payload.flightDetails = {
            ...flightData,
            // Ensure arrivalDate is set, defaulting to departure date if empty
            arrivalDate: flightData.arrivalDate || newItem.date
        };
        // Auto-title if empty
        if (!payload.title) payload.title = `Flight to ${flightData.destination}`;
        // Flights don't use the standard endDate field usually, but we ensure cleanliness
        delete payload.endDate; 
      } else {
        // Ensure endDate is at least the start date
        if (!payload.endDate) payload.endDate = payload.date;
      }

      if (editingId) {
        // Update existing
        await db.collection(`trips/${trip.id}/schedule`).doc(editingId).update(payload);
      } else {
        // Create new
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection(`trips/${trip.id}/schedule`).add(payload);
      }
      
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Failed to save');
    }
  };

  const handleDeleteItem = async () => {
    if (!editingId) return;
    if (confirm("Are you sure you want to delete this plan?")) {
        try {
            await db.collection(`trips/${trip.id}/schedule`).doc(editingId).delete();
            resetForm();
        } catch (err) {
            console.error("Failed to delete", err);
            alert("Could not delete item");
        }
    }
  };

  const handleItemClick = (item: ScheduleItem) => {
      if ((item.type === 'flight' || item.type === 'hotel') && onTabChange) {
          onTabChange(AppTab.Bookings);
      } else {
          openEditModal(item);
      }
  };

  const openEditModal = (item: ScheduleItem) => {
      setEditingId(item.id);
      setNewItem({
          type: item.type,
          date: item.date,
          endDate: item.endDate || item.date,
          time: item.time,
          endTime: item.endTime || '',
          title: item.title,
          notes: item.notes || '',
          participants: item.participants || []
      });
      if (item.flightDetails) {
          setFlightData({
            flightNumber: item.flightDetails.flightNumber || '',
            origin: item.flightDetails.origin || 'ABC',
            destination: item.flightDetails.destination || 'XYZ',
            arrivalTime: item.flightDetails.arrivalTime || '',
            seat: item.flightDetails.seat || '',
            arrivalDate: item.flightDetails.arrivalDate || item.date // Fallback for old data
          });
      } else {
          setFlightData({ flightNumber: '', origin: 'ABC', destination: 'XYZ', arrivalTime: '', seat: '', arrivalDate: item.date });
      }
      setIsAdding(true);
  };

  const toggleParticipant = (email: string) => {
    const current = newItem.participants || [];
    if (current.includes(email)) {
      setNewItem({ ...newItem, participants: current.filter(e => e !== email) });
    } else {
      setNewItem({ ...newItem, participants: [...current, email] });
    }
  };

  // --- FILTER & SORT ITEMS FOR SELECTED DATE ---
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
        // FLIGHTS
        if (item.type === 'flight') {
            if (item.date === selectedDate) {
                displayItems.push({ ...item, renderMode: 'flight_dep', sortTime: item.time });
            }
            if (item.flightDetails?.arrivalDate === selectedDate && item.date !== selectedDate) {
                displayItems.push({ ...item, renderMode: 'flight_arr', sortTime: item.flightDetails.arrivalTime || '00:00' });
            }
            return;
        }

        // HOTELS
        if (item.type === 'hotel') {
            if (item.date === selectedDate) {
                 displayItems.push({ ...item, renderMode: 'hotel_in', sortTime: item.time });
            }
            if (item.endDate === selectedDate) {
                 // Check if same day to allow showing both cards if user configured it that way (e.g. day use)
                 // But typically checks are distinct. We allow both.
                 displayItems.push({ ...item, renderMode: 'hotel_out', sortTime: item.endTime || '11:00' });
            }
            return;
        }
        
        // STANDARD ITEMS
        if (item.date === selectedDate) {
            displayItems.push({ ...item, renderMode: 'standard', sortTime: item.time });
        }
    });

    // Sort by computed time
    return displayItems.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  }, [items, selectedDate, selectedPassenger]);


  if (errorState?.code === 'missing-index') {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle size={24} />
        </div>
        <h3 className="font-bold text-ink mb-2">Setup Required</h3>
        <p className="text-gray-500 text-sm mb-4 max-w-xs">
          Please check your browser console and click the Firebase link to create the required index.
        </p>
        <Button onClick={handleRetry} className="py-2 h-auto text-sm">
          <RefreshCw size={16} /> Retry
        </Button>
      </div>
    );
  }

  // Permission Error View
  if (errorState?.code === 'permission-denied') {
      return (
          <div className="flex flex-col items-center justify-center py-20 px-6 opacity-50">
             <div className="text-4xl mb-4 text-center"><Lock size={48} /></div>
             <h3 className="font-bold text-lg mb-2 text-center">Schedule Restricted</h3>
             <p className="text-center text-sm max-w-[200px] mb-6">
                 This schedule is currently private or restricted by security rules.
             </p>
             <Button variant="secondary" onClick={logout} className="py-2 text-xs">Logout</Button>
          </div>
      );
  }

  return (
    <div className="pb-24">
      {/* --- DATE SCROLLER --- */}
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-40 -mx-4 mb-2 bg-paper/90 backdrop-blur-sm border-b border-[#E0E5D5]/50 transition-all duration-300">
        <div className="flex items-center">
             <div className="flex-1 overflow-x-auto flex gap-3 px-4 pb-4 pt-4 no-scrollbar snap-x">
                {allDates.map(date => {
                    const d = new Date(date + 'T00:00:00'); // Force local midnight
                    const isSelected = date === selectedDate;
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                    const dayNum = d.getDate();

                    const hasPlans = items.some(i => 
                        i.date === date || 
                        i.endDate === date ||
                        (i.type === 'flight' && i.flightDetails?.arrivalDate === date)
                    );

                    return (
                    <button 
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`snap-start flex-shrink-0 flex flex-col items-center justify-center w-[72px] h-[84px] rounded-3xl border-2 transition-all duration-300 ${
                        isSelected 
                            ? 'bg-brand border-brand text-white shadow-md scale-105 rotate-1' 
                            : 'bg-white border-[#E0E5D5] text-gray-400 hover:border-brand/50 hover:scale-105'
                        }`}
                    >
                        <span className="text-xs font-bold uppercase tracking-wide">{dayName}</span>
                        <span className={`text-2xl font-black font-rounded ${isSelected ? 'text-white' : 'text-ink'}`}>{dayNum}</span>
                        {/* Dot indicator if items exist */}
                        {hasPlans && (
                        <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-brand'}`}></div>
                        )}
                    </button>
                    );
                })}
            </div>
            {/* Edit Trip Settings Button */}
            <div className="pr-4 pl-2">
                <button 
                    onClick={() => {
                        setEditDateRange({ start: trip.startDate, end: trip.endDate });
                        setIsEditingSettings(true);
                    }}
                    className="w-12 h-12 rounded-full bg-white border-2 border-[#E0E5D5] flex items-center justify-center text-gray-400 hover:text-brand hover:border-brand transition-colors shadow-sm"
                >
                    <Settings size={20} />
                </button>
            </div>
        </div>
      </div>
      
      {/* --- PARTICIPANT FILTER --- */}
      <div className="px-1 mb-4 overflow-x-auto no-scrollbar">
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

      {loading && <div className="text-center text-gray-400 mt-10 flex flex-col items-center gap-2"><RefreshCw className="animate-spin" size={20} /> Checking schedule...</div>}
      
      {/* --- DAY VIEW CONTENT --- */}
      {!loading && (
        <div className="animate-in fade-in duration-500">
           <div className="flex items-center gap-2 mb-4 px-2">
             <div className="h-[2px] bg-brand/20 flex-1 rounded-full"></div>
             <h3 className="font-bold text-gray-500 text-sm uppercase tracking-widest font-rounded">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
             </h3>
             <div className="h-[2px] bg-brand/20 flex-1 rounded-full"></div>
           </div>

           {daysItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-[#E0E5D5] rounded-3xl bg-white/50 mx-2">
               <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm">
                 <Sparkles size={32} />
               </div>
               <h3 className="font-bold text-ink text-lg font-rounded">Free Day!</h3>
               <p className="text-gray-400 text-sm mb-6 max-w-[200px]">No plans yet for {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long'})} for {selectedPassenger === 'all' ? 'everyone' : selectedPassenger.split('@')[0]}.</p>
               <Button onClick={() => setIsAdding(true)} variant="secondary" className="!py-2 !px-4 text-sm">
                 <Plus size={16} /> Add Activity
               </Button>
             </div>
           ) : (
             <div className="flex flex-col gap-4 relative pb-20">
                {/* Continuous Vertical Line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-[#E0E5D5] rounded-full z-0"></div>

                {daysItems.map((item, index) => {
                  const uniqueKey = `${item.id}_${item.renderMode}`;
                  
                  // --- FLIGHT CARD (DEPARTURE - MAIN BOARDING PASS) ---
                  if (item.renderMode === 'flight_dep') {
                    const isRefreshing = refreshingItems.has(item.id);
                    const statusText = item.flightDetails?.status || 'Scheduled';
                    
                    // Status Styles
                    let statusColorClass = 'text-gray-500';
                    let statusDotClass = 'bg-gray-400';
                    let statusBgClass = 'bg-gray-50 border-gray-100';

                    if (statusText === 'Unavailable') {
                        statusColorClass = 'text-yellow-600';
                        statusDotClass = 'bg-yellow-500';
                        statusBgClass = 'bg-yellow-50 border-yellow-100';
                    } else if (statusText.toLowerCase().includes('delayed')) {
                        statusColorClass = 'text-orange-600';
                        statusDotClass = 'bg-orange-500';
                        statusBgClass = 'bg-orange-50 border-orange-100';
                    } else if (statusText === 'On Time') {
                        statusColorClass = 'text-green-600';
                        statusDotClass = 'bg-green-500';
                        statusBgClass = 'bg-green-50 border-green-100';
                    }

                    return (
                      <div key={uniqueKey} className="relative z-10 pl-2 cursor-pointer group" onClick={() => handleItemClick(item)}>
                         <div className="bg-white rounded-3xl shadow-soft border-2 border-[#E0E5D5] overflow-hidden transition-transform group-hover:shadow-soft-hover group-hover:border-brand">
                            
                            {/* Header: Label Left, Passengers Right */}
                            <div className="p-4 border-b-2 border-dashed border-brand/20 bg-brand/10 flex justify-between items-start">
                                <div className="flex items-center gap-2 font-bold text-brand mt-1.5">
                                  <Plane size={18} />
                                  <span className="text-sm tracking-widest font-rounded">BOARDING PASS</span>
                                </div>
                                {/* Passenger List (Wrap if too many) */}
                                <div className="flex flex-wrap justify-end gap-1.5 max-w-[65%]">
                                    {(item.participants || []).map((email) => (
                                        <div key={email} className="flex items-center gap-1.5 bg-white pl-1 pr-2 py-1 rounded-full border border-brand/10 shadow-sm">
                                            <div className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[9px] font-bold uppercase">
                                                {email[0]}
                                            </div>
                                            <span className="text-[10px] font-bold text-ink leading-none">{email.split('@')[0]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Body */}
                            <div className="p-5">
                                {/* CENTER BIG FLIGHT NUMBER */}
                                <div className="text-center mb-6">
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Flight Number</div>
                                    <div className="text-4xl font-black text-ink tracking-tighter">{item.flightDetails?.flightNumber || 'TBD'}</div>
                                </div>

                                {/* ROUTE ROW */}
                                <div className="flex justify-between items-center mb-6">
                                    {/* Origin */}
                                    <div className="text-center">
                                        <div className="text-3xl font-black text-ink">{item.flightDetails?.origin || 'ORG'}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Departs</div>
                                        <div className="text-sm font-bold px-3 py-1 rounded-full inline-block bg-brand/10 text-brand">
                                            {item.time}
                                        </div>
                                    </div>

                                    {/* Icon */}
                                    <div className="flex-1 px-4 flex flex-col items-center opacity-30">
                                        <div className="h-[2px] w-full bg-ink relative top-3 border-b border-dashed"></div>
                                        <Plane className="text-ink relative bg-white px-1 rotate-90" size={24} />
                                    </div>

                                    {/* Destination */}
                                    <div className="text-center">
                                        <div className="text-3xl font-black text-ink">{item.flightDetails?.destination || 'DST'}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Arrives</div>
                                        {/* Arrival Time with different color code (Orange) */}
                                        <div className="text-sm font-bold px-3 py-1 rounded-full inline-block bg-orange-100 text-orange-600">
                                            {item.flightDetails?.arrivalTime || '--:--'}
                                        </div>
                                    </div>
                                </div>

                                {/* STATUS ROW */}
                                <div className={`flex justify-between items-center rounded-xl p-3 border ${statusBgClass}`}>
                                    <div className="flex items-center gap-3">
                                       <div className={`w-2.5 h-2.5 rounded-full ${statusDotClass} ${isRefreshing ? 'animate-pulse' : ''}`}></div>
                                       <div className="flex flex-col">
                                           <span className="text-[9px] uppercase font-bold text-gray-400 leading-none mb-0.5">Status</span>
                                           <span className={`font-bold text-sm leading-none ${statusColorClass}`}>
                                               {statusText}
                                           </span>
                                       </div>
                                    </div>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); refreshFlightStatus(item); }}
                                      disabled={isRefreshing}
                                      className={`p-2 rounded-full transition-colors text-gray-400 hover:text-brand hover:bg-white border border-transparent hover:border-gray-200 ${isRefreshing ? 'animate-spin text-brand' : ''}`}
                                    >
                                      <RefreshCw size={16} />
                                    </button>
                                </div>

                            </div>
                         </div>
                      </div>
                    );
                  }

                  // --- FLIGHT CARD (ARRIVAL) ---
                  if (item.renderMode === 'flight_arr') {
                    return (
                        <div key={uniqueKey} className="relative z-10 pl-2 cursor-pointer group opacity-70 hover:opacity-100 transition-opacity" onClick={() => handleItemClick(item)}>
                            <div className="bg-white rounded-3xl shadow-soft border-2 border-dashed border-brand/30 overflow-hidden">
                                <div className="p-3 bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-gray-400 font-bold">
                                        <Plane size={16} className="rotate-90" />
                                        <span className="text-xs uppercase tracking-widest">Arrival</span>
                                    </div>
                                    <div className="text-xs font-mono font-bold text-gray-400">{item.flightDetails?.flightNumber}</div>
                                </div>
                                <div className="p-4 flex justify-between items-center">
                                    <div>
                                        <div className="text-2xl font-black text-gray-500">{item.flightDetails?.destination}</div>
                                        <div className="text-xs text-gray-400">Arrives {item.flightDetails?.arrivalTime}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-gray-400">From</div>
                                        <div className="text-lg font-bold text-gray-500">{item.flightDetails?.origin}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                  }

                  // --- HOTEL CARD (Check-In or Check-Out) ---
                  if (item.renderMode === 'hotel_in' || item.renderMode === 'hotel_out') {
                      const isCheckOut = item.renderMode === 'hotel_out';
                      const label = isCheckOut ? 'Check Out' : 'Check In';
                      const time = isCheckOut ? (item.endTime || '11:00') : item.time;
                      
                      return (
                        <div key={uniqueKey} className="relative z-10 flex gap-3 group cursor-pointer" onClick={() => handleItemClick(item)}>
                            {/* Time Bubble */}
                            <div className="flex flex-col items-center pt-1">
                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 shadow-sm transition-transform group-hover:scale-110 ${isCheckOut ? 'bg-white border-red-200 text-red-500' : 'bg-white border-purple-200 text-purple-500'}`}>
                                    {isCheckOut ? <LogOut size={16} className="ml-0.5" /> : <LogIn size={16} className="mr-0.5" />}
                                </div>
                                <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-500 font-mono">
                                    {time}
                                </div>
                            </div>

                            {/* Card Content */}
                            <div className="flex-1">
                                <Card className={`!p-4 flex flex-col gap-2 relative overflow-hidden group-hover:-translate-y-1 transition-transform border-2 ${isCheckOut ? 'border-red-100 bg-red-50/30' : 'border-purple-100 bg-purple-50/30'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isCheckOut ? 'text-red-400' : 'text-purple-400'}`}>
                                                {label}
                                            </div>
                                            <h4 className="font-bold text-ink text-lg leading-tight font-rounded">{item.title}</h4>
                                        </div>
                                        <div className={`p-2 rounded-full ${isCheckOut ? 'bg-red-100 text-red-500' : 'bg-purple-100 text-purple-500'}`}>
                                            <Bed size={16} />
                                        </div>
                                    </div>
                                    
                                    {(item.notes || (item.participants && item.participants.length < trip.allowedEmails.length)) && (
                                        <div className="bg-white/50 rounded-xl p-2 text-sm text-gray-600 border border-black/5 flex flex-col gap-2 mt-1">
                                            {item.notes && <p className="italic">"{item.notes}"</p>}
                                            {item.participants && item.participants.length < trip.allowedEmails.length && (
                                                <div className="flex items-center gap-2 pt-1 border-t border-dashed border-gray-200">
                                                    <span className="text-[10px] font-bold uppercase text-gray-400">Guests</span>
                                                    <AvatarPile emails={item.participants} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                      );
                  }

                  // --- STANDARD NOTEBOOK STRIP ---
                  return (
                    <div key={uniqueKey} className="relative z-10 flex gap-3 group cursor-pointer" onClick={() => handleItemClick(item)}>
                       {/* Time Bubble */}
                       <div className="flex flex-col items-center pt-1">
                          <div className="w-10 h-10 rounded-full bg-white border-2 border-brand flex items-center justify-center z-10 shadow-sm group-hover:scale-110 transition-transform">
                             <TypeIcon type={item.type} />
                          </div>
                          <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-500 font-mono flex flex-col items-center leading-none py-1 gap-0.5 min-w-[32px]">
                             <span>{item.time}</span>
                             {item.endTime && (
                                 <>
                                    <span className="text-gray-300">↓</span>
                                    <span>{item.endTime}</span>
                                 </>
                             )}
                          </div>
                       </div>

                       {/* Content Card */}
                       <div className="flex-1">
                          <Card className="!p-4 flex flex-col gap-2 relative overflow-hidden group-hover:-translate-y-1 transition-transform group-hover:border-brand">
                             {/* Decorative Tape */}
                             <div className="absolute top-2 right-[-20px] bg-yellow-100 w-20 h-4 rotate-45 opacity-50"></div>
                             
                             <h4 className="font-bold text-ink text-lg leading-tight font-rounded">{item.title}</h4>
                             
                             {/* End Date Indicator (for multi-day non-hotel events) */}
                             {item.endDate && item.endDate !== item.date && (
                                <div className="text-[10px] font-bold text-purple-500 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-full self-start">
                                    <Calendar size={10} />
                                    Ends {formatDateShort(item.endDate)}
                                </div>
                             )}
                             
                             {(item.notes || (item.participants && item.participants.length < trip.allowedEmails.length)) && (
                               <div className="bg-[#F7F4EB] rounded-xl p-3 text-sm text-gray-600 border border-[#E0E5D5] flex flex-col gap-2">
                                  {item.notes && <p className="italic">"{item.notes}"</p>}
                                  
                                  {item.participants && item.participants.length < trip.allowedEmails.length && (
                                    <div className="flex items-center gap-2 pt-1 border-t border-dashed border-gray-200">
                                      <span className="text-[10px] font-bold uppercase text-gray-400">With</span>
                                      <AvatarPile emails={item.participants} />
                                    </div>
                                  )}
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

      {/* --- ADD/EDIT ACTIVITY MODAL --- */}
      {/* UPDATED: Z-index boosted to 100, flexible height, and safe-area padding for mobile keyboard/footer safety */}
      {isAdding && (
        <div className="fixed inset-0 bg-ink/20 z-[100] flex items-end sm:items-center justify-center backdrop-blur-sm sm:p-4">
           <div className="bg-white w-full max-w-md max-h-[90dvh] h-auto rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col animate-in slide-in-from-bottom-10 overflow-hidden pb-[env(safe-area-inset-bottom)]">
              
              {/* Modal Header */}
              <div className="p-4 border-b border-[#E0E5D5] flex justify-between items-center bg-[#F7F4EB]">
                 <h3 className="font-bold text-lg font-rounded">{editingId ? 'Edit Plan' : 'New Plan'}</h3>
                 <button onClick={resetForm} className="w-8 h-8 rounded-full bg-white border border-[#E0E5D5] flex items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors">
                    <X size={18} />
                 </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="p-4 overflow-y-auto flex-1 no-scrollbar">
                  <form id="schedule-form" onSubmit={handleAddItem} className="flex flex-col gap-4">
                     
                     {/* Type Selector */}
                     <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {(['sightseeing', 'food', 'transport', 'hotel', 'flight'] as ScheduleType[]).map(t => (
                           <button 
                             key={t}
                             type="button"
                             onClick={() => setNewItem({ ...newItem, type: t })}
                             className={`flex-shrink-0 px-4 py-2 rounded-full border-2 text-sm font-bold flex items-center gap-2 transition-all ${
                               newItem.type === t 
                               ? 'bg-brand text-white border-brand shadow-md' 
                               : 'bg-white text-gray-500 border-[#E0E5D5] hover:border-brand/50'
                             }`}
                           >
                              <TypeIcon type={t} />
                              <span className="capitalize">{t}</span>
                           </button>
                        ))}
                     </div>

                     {/* Date/Time Inputs */}
                     {newItem.type === 'flight' ? (
                         <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Departure Date"
                                type="date" 
                                required 
                                value={newItem.date} 
                                onChange={e => setNewItem({ ...newItem, date: e.target.value })}
                            />
                             <Input 
                                label="Departure Time"
                                type="time" 
                                required 
                                value={newItem.time} 
                                onChange={e => setNewItem({ ...newItem, time: e.target.value })}
                            />
                         </div>
                     ) : (
                        // NON-FLIGHT DATE/TIME BLOCK
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <Input 
                                    label="Start Date"
                                    type="date" 
                                    required 
                                    value={newItem.date} 
                                    onChange={e => setNewItem({ ...newItem, date: e.target.value })}
                                />
                                <Input 
                                    label="Start Time"
                                    type="time" 
                                    required 
                                    value={newItem.time} 
                                    onChange={e => setNewItem({ ...newItem, time: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-2 rounded-xl border border-dashed border-gray-200">
                                <Input 
                                    label="End Date"
                                    type="date" 
                                    value={newItem.endDate} 
                                    onChange={e => setNewItem({ ...newItem, endDate: e.target.value })}
                                />
                                <Input 
                                    label="End Time"
                                    type="time" 
                                    value={newItem.endTime || ''} 
                                    onChange={e => setNewItem({ ...newItem, endTime: e.target.value })}
                                />
                            </div>
                        </>
                     )}

                     {/* DYNAMIC FIELDS BASED ON TYPE */}
                     {newItem.type === 'flight' ? (
                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col gap-3">
                           <div className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                              <Plane size={14}/> Flight Details
                           </div>
                           
                           {/* Row 1: Flight # & Seat */}
                           <div className="grid grid-cols-2 gap-3">
                              <Input 
                                label="Flight #" 
                                placeholder="AA123" 
                                value={flightData.flightNumber} 
                                onChange={e => setFlightData({...flightData, flightNumber: e.target.value})} 
                              />
                              <Input 
                                label="Seat" 
                                placeholder="12A" 
                                value={flightData.seat} 
                                onChange={e => setFlightData({...flightData, seat: e.target.value})} 
                              />
                           </div>

                           {/* Row 2: Origin & Destination */}
                           <div className="grid grid-cols-2 gap-3">
                              <Input 
                                label="From (Code)" 
                                placeholder="SFO" 
                                maxLength={3}
                                className="uppercase"
                                value={flightData.origin} 
                                onChange={e => setFlightData({...flightData, origin: e.target.value.toUpperCase()})} 
                              />
                              <Input 
                                label="To (Code)" 
                                placeholder="JFK" 
                                maxLength={3}
                                className="uppercase"
                                value={flightData.destination} 
                                onChange={e => setFlightData({...flightData, destination: e.target.value.toUpperCase()})} 
                              />
                           </div>

                           {/* Row 3: Arrival Date & Time */}
                           <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-200 border-dashed">
                               <Input 
                                 label="Arrival Date" 
                                 type="date"
                                 value={flightData.arrivalDate} 
                                 onChange={e => setFlightData({...flightData, arrivalDate: e.target.value})} 
                               />
                               <Input 
                                 label="Arrival Time" 
                                 type="time"
                                 value={flightData.arrivalTime} 
                                 onChange={e => setFlightData({...flightData, arrivalTime: e.target.value})} 
                               />
                           </div>
                        </div>
                     ) : (
                        <Input 
                            label="Activity Name"
                            placeholder="e.g. Visit Tokyo Tower"
                            required 
                            value={newItem.title} 
                            onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                        />
                     )}

                     <Input 
                        label="Notes / Location"
                        placeholder="Details, reservation #, address..."
                        value={newItem.notes} 
                        onChange={e => setNewItem({ ...newItem, notes: e.target.value })}
                     />
                     
                     <div className="space-y-2">
                       <label className="text-sm font-bold text-gray-500 ml-3 uppercase tracking-wider text-[10px]">Who's Going?</label>
                       <div className="flex flex-wrap gap-2">
                          <button 
                            type="button"
                            onClick={() => setNewItem({ ...newItem, participants: trip.allowedEmails })}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                newItem.participants?.length === trip.allowedEmails.length
                                ? 'bg-ink text-white border-ink'
                                : 'bg-white text-gray-400 border-dashed border-gray-300'
                            }`}
                          >
                             Everyone
                          </button>
                          {trip.allowedEmails.map(email => {
                            const isSelected = newItem.participants?.includes(email);
                            return (
                                <button 
                                key={email}
                                type="button"
                                onClick={() => toggleParticipant(email)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                    isSelected
                                    ? 'bg-brand/10 text-brand border-brand'
                                    : 'bg-white text-gray-400 border-gray-100'
                                }`}
                                >
                                {email.split('@')[0]}
                                </button>
                            );
                          })}
                       </div>
                     </div>
                     
                     {/* Added padding to bottom of scroll area so content isn't flush with footer on small screens */}
                     <div className="h-4"></div>
                  </form>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#E0E5D5] bg-[#F7F4EB] flex gap-3">
                 {editingId && (
                     <button 
                       type="button" 
                       onClick={handleDeleteItem}
                       className="w-12 h-12 rounded-full border-2 border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50 transition-colors"
                     >
                        <Trash2 size={20} />
                     </button>
                 )}
                 <Button type="submit" form="schedule-form" className="flex-1">
                    {editingId ? 'Save Changes' : 'Add to Schedule'}
                 </Button>
              </div>

           </div>
        </div>
      )}
 <button
        onClick={() => setIsAdding(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-brand text-white rounded-full shadow-soft hover:shadow-soft-hover hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-40"
      >
        <Plus size={28} />
      </button>
      {/* --- EDIT SETTINGS MODAL --- */}
      {isEditingSettings && (
         <div className="fixed inset-0 bg-ink/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
            <Card className="w-full max-w-sm">
                <h3 className="font-bold text-lg mb-4">Trip Settings</h3>
                <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
                    <Input 
                        label="Start Date" 
                        type="date" 
                        value={editDateRange.start}
                        onChange={e => setEditDateRange({...editDateRange, start: e.target.value})}
                    />
                    <Input 
                        label="End Date" 
                        type="date" 
                        value={editDateRange.end}
                        onChange={e => setEditDateRange({...editDateRange, end: e.target.value})}
                    />
                    <div className="flex gap-2 mt-2">
                        <Button type="button" variant="secondary" onClick={() => setIsEditingSettings(false)} className="flex-1">Cancel</Button>
                        <Button type="submit" disabled={savingSettings} className="flex-1">{savingSettings ? 'Saving...' : 'Save'}</Button>
                    </div>
                </form>
            </Card>
         </div>
      )}

    </div>
  );
};