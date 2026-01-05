import React, { useEffect, useState, useMemo } from 'react';
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Trip, ScheduleItem, FlightDetails, ThemeColor } from '../../types';
import { Card } from '../../components/ui/Layout';
import { Plane, Map, Bus, FileText, Luggage, Plus, Lock, MapPin, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Layout';

// Shared Components
import { SubTabButton, AvatarFilter } from './BookingsShared';
import { BookingViewModal } from './BookingViewModal';
import { BookingEditModal } from './BookingEditModal';
import { ParticipantTags, getTicketTheme } from '../schedule/ScheduleShared';

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
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SubTab>('flight');
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<string | 'all'>(user?.email || 'all');
  
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

  // Auto assign color if missing (same logic as ScheduleTab)
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

  // --- LOGGING HELPER ---
  const logActivity = async (action: 'create' | 'update' | 'delete', title: string, details: string) => {
    try {
        await db.collection(`trips/${trip.id}/logs`).add({
            tripId: trip.id,
            timestamp: new Date().toISOString(),
            category: 'booking',
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
             
             const changes: string[] = [];
             
             // Diff Logic
             const checkChange = (field: keyof ScheduleItem, label: string) => {
                 if (editingItem[field] !== payload[field]) {
                     changes.push(`${label} updated from "${editingItem[field]}" to "${payload[field]}"`);
                 }
             };
             checkChange('title', 'Title');
             checkChange('date', 'Date');
             checkChange('time', 'Time');
             checkChange('notes', 'Notes');

             if (activeTab === 'flight' && editingItem.flightDetails && payload.flightDetails) {
                 const oldF = editingItem.flightDetails;
                 const newF = payload.flightDetails;
                 if (oldF.seat !== newF.seat) changes.push(`Seat updated from "${oldF.seat}" to "${newF.seat}"`);
                 if (oldF.gate !== newF.gate) changes.push(`Gate updated from "${oldF.gate}" to "${newF.gate}"`);
                 if (oldF.bookingReference !== newF.bookingReference) changes.push(`Ref updated from "${oldF.bookingReference}" to "${newF.bookingReference}"`);
             }

             const logMsg = changes.length > 0 ? changes.join('\n') : 'Updated details';
             logActivity('update', payload.title, logMsg);

          } else {
             // Assign a random color if new
             const colors: ThemeColor[] = ['blue', 'green', 'orange'];
             payload.themeColor = colors[Math.floor(Math.random() * colors.length)];
             
             payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
             await db.collection(`trips/${trip.id}/schedule`).add(payload);
             
             const detailLines = [];
             detailLines.push(`Date: ${payload.date}`);
             detailLines.push(`Time: ${payload.time}`);
             if (activeTab === 'flight' && payload.flightDetails) {
                 detailLines.push(`Flight: ${payload.flightDetails.flightNumber}`);
                 detailLines.push(`Route: ${payload.flightDetails.origin} to ${payload.flightDetails.destination}`);
             } else {
                 detailLines.push(`Type: ${activeTab}`);
             }
             
             logActivity('create', payload.title, detailLines.join('\n'));
          }

          setIsEditing(false);
          setEditingItem(null);
      } catch (err) {
          console.error(err);
          alert("Failed to save booking details. Check permissions.");
      }
  };

  const handleDelete = async (id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    if (confirm("Delete this booking?")) {
        try {
            await db.collection(`trips/${trip.id}/schedule`).doc(id).delete();
            if (itemToDelete) {
                const detailLines = [];
                detailLines.push(`Date: ${itemToDelete.date}`);
                detailLines.push(`Time: ${itemToDelete.time}`);
                if (itemToDelete.type === 'flight' && itemToDelete.flightDetails) {
                    detailLines.push(`Flight: ${itemToDelete.flightDetails.flightNumber}`);
                }
                logActivity('delete', itemToDelete.title, detailLines.join('\n'));
            }
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

          {activeTab === 'flight' && filteredItems.map(item => {
              const theme = getTicketTheme(item.themeColor);
              
              return (
                  <div key={item.id} className="relative group cursor-pointer" onClick={() => setViewingItemId(item.id)}>
                      {/* REDESIGN: Boxy Boarding Pass (Small Radius, Gray Border, Soft Shadow) */}
                      <div className={`bg-white rounded-md shadow-soft border-2 border-gray-200 overflow-hidden transition-all group-hover:shadow-soft-hover group-hover:-translate-y-1`}>
                          {/* Header */}
                          <div className="p-3 bg-white border-b border-gray-100 flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                  <Plane size={14} className="text-gray-400" />
                                  <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${theme.text}`}>Boarding Pass</span>
                              </div>
                              {item.flightDetails?.bookingReference && (
                                  <span className="text-[9px] font-sans font-medium text-gray-300">Ref: {item.flightDetails.bookingReference}</span>
                              )}
                          </div>
                          
                          <div className="p-5">
                              {/* Soft UI Flight Box */}
                              <div className="flex justify-center mb-6">
                                <div className="px-6 py-3 rounded-2xl bg-white shadow-[4px_4px_10px_#e5e7eb,-4px_-4px_10px_#ffffff] border border-gray-50 flex flex-col items-center min-w-[140px]">
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Flight Number</div>
                                    <div className="text-3xl font-black text-ink tracking-tight font-sans">{item.flightDetails?.flightNumber || 'TBD'}</div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center mb-6 relative">
                                  <div className="text-left">
                                      <div className="text-3xl font-black text-ink font-sans">{item.flightDetails?.origin}</div>
                                      <div className="text-[9px] font-bold uppercase mt-1 text-gray-400">{item.date} • {item.time}</div>
                                  </div>
                                  
                                  <div className="flex-1 flex flex-col items-center px-2 relative -top-2">
                                      <div className="w-full h-[2px] bg-gray-200 relative">
                                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-1">
                                              <Plane size={12} className="text-gray-300 rotate-90" />
                                          </div>
                                      </div>
                                  </div>

                                  <div className="text-right">
                                      <div className="text-3xl font-black text-ink font-sans">{item.flightDetails?.destination}</div>
                                      <div className="text-[9px] font-bold uppercase mt-1 text-gray-400">
                                          {item.flightDetails?.arrivalDate && item.flightDetails.arrivalDate !== item.date ? item.flightDetails.arrivalDate : ''} {item.flightDetails?.arrivalTime}
                                      </div>
                                  </div>
                              </div>

                              {/* Details Grid */}
                              <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-4 mb-4">
                                    <div className="text-center">
                                        <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Terminal</div>
                                        <div className="font-bold text-ink text-sm font-sans">{item.flightDetails?.terminal || '-'}</div>
                                    </div>
                                    <div className="text-center border-x border-gray-100">
                                        <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Gate</div>
                                        <div className="font-bold text-ink text-sm font-sans">{item.flightDetails?.gate || '-'}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Seat</div>
                                        <div className="font-bold text-ink text-sm font-sans">{item.flightDetails?.seat || 'ANY'}</div>
                                    </div>
                              </div>

                              <div className="flex justify-between items-center pt-2">
                                  <div>
                                      <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-1">Passengers</div>
                                      <ParticipantTags emails={item.participants || []} className="justify-start gap-1" />
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
              );
          })}

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