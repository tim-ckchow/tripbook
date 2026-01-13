import React, { useEffect, useState, useMemo } from 'react';
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Trip, ScheduleItem, FlightDetails, ThemeColor } from '../../types';
import { Plane, Map, Bus, FileText, Luggage, Plus, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Layout';

// Shared Components
import { SubTabButton, AvatarFilter } from './BookingsShared';
import { BookingViewModal } from './BookingViewModal';
import { BookingEditModal } from './BookingEditModal';
import { BookingFlightCard } from './components/BookingFlightCard';
import { BookingGenericCard } from './components/BookingGenericCard';

interface BookingsTabProps {
  trip: Trip;
  initialTab?: 'flight' | 'hotel' | 'transport' | 'general';
}

type SubTab = 'flight' | 'hotel' | 'transport' | 'general';

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
             
             // Simplified log for brevity
             logActivity('update', payload.title, 'Updated booking details');

          } else {
             // Assign a random color if new
             const colors: ThemeColor[] = ['blue', 'green', 'orange'];
             payload.themeColor = colors[Math.floor(Math.random() * colors.length)];
             
             payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
             payload.createdBy = user?.uid; // Security Requirement
             
             await db.collection(`trips/${trip.id}/schedule`).add(payload);
             
             const detailLines = [];
             detailLines.push(`Date: ${payload.date}`);
             detailLines.push(`Time: ${payload.time}`);
             
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
                logActivity('delete', itemToDelete.title, 'Deleted booking');
            }
            setIsEditing(false);
            setViewingItemId(null);
            setEditingItem(null);
        } catch(err) {
            console.error(err);
            alert("Failed to delete. Only the Owner or the Author can delete this item.");
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
              <BookingFlightCard 
                 key={item.id}
                 item={item}
                 onClick={() => setViewingItemId(item.id)}
              />
          ))}

          {/* OTHER TABS (Generic Cards) */}
          {activeTab !== 'flight' && filteredItems.map(item => (
              <BookingGenericCard 
                 key={item.id}
                 item={item}
                 activeTab={activeTab}
                 onClick={() => setViewingItemId(item.id)}
              />
          ))}

      </div>

      {/* Floating Add Button */}
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
         onClose={() => setIsEditing(false)}
         onSave={handleSave}
         onDelete={handleDelete}
         itemToEdit={editingItem}
         trip={trip}
         activeTab={activeTab}
      />
    </div>
  );
};