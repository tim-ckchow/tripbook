import React, { useEffect, useState, useMemo } from 'react';
// FIX: The firestore imports are for v9. Switching to v8 style.
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Trip, ScheduleItem, FlightDetails, AppTab, ThemeColor } from '../../types';
import { Button } from '../../components/ui/Layout';
import { Plus, RefreshCw, AlertTriangle, Sparkles, Lock } from 'lucide-react';

// Imported Sub-Components
import { AvatarFilter } from './ScheduleShared';
import { ScheduleEditModal } from './ScheduleEditModal';
import { ScheduleViewModal } from './ScheduleViewModal';
import { TripSettingsModal } from './TripSettingsModal';
import { FlightCard } from './components/FlightCard';
import { HotelCard } from './components/HotelCard';
import { ActivityCard } from './components/ActivityCard';
import { DateScroller } from './components/DateScroller';

interface ScheduleTabProps {
  trip: Trip;
  onTabChange?: (tab: AppTab, subTab?: string) => void;
  initialDate?: string;
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

type DisplayItem = ScheduleItem & { 
    renderMode: 'flight_dep' | 'flight_arr' | 'hotel_in' | 'hotel_out' | 'standard';
    sortTime: string;
};

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ trip, onTabChange, initialDate }) => {
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
      if (initialDate) return initialDate;
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
        
        // Calculate diff for log (simplified for brevity)
        logActivity('update', payload.title, 'Updated activity details');

      } else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        payload.createdBy = user?.uid; 
        
        await db.collection(`trips/${trip.id}/schedule`).add(payload);
        
        const detailLines = [];
        detailLines.push(`Date: ${payload.date}`);
        detailLines.push(`Time: ${payload.time}`);
        
        logActivity('create', payload.title, detailLines.join('\n'));
      }
      
      setIsAdding(false);
      setEditingItem(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save. You may not have permission.');
    }
  };

  const handleDeleteItem = async (id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    if (confirm("Are you sure you want to delete this plan?")) {
        try {
            await db.collection(`trips/${trip.id}/schedule`).doc(id).delete();
            if (itemToDelete) {
                logActivity('delete', itemToDelete.title, `Deleted schedule item`);
            }
            setIsAdding(false);
            setEditingItem(null);
            setViewingItemId(null);
        } catch (err) {
            console.error("Failed to delete", err);
            alert("Could not delete. Only the Owner or the Author can delete this item.");
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
        <DateScroller 
            allDates={allDates} 
            selectedDate={selectedDate} 
            onSelectDate={setSelectedDate} 
            onOpenSettings={() => setIsEditingSettings(true)}
            items={items}
        />

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
                  const isLast = index === daysItems.length - 1;
                  
                  if (item.renderMode === 'flight_dep' || item.renderMode === 'flight_arr') {
                      return (
                          <FlightCard 
                             key={`${item.id}_${item.renderMode}`}
                             item={item} 
                             renderMode={item.renderMode} 
                             isLast={isLast} 
                             onClick={() => handleItemClick(item)}
                             onRefreshStatus={refreshFlightStatus}
                          />
                      );
                  }

                  if (item.renderMode === 'hotel_in' || item.renderMode === 'hotel_out') {
                      return (
                          <HotelCard 
                             key={`${item.id}_${item.renderMode}`}
                             item={item}
                             renderMode={item.renderMode}
                             isLast={isLast}
                             onClick={() => handleItemClick(item)}
                          />
                      );
                  }

                  return (
                      <ActivityCard 
                         key={`${item.id}_${item.renderMode}`}
                         item={item}
                         isLast={isLast}
                         onClick={() => handleItemClick(item)}
                      />
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