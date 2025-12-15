import React, { useEffect, useState, useMemo } from 'react';
// FIX: The firestore imports are for v9. Switching to v8 style.
import { db, firebase } from '../../lib/firebase';
import { Trip, ScheduleItem, ScheduleType, FlightDetails, AppTab } from '../../types';
import { Card, Button, Input } from '../../components/ui/Layout';
import { MapPin, Coffee, Bed, Bus, Plus, X, Plane, Users, AlertTriangle, RefreshCw, Calendar, Sparkles, Settings, Trash2, ArrowRight } from 'lucide-react';

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

const AvatarPile: React.FC<{ emails: string[] }> = ({ emails }) => {
  if (!emails || emails.length === 0) return null;
  return (
    <div className="flex -space-x-2">
      {emails.slice(0, 4).map((email, i) => (
        <div key={email} className="w-6 h-6 rounded-full bg-paper border border-white flex items-center justify-center text-[8px] font-bold text-gray-600 uppercase shadow-sm" title={email}>
          {email[0]}
        </div>
      ))}
      {emails.length > 4 && (
        <div className="w-6 h-6 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[8px] font-bold text-gray-500 shadow-sm">
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

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ trip, onTabChange }) => {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // Track which item is being edited
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Settings / Edit Dates State
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editDateRange, setEditDateRange] = useState({ start: trip.startDate, end: trip.endDate });
  const [savingSettings, setSavingSettings] = useState(false);

  // Filter State
  const [selectedPassenger, setSelectedPassenger] = useState<string | 'all'>('all');

  // VIEW STATE
  const allDates = useMemo(() => {
    const range = getDaysArray(trip.startDate, trip.endDate);
    
    // Also include any dates that existing items have (including flight arrivals)
    const extraDates = new Set<string>();
    items.forEach(i => {
        if(i.date) extraDates.add(i.date);
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
    time: '09:00',
    title: '',
    participants: trip.allowedEmails // Default to everyone
  });
  
  const [flightData, setFlightData] = useState<FlightDetails>({
    flightNumber: '', origin: 'ABC', destination: 'XYZ', arrivalTime: '', seat: '', arrivalDate: ''
  });

  // Sync new item date when switching tabs (only if not editing)
  useEffect(() => {
    if (!editingId) {
      setNewItem(prev => ({ ...prev, date: selectedDate }));
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
      date: selectedDate, // Reset to current view date
      time: '09:00',
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
      if (item.type === 'flight' && onTabChange) {
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
          time: item.time,
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

  // --- FILTER ITEMS FOR SELECTED DATE ---
  // Show item if:
  // 1. It is the selected date (Departure or Standard item)
  // 2. It is a flight arriving on this date (even if departure was earlier)
  // 3. AND it matches the selected participant (or 'all')
  const daysItems = useMemo(() => {
    const filtered = items.filter(item => {
        // Date Check
        const isDateMatch = (item.date === selectedDate) || 
                            (item.type === 'flight' && item.flightDetails?.arrivalDate === selectedDate);
        if (!isDateMatch) return false;

        // Participant Check
        if (selectedPassenger === 'all') return true;
        // If participants array exists and has entries, check inclusion.
        // If empty or undefined, assume it's for everyone.
        if (item.participants && item.participants.length > 0) {
            return item.participants.includes(selectedPassenger);
        }
        return true;
    });

    // Sort items by time relevant to the selected date
    return filtered.sort((a, b) => {
        // If it's an arrival entry (flight arriving on selectedDate but departing earlier), use arrivalTime
        const isArrivalA = a.type === 'flight' && a.flightDetails?.arrivalDate === selectedDate && a.date !== selectedDate;
        const timeA = isArrivalA ? (a.flightDetails?.arrivalTime || '00:00') : a.time;

        const isArrivalB = b.type === 'flight' && b.flightDetails?.arrivalDate === selectedDate && b.date !== selectedDate;
        const timeB = isArrivalB ? (b.flightDetails?.arrivalTime || '00:00') : b.time;

        return timeA.localeCompare(timeB);
    });
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

  return (
    <div className="pb-24">
      {/* --- DATE SCROLLER --- */}
      {/* Updated top position to align below floating header with safe area */}
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-40 -mx-4 mb-2 bg-paper/90 backdrop-blur-sm border-b border-[#E0E5D5]/50 transition-all duration-300">
        <div className="flex items-center">
             <div className="flex-1 overflow-x-auto flex gap-3 px-4 pb-4 pt-4 no-scrollbar snap-x">
                {allDates.map(date => {
                    const d = new Date(date + 'T00:00:00'); // Force local midnight
                    const isSelected = date === selectedDate;
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                    const dayNum = d.getDate();

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
                        {/* Dot indicator if items exist (check arrival date too) */}
                        {items.some(i => i.date === date || (i.type === 'flight' && i.flightDetails?.arrivalDate === date)) && (
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
                  if (item.type === 'flight') {
                    const isArrivalEntry = item.flightDetails?.arrivalDate === selectedDate && item.date !== selectedDate;
                    
                    // --- BOARDING PASS STICKER ---
                    return (
                      <div key={item.id + (isArrivalEntry ? '_arr' : '')} className="relative z-10 pl-2 cursor-pointer group" onClick={() => handleItemClick(item)}>
                         <div className={`bg-white rounded-3xl shadow-soft border-2 overflow-hidden group-hover:rotate-1 transition-transform group-hover:shadow-soft-hover ${isArrivalEntry ? 'border-brand/50' : 'border-[#E0E5D5] group-hover:border-brand'}`}>
                            {/* Header */}
                            <div className={`p-4 border-b-2 border-dashed flex justify-between items-center ${isArrivalEntry ? 'bg-gray-50 border-gray-200' : 'bg-brand/10 border-brand/20'}`}>
                                <div className={`flex items-center gap-2 font-bold ${isArrivalEntry ? 'text-gray-500' : 'text-brand'}`}>
                                  <Plane size={18} className={isArrivalEntry ? 'rotate-90' : ''} />
                                  <span className="text-sm tracking-widest font-rounded">{isArrivalEntry ? 'ARRIVAL' : 'BOARDING PASS'}</span>
                                </div>
                                <div className="text-xs font-mono font-bold text-gray-500 bg-white/50 px-2 py-1 rounded">{item.flightDetails?.flightNumber || 'FLIGHT'}</div>
                            </div>
                            {/* Body */}
                            <div className="p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <div className={`text-center ${isArrivalEntry ? 'opacity-50' : ''}`}>
                                        <div className="text-3xl font-black text-ink">{item.flightDetails?.origin || 'ORG'}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Departs</div>
                                        <div className={`text-sm font-bold px-2 rounded-full inline-block mt-1 ${isArrivalEntry ? 'text-gray-400' : 'bg-brand/10 text-brand'}`}>
                                            {item.time}
                                        </div>
                                    </div>
                                    <div className="flex-1 px-4 flex flex-col items-center opacity-30">
                                        <div className="h-[2px] w-full bg-ink relative top-3 border-b border-dashed"></div>
                                        <Plane className="text-ink relative bg-white px-1 rotate-90" size={24} />
                                    </div>
                                    <div className={`text-center ${!isArrivalEntry ? 'opacity-50' : ''}`}>
                                        <div className="text-3xl font-black text-ink">{item.flightDetails?.destination || 'DST'}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Arrives</div>
                                        <div className={`text-sm font-bold px-2 rounded-full inline-block mt-1 ${isArrivalEntry ? 'bg-brand/10 text-brand' : 'text-gray-300'}`}>
                                            {item.flightDetails?.arrivalTime || '--:--'}
                                        </div>
                                    </div>
                                </div>
                                
                                {isArrivalEntry && (
                                    <div className="bg-gray-50 rounded-xl p-2 mb-3 text-center text-xs text-gray-500">
                                        Arriving from <span className="font-bold">{item.flightDetails?.origin}</span>
                                    </div>
                                )}
                                
                                <div className="bg-[#F7F4EB] rounded-2xl p-3 mb-3 border border-[#E0E5D5] text-center">
                                    <div className="text-[10px] text-gray-400 uppercase font-bold">Seat</div>
                                    <div className="text-lg font-bold text-ink">{item.flightDetails?.seat || '-'}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-400 font-medium">Passengers</span>
                                  <AvatarPile emails={item.participants || []} />
                                </div>
                            </div>
                         </div>
                      </div>
                    );
                  }

                  // --- NOTEBOOK STRIP ---
                  return (
                    <div key={item.id} className="relative z-10 flex gap-3 group cursor-pointer" onClick={() => handleItemClick(item)}>
                       {/* Time Bubble */}
                       <div className="flex flex-col items-center pt-1">
                          <div className="w-10 h-10 rounded-full bg-white border-2 border-brand flex items-center justify-center z-10 shadow-sm group-hover:scale-110 transition-transform">
                             <TypeIcon type={item.type} />
                          </div>
                          <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-500 font-mono">
                             {item.time}
                          </div>
                       </div>

                       {/* Content Card */}
                       <div className="flex-1">
                          <Card className="!p-4 flex flex-col gap-2 relative overflow-hidden group-hover:-translate-y-1 transition-transform group-hover:border-brand">
                             {/* Decorative Tape */}
                             <div className="absolute top-2 right-[-20px] bg-yellow-100 w-20 h-4 rotate-45 opacity-50"></div>
                             
                             <h4 className="font-bold text-ink text-lg leading-tight font-rounded">{item.title}</h4>
                             
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