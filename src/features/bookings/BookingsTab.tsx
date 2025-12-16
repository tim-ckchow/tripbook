import React, { useEffect, useState, useMemo } from 'react';
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Trip, ScheduleItem, FlightDetails } from '../../types';
import { Card } from '../../components/ui/Layout';
import { Plane, Map, Bus, FileText, Luggage, Plus, Lock, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Layout';

// Shared Components
import { SubTabButton, AvatarFilter } from './BookingsShared';
import { BookingViewModal } from './BookingViewModal';
import { BookingEditModal } from './BookingEditModal';

interface BookingsTabProps {
  trip: Trip;
  initialTab?: 'flight' | 'hotel' | 'transport' | 'general';
}

type SubTab = 'flight' | 'hotel' | 'transport' | 'general';

function formatDateRange(start: string, end?: string) {
    if (!start) return '';
    const d1 = new Date(start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (end && end !== start) {
        const d2 = new Date(end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${d1} - ${d2}`;
    }
    return d1;
}

export const BookingsTab: React.FC<BookingsTabProps> = ({ trip, initialTab }) => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SubTab>('flight');
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<string | 'all'>('all');
  
  // Viewing State (Read Only)
  const [viewingItemId, setViewingItemId] = useState<string | null>(null);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  
  useEffect(() => {
      if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setLoading(true);
    setErrorState(null);
    const unsubscribe = db.collection(`trips/${trip.id}/schedule`)
      .where('type', '==', activeTab === 'general' ? 'sightseeing' : activeTab) 
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleItem));
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
  
  const viewingItem = useMemo(() => {
      return items.find(i => i.id === viewingItemId) || null;
  }, [items, viewingItemId]);

  const handleAddNew = () => {
    setViewingItemId(null);
    setEditingItem(null);
    setIsEditing(true);
  };

  const handleEdit = (item: ScheduleItem) => {
      setEditingItem(item);
      setIsEditing(true);
  };

  const handleSave = async (editForm: Partial<ScheduleItem>, flightForm: FlightDetails) => {
      try {
          const payload: any = { ...editForm };
          
          if (!payload.type) {
             payload.type = activeTab === 'general' ? 'sightseeing' : activeTab;
          }

          if (activeTab === 'flight') {
              payload.flightDetails = flightForm;
              payload.title = `Flight to ${flightForm.destination}`;
          }
          
          if (!payload.title && activeTab !== 'flight') {
             payload.title = `New ${activeTab} booking`;
          }

          if (editingItem) {
             await db.collection(`trips/${trip.id}/schedule`).doc(editingItem.id).update(payload);
          } else {
             payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
             await db.collection(`trips/${trip.id}/schedule`).add(payload);
          }

          setIsEditing(false);
          setEditingItem(null);
      } catch (err) {
          console.error(err);
          alert("Failed to save booking details. Check permissions.");
      }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this booking?")) {
        try {
            await db.collection(`trips/${trip.id}/schedule`).doc(id).delete();
            setIsEditing(false);
            setViewingItemId(null);
            setEditingItem(null);
        } catch(err) {
            console.error(err);
            alert("Failed to delete.");
        }
    }
  };

  if (errorState?.code === 'permission-denied') {
      return (
          <div className="flex flex-col items-center justify-center py-20 px-6 opacity-50">
             <div className="text-4xl mb-4 flex justify-center"><Lock size={48} /></div>
             <h3 className="font-bold text-lg mb-2 text-center">Restricted Access</h3>
             <p className="text-center text-sm max-w-[200px] mb-6">Bookings are currently private or restricted.</p>
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
              <button onClick={() => setSelectedPassenger('all')} className={`px-4 py-1.5 rounded-full border-2 text-xs font-bold transition-all ${selectedPassenger === 'all' ? 'bg-ink text-white border-ink' : 'bg-white text-gray-400 border-gray-200'}`}>ALL</button>
              {trip.allowedEmails.map(email => (
                  <AvatarFilter key={email} email={email} active={selectedPassenger === email} onClick={() => setSelectedPassenger(email)} />
              ))}
          </div>
      </div>

      {/* --- CONTENT LIST --- */}
      <div className="px-4 flex flex-col gap-4 min-h-[50vh]">
          {loading && <div className="text-center text-gray-400 py-10">Loading bookings...</div>}
          
          {!loading && filteredItems.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300"><Luggage size={24} /></div>
                  <h3 className="text-gray-400 font-bold">No {activeTab} bookings found</h3>
                  <p className="text-xs text-gray-300 mt-2">Add them using the + button.</p>
              </div>
          )}

          {activeTab === 'flight' && filteredItems.map(item => (
              <div key={item.id} className="relative group cursor-pointer" onClick={() => setViewingItemId(item.id)}>
                  {/* TICKET VISUAL */}
                  <div className="bg-white rounded-3xl shadow-soft overflow-hidden border border-[#E0E5D5]">
                      <div className="bg-brand h-2 w-full"></div>
                      <div className="p-5">
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
                          </div>

                          <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center border border-gray-100">
                              <div>
                                  <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider">Booking Ref</div>
                                  <div className="font-mono font-bold text-ink tracking-widest">{item.flightDetails?.bookingReference || 'NO-REF'}</div>
                              </div>
                              <div className="opacity-20">
                                  <div className="flex gap-0.5 h-8">
                                      {[...Array(10)].map((_,i) => <div key={i} className={`w-${i%2===0?1:2} bg-black h-full`}></div>)}
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="absolute -top-2 right-4 flex -space-x-1">
                       {item.participants?.map((p, i) => (
                           <div key={i} className="w-6 h-6 rounded-full bg-ink border-2 border-white text-white text-[8px] flex items-center justify-center font-bold">
                               {p[0].toUpperCase()}
                           </div>
                       ))}
                  </div>
              </div>
          ))}

          {activeTab !== 'flight' && filteredItems.map(item => (
              <Card key={item.id} onClick={() => setViewingItemId(item.id)}>
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
                  {item.locationLink && (
                     <div className="text-xs text-blue-500 flex items-center gap-1 font-bold mt-2">
                         <MapPin size={12} /> Map Link
                     </div>
                  )}
                  <div className="text-sm text-gray-500 mt-2">{item.notes || 'No details'}</div>
              </Card>
          ))}
      </div>

      <button
        onClick={handleAddNew}
        className="fixed bottom-24 right-4 w-14 h-14 bg-brand text-white rounded-full shadow-soft hover:shadow-soft-hover hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-40"
      >
        <Plus size={28} />
      </button>

      {/* --- MODALS --- */}
      <BookingViewModal 
        item={viewingItem}
        onClose={() => setViewingItemId(null)}
        onEdit={handleEdit}
      />

      <BookingEditModal 
        isOpen={isEditing}
        onClose={() => { setIsEditing(false); setEditingItem(null); }}
        onSave={handleSave}
        onDelete={handleDelete}
        itemToEdit={editingItem}
        trip={trip}
        activeTab={activeTab}
      />
    </div>
  );
};