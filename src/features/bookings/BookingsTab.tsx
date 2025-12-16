import React, { useEffect, useState, useMemo } from 'react';
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Trip, ScheduleItem, FlightDetails } from '../../types';
import { Card, Button, Input } from '../../components/ui/Layout';
import { Plane, Map, Bus, FileText, User, Luggage, Clock, Tag, ExternalLink, X, Plus, Trash2, CheckCircle, Lock } from 'lucide-react';

interface BookingsTabProps {
  trip: Trip;
}

type SubTab = 'flight' | 'hotel' | 'transport' | 'general';

const SubTabButton: React.FC<{ active: boolean; label: string; icon: any; onClick: () => void }> = ({ active, label, icon: Icon, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl transition-all ${active ? 'bg-ink text-white shadow-soft' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
  >
    <Icon size={20} className="mb-1" />
    <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
  </button>
);

const AvatarFilter: React.FC<{ 
    email: string; 
    active: boolean; 
    onClick: () => void 
}> = ({ email, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all ${active ? 'bg-brand text-white border-brand' : 'bg-white text-gray-400 border-gray-200'}`}
    >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-white text-brand' : 'bg-gray-100 text-gray-500'}`}>
            {email[0].toUpperCase()}
        </div>
        <span className="text-xs font-bold">{email.split('@')[0]}</span>
    </button>
);

function formatDateRange(start: string, end?: string) {
    if (!start) return '';
    const d1 = new Date(start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (end && end !== start) {
        const d2 = new Date(end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${d1} - ${d2}`;
    }
    return d1;
}

export const BookingsTab: React.FC<BookingsTabProps> = ({ trip }) => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SubTab>('flight');
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<string | 'all'>('all');
  
  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State (Flight Focused initially)
  const [editForm, setEditForm] = useState<Partial<ScheduleItem>>({});
  const [flightForm, setFlightForm] = useState<FlightDetails>({
      flightNumber: '', origin: '', destination: '', arrivalTime: '', 
      seat: '', terminal: '', gate: '', bookingReference: '', 
      checkInTime: '', baggageAllowanceKg: '', arrivalDate: ''
  });

  useEffect(() => {
    setLoading(true);
    setErrorState(null);
    // Fetch all items, filter in memory for smoothness or strictly query. 
    // Given the small scale, fetching trip schedule and filtering is fine.
    const unsubscribe = db.collection(`trips/${trip.id}/schedule`)
      .where('type', '==', activeTab === 'general' ? 'sightseeing' : activeTab) // Mapping general to sightseeing for now as placeholder
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleItem));
        // Client side sort by date
        data.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        setItems(data);
        setLoading(false);
      }, (error: any) => {
          console.error("Bookings snapshot error:", error);
          if (error.code === 'permission-denied') {
              setErrorState({ code: 'permission-denied', message: 'Access restricted' });
          } else {
              setErrorState({ code: 'error', message: 'Failed to load bookings' });
          }
          setLoading(false);
      });
    return () => unsubscribe();
  }, [trip.id, activeTab]);

  const filteredItems = useMemo(() => {
    if (selectedPassenger === 'all') return items;
    return items.filter(item => !item.participants || item.participants.includes(selectedPassenger));
  }, [items, selectedPassenger]);

  const handleAddNew = () => {
    setEditingId(null);
    setEditForm({
      type: activeTab === 'general' ? 'sightseeing' : activeTab,
      date: trip.startDate,
      endDate: trip.startDate,
      time: '12:00',
      endTime: '',
      participants: trip.allowedEmails,
      title: '',
      notes: ''
    });
    setFlightForm({
      flightNumber: '', origin: '', destination: '', arrivalTime: '', 
      seat: '', terminal: '', gate: '', bookingReference: '', 
      checkInTime: '', baggageAllowanceKg: '', arrivalDate: trip.startDate
    });
    setIsEditing(true);
  };

  const handleEdit = (item: ScheduleItem) => {
      setEditingId(item.id);
      setEditForm({
          type: item.type,
          date: item.date,
          endDate: item.endDate || item.date, // Default to start date if not set
          time: item.time,
          endTime: item.endTime || '',
          participants: item.participants || trip.allowedEmails,
          notes: item.notes,
          title: item.title
      });
      if (item.type === 'flight' && item.flightDetails) {
          setFlightForm({ ...item.flightDetails });
      } else {
        setFlightForm({
            flightNumber: '', origin: '', destination: '', arrivalTime: '', 
            seat: '', terminal: '', gate: '', bookingReference: '', 
            checkInTime: '', baggageAllowanceKg: '', arrivalDate: item.date
        });
      }
      setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      
      try {
          const payload: any = { ...editForm };
          
          // Ensure type is set (fallback)
          if (!payload.type) {
             payload.type = activeTab === 'general' ? 'sightseeing' : activeTab;
          }

          if (activeTab === 'flight') {
              payload.flightDetails = flightForm;
              // Ensure title stays synced for flights
              payload.title = `Flight to ${flightForm.destination}`;
          }
          
          // Default title if missing for non-flights
          if (!payload.title && activeTab !== 'flight') {
             payload.title = `New ${activeTab} booking`;
          }

          if (editingId) {
             await db.collection(`trips/${trip.id}/schedule`).doc(editingId).update(payload);
          } else {
             payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
             await db.collection(`trips/${trip.id}/schedule`).add(payload);
          }

          setIsEditing(false);
      } catch (err) {
          console.error(err);
          alert("Failed to save booking details. Check permissions.");
      }
  };

  const toggleParticipant = (email: string) => {
    const current = editForm.participants || [];
    if (current.includes(email)) {
      setEditForm({ ...editForm, participants: current.filter(e => e !== email) });
    } else {
      setEditForm({ ...editForm, participants: [...current, email] });
    }
  };

  if (errorState?.code === 'permission-denied') {
      return (
          <div className="flex flex-col items-center justify-center py-20 px-6 opacity-50">
             <div className="text-4xl mb-4 flex justify-center"><Lock size={48} /></div>
             <h3 className="font-bold text-lg mb-2 text-center">Restricted Access</h3>
             <p className="text-center text-sm max-w-[200px] mb-6">
                 Bookings are currently private or restricted.
             </p>
             <Button variant="secondary" onClick={logout} className="py-2 text-xs">Logout</Button>
          </div>
      );
  }

  return (
    <div className="pb-24 flex flex-col gap-6 relative">
      
      {/* --- SUB NAVIGATION --- */}
      <div className="px-4 mt-2">
          <div className="flex gap-2 bg-gray-100/50 p-1.5 rounded-3xl">
              <SubTabButton active={activeTab === 'flight'} label="Flights" icon={Plane} onClick={() => setActiveTab('flight')} />
              <SubTabButton active={activeTab === 'hotel'} label="Hotels" icon={Map} onClick={() => setActiveTab('hotel')} />
              <SubTabButton active={activeTab === 'transport'} label="Taxi/Bus" icon={Bus} onClick={() => setActiveTab('transport')} />
              <SubTabButton active={activeTab === 'general'} label="Other" icon={FileText} onClick={() => setActiveTab('general')} />
          </div>
      </div>

      {/* --- PASSENGER FILTER --- */}
      <div className="px-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 min-w-max">
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

      {/* --- CONTENT LIST --- */}
      <div className="px-4 flex flex-col gap-4 min-h-[50vh]">
          {loading && <div className="text-center text-gray-400 py-10">Loading bookings...</div>}
          
          {!loading && filteredItems.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                      <Luggage size={24} />
                  </div>
                  <h3 className="text-gray-400 font-bold">No {activeTab} bookings found</h3>
                  <p className="text-xs text-gray-300 mt-2">Add them using the + button.</p>
              </div>
          )}

          {activeTab === 'flight' && filteredItems.map(item => (
              <div key={item.id} className="relative group cursor-pointer" onClick={() => handleEdit(item)}>
                  {/* TICKET VISUAL */}
                  <div className="bg-white rounded-3xl shadow-soft overflow-hidden border border-[#E0E5D5]">
                      {/* Top Strip */}
                      <div className="bg-brand h-2 w-full"></div>
                      
                      <div className="p-5">
                          {/* Route Header */}
                          <div className="flex justify-between items-start mb-6">
                              <div>
                                  <div className="text-4xl font-black text-ink tracking-tighter">{item.flightDetails?.origin}</div>
                                  <div className="text-xs text-gray-400 font-bold uppercase mt-1">{item.date} • {item.time}</div>
                              </div>
                              <div className="flex flex-col items-center px-4 pt-2">
                                  <Plane className="text-brand rotate-90" size={24} />
                                  <div className="text-[10px] font-mono text-brand bg-brand/10 px-2 py-0.5 rounded mt-1">{item.flightDetails?.flightNumber}</div>
                              </div>
                              <div className="text-right">
                                  <div className="text-4xl font-black text-ink tracking-tighter">{item.flightDetails?.destination}</div>
                                  <div className="text-xs text-gray-400 font-bold uppercase mt-1">
                                      {item.flightDetails?.arrivalDate && item.flightDetails.arrivalDate !== item.date ? item.flightDetails.arrivalDate : ''} {item.flightDetails?.arrivalTime}
                                  </div>
                              </div>
                          </div>

                          {/* Detail Grid */}
                          <div className="grid grid-cols-3 gap-y-4 gap-x-2 border-t border-dashed border-gray-200 pt-4 mb-4">
                                <div>
                                    <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Terminal</div>
                                    <div className="font-bold text-ink">{item.flightDetails?.terminal || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Gate</div>
                                    <div className="font-bold text-ink">{item.flightDetails?.gate || '-'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Seat</div>
                                    <div className="font-bold text-ink text-lg">{item.flightDetails?.seat || 'ANY'}</div>
                                </div>
                                
                                <div>
                                    <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Boarding</div>
                                    <div className="font-bold text-ink flex items-center gap-1">
                                        <Clock size={12} className="text-brand"/> {item.flightDetails?.checkInTime || '-'}
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Baggage Allow.</div>
                                    <div className="font-bold text-ink flex items-center gap-1">
                                        <Luggage size={12} className="text-gray-400"/> {item.flightDetails?.baggageAllowanceKg ? `${item.flightDetails.baggageAllowanceKg}kg` : 'Check Airline'}
                                    </div>
                                </div>
                          </div>

                          {/* Reference & Footer */}
                          <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center border border-gray-100">
                              <div>
                                  <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider">Booking Ref</div>
                                  <div className="font-mono font-bold text-ink tracking-widest">{item.flightDetails?.bookingReference || 'NO-REF'}</div>
                              </div>
                              <div className="opacity-20">
                                  {/* Fake Barcode */}
                                  <div className="flex gap-0.5 h-8">
                                      {[...Array(10)].map((_,i) => <div key={i} className={`w-${i%2===0?1:2} bg-black h-full`}></div>)}
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  {/* Passenger Chips Overlay */}
                  <div className="absolute -top-2 right-4 flex -space-x-1">
                       {item.participants?.map((p, i) => (
                           <div key={i} className="w-6 h-6 rounded-full bg-ink border-2 border-white text-white text-[8px] flex items-center justify-center font-bold">
                               {p[0].toUpperCase()}
                           </div>
                       ))}
                  </div>
              </div>
          ))}

          {/* Placeholder for other tabs */}
          {activeTab !== 'flight' && filteredItems.map(item => (
              <Card key={item.id} onClick={() => handleEdit(item)}>
                  <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-lg">{item.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs font-bold bg-brand/10 text-brand px-2 py-1 rounded">
                                {formatDateRange(item.date, item.endDate)}
                             </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-500">
                         {item.time}
                         {item.endTime && ` - ${item.endTime}`}
                      </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-2">{item.notes || 'No details'}</div>
              </Card>
          ))}
      </div>

      {/* --- ADD BUTTON (FAB) --- */}
      <button
        onClick={handleAddNew}
        className="fixed bottom-24 right-4 w-14 h-14 bg-brand text-white rounded-full shadow-soft hover:shadow-soft-hover hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-40"
      >
        <Plus size={28} />
      </button>

      {/* --- EDIT/ADD MODAL --- */}
      {isEditing && (
        <div className="fixed inset-0 bg-ink/20 z-[100] flex items-end sm:items-center justify-center backdrop-blur-sm sm:p-4">
           <div className="bg-white w-full max-w-md max-h-[90dvh] h-auto rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col animate-in slide-in-from-bottom-10 overflow-hidden pb-[env(safe-area-inset-bottom)]">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-lg font-rounded">{editingId ? 'Edit Booking' : 'Add Booking'}</h3>
                 <button onClick={() => setIsEditing(false)} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500">
                    <X size={18} />
                 </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 no-scrollbar">
                  <form id="booking-form" onSubmit={handleSave} className="flex flex-col gap-4">
                      
                      {activeTab !== 'flight' && (
                          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                             <Input 
                                label="Title / Place Name" 
                                placeholder="e.g. Hilton Hotel" 
                                value={editForm.title || ''} 
                                onChange={e => setEditForm({...editForm, title: e.target.value})} 
                             />
                          </div>
                      )}

                      {activeTab === 'flight' && (
                          <>
                             <div className="bg-brand/5 border border-brand/20 p-4 rounded-2xl">
                                 <label className="text-xs font-bold text-brand uppercase mb-2 block tracking-wider">Flight Info</label>
                                 <div className="grid grid-cols-2 gap-3 mb-3">
                                     <Input label="Flight #" value={flightForm.flightNumber} onChange={e => setFlightForm({...flightForm, flightNumber: e.target.value})} />
                                     <Input label="Booking Ref" placeholder="PNR-123" value={flightForm.bookingReference} onChange={e => setFlightForm({...flightForm, bookingReference: e.target.value})} />
                                 </div>
                                 <div className="grid grid-cols-2 gap-3">
                                     <Input label="Origin" value={flightForm.origin} onChange={e => setFlightForm({...flightForm, origin: e.target.value.toUpperCase()})} />
                                     <Input label="Dest" value={flightForm.destination} onChange={e => setFlightForm({...flightForm, destination: e.target.value.toUpperCase()})} />
                                 </div>
                             </div>

                             <div className="grid grid-cols-2 gap-3">
                                 <Input label="Departure Date" type="date" value={editForm.date || ''} onChange={e => setEditForm({...editForm, date: e.target.value})} />
                                 <Input label="Departure Time" type="time" value={editForm.time || ''} onChange={e => setEditForm({...editForm, time: e.target.value})} />
                             </div>

                             <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed border-gray-200">
                                 <Input label="Arrival Date" type="date" value={flightForm.arrivalDate || ''} onChange={e => setFlightForm({...flightForm, arrivalDate: e.target.value})} />
                                 <Input label="Arrival Time" type="time" value={flightForm.arrivalTime} onChange={e => setFlightForm({...flightForm, arrivalTime: e.target.value})} />
                             </div>

                             <div className="grid grid-cols-3 gap-3">
                                 <Input label="Gate" placeholder="A1" value={flightForm.gate} onChange={e => setFlightForm({...flightForm, gate: e.target.value})} />
                                 <Input label="Terminal" placeholder="T2" value={flightForm.terminal} onChange={e => setFlightForm({...flightForm, terminal: e.target.value})} />
                                 <Input label="Seat" placeholder="14A" value={flightForm.seat} onChange={e => setFlightForm({...flightForm, seat: e.target.value})} />
                             </div>
                             
                             <div className="grid grid-cols-2 gap-3">
                                 <Input label="Check-In (HH:mm)" type="time" value={flightForm.checkInTime} onChange={e => setFlightForm({...flightForm, checkInTime: e.target.value})} />
                                 <Input label="Baggage (kg)" placeholder="20" type="number" value={flightForm.baggageAllowanceKg} onChange={e => setFlightForm({...flightForm, baggageAllowanceKg: e.target.value})} />
                             </div>
                          </>
                      )}

                      {/* Generic Date/Time for non-flight */}
                      {activeTab !== 'flight' && (
                         <>
                             <div className="grid grid-cols-2 gap-3">
                                <Input label="Check-in Date" type="date" value={editForm.date || ''} onChange={e => setEditForm({...editForm, date: e.target.value})} />
                                <Input label="Check-in Time" type="time" value={editForm.time || ''} onChange={e => setEditForm({...editForm, time: e.target.value})} />
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                                <Input label="Check-out Date" type="date" value={editForm.endDate || ''} onChange={e => setEditForm({...editForm, endDate: e.target.value})} />
                                <Input label="Check-out Time" type="time" value={editForm.endTime || ''} onChange={e => setEditForm({...editForm, endTime: e.target.value})} />
                             </div>
                         </>
                      )}

                      <Input 
                        label="Notes / Address" 
                        placeholder="Confirmation #, address, etc."
                        value={editForm.notes || ''} 
                        onChange={e => setEditForm({...editForm, notes: e.target.value})} 
                      />

                      <div className="space-y-2 pt-2 border-t border-dashed border-gray-200">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Passengers</label>
                          <div className="flex flex-wrap gap-2">
                              {trip.allowedEmails.map(email => (
                                  <button 
                                      key={email} type="button" onClick={() => toggleParticipant(email)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${editForm.participants?.includes(email) ? 'bg-ink text-white border-ink' : 'bg-white text-gray-400 border-gray-200'}`}
                                  >
                                      {email.split('@')[0]}
                                  </button>
                              ))}
                          </div>
                      </div>
                      
                      <div className="h-6"></div>
                  </form>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50">
                  <Button type="submit" form="booking-form" className="w-full">
                      {editingId ? 'Save Changes' : 'Add Booking'}
                  </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};