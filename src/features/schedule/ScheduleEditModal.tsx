import React, { useState, useEffect } from 'react';
import { ScheduleItem, ScheduleType, FlightDetails, Trip } from '../../types';
import { Button, Input } from '../../components/ui/Layout';
import { Plane, X, Trash2 } from 'lucide-react';
import { TypeIcon } from './ScheduleShared';
import { useAuth } from '../../context/AuthContext';

interface ScheduleEditModalProps {
  trip: Trip;
  itemToEdit: ScheduleItem | null; // null means adding new
  selectedDate: string; // Used for default date if adding
  onSave: (item: Partial<ScheduleItem>, flightData: FlightDetails) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export const ScheduleEditModal: React.FC<ScheduleEditModalProps> = ({ 
  trip, itemToEdit, selectedDate, onSave, onDelete, onClose 
}) => {
  const { user } = useAuth();
  
  // State initialization
  const [newItem, setNewItem] = useState<Partial<ScheduleItem>>({
    type: 'sightseeing',
    date: selectedDate,
    endDate: selectedDate,
    time: '09:00',
    endTime: '',
    title: '',
    notes: '',
    locationLink: '',
    participants: user?.email ? [user.email] : trip.allowedEmails
  });
  
  const [flightData, setFlightData] = useState<FlightDetails>({
    flightNumber: '', origin: 'ABC', destination: 'XYZ', arrivalTime: '', seat: '', arrivalDate: selectedDate
  });

  // Populate state on mount/change
  useEffect(() => {
    if (itemToEdit) {
      setNewItem({
        type: itemToEdit.type,
        date: itemToEdit.date,
        endDate: itemToEdit.endDate || itemToEdit.date,
        time: itemToEdit.time,
        endTime: itemToEdit.endTime || '',
        title: itemToEdit.title,
        notes: itemToEdit.notes || '',
        locationLink: itemToEdit.locationLink || '',
        participants: itemToEdit.participants || []
      });
      if (itemToEdit.flightDetails) {
        setFlightData({ ...itemToEdit.flightDetails });
      } else {
        // Fallback flight data
        setFlightData({ 
            flightNumber: '', origin: 'ABC', destination: 'XYZ', arrivalTime: '', 
            seat: '', arrivalDate: itemToEdit.date 
        });
      }
    } else {
      // Reset for new item
      setNewItem(prev => ({ 
          ...prev, 
          date: selectedDate, 
          endDate: selectedDate,
          type: 'sightseeing',
          title: '', notes: '', locationLink: '', time: '09:00', endTime: '',
          participants: user?.email ? [user.email] : trip.allowedEmails
      }));
      setFlightData({ 
          flightNumber: '', origin: 'ABC', destination: 'XYZ', arrivalTime: '', 
          seat: '', arrivalDate: selectedDate 
      });
    }
  }, [itemToEdit, selectedDate, trip.allowedEmails, user?.email]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(newItem, flightData);
  };

  const toggleParticipant = (email: string) => {
    const current = newItem.participants || [];
    if (current.includes(email)) {
      setNewItem({ ...newItem, participants: current.filter(e => e !== email) });
    } else {
      setNewItem({ ...newItem, participants: [...current, email] });
    }
  };

  const editingId = itemToEdit?.id;

  return (
    <div className="fixed inset-0 bg-ink/20 z-[100] flex items-end sm:items-center justify-center backdrop-blur-sm sm:p-4">
       <div className="bg-white w-full max-w-md max-h-[90dvh] h-auto rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col animate-in slide-in-from-bottom-10 overflow-hidden pb-[env(safe-area-inset-bottom)]">
          
          <div className="p-4 border-b border-[#E0E5D5] flex justify-between items-center bg-[#F7F4EB]">
             <h3 className="font-bold text-lg font-rounded">{editingId ? 'Edit Plan' : 'New Plan'}</h3>
             <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-[#E0E5D5] flex items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors">
                <X size={18} />
             </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 no-scrollbar">
              <form id="schedule-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                 
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

                 {newItem.type === 'flight' ? (
                     <div className="grid grid-cols-2 gap-4">
                        <Input label="Departure Date" type="date" required value={newItem.date} onChange={e => setNewItem({ ...newItem, date: e.target.value })} />
                        <Input label="Departure Time" type="time" required value={newItem.time} onChange={e => setNewItem({ ...newItem, time: e.target.value })} />
                     </div>
                 ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Start Date" type="date" required value={newItem.date} onChange={e => setNewItem({ ...newItem, date: e.target.value })} />
                            <Input label="Start Time" type="time" required value={newItem.time} onChange={e => setNewItem({ ...newItem, time: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-2 rounded-xl border border-dashed border-gray-200">
                            <Input label="End Date" type="date" value={newItem.endDate} onChange={e => setNewItem({ ...newItem, endDate: e.target.value })} />
                            <Input label="End Time" type="time" value={newItem.endTime || ''} onChange={e => setNewItem({ ...newItem, endTime: e.target.value })} />
                        </div>
                    </>
                 )}

                 {newItem.type === 'flight' ? (
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col gap-3">
                       <div className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-1"><Plane size={14}/> Flight Details</div>
                       <div className="grid grid-cols-2 gap-3">
                          <Input label="Flight #" placeholder="AA123" value={flightData.flightNumber} onChange={e => setFlightData({...flightData, flightNumber: e.target.value})} />
                          <Input label="Seat" placeholder="12A" value={flightData.seat} onChange={e => setFlightData({...flightData, seat: e.target.value})} />
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                          <Input label="From (Code)" placeholder="SFO" maxLength={3} className="uppercase" value={flightData.origin} onChange={e => setFlightData({...flightData, origin: e.target.value.toUpperCase()})} />
                          <Input label="To (Code)" placeholder="JFK" maxLength={3} className="uppercase" value={flightData.destination} onChange={e => setFlightData({...flightData, destination: e.target.value.toUpperCase()})} />
                       </div>
                       <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-200 border-dashed">
                           <Input label="Arrival Date" type="date" value={flightData.arrivalDate} onChange={e => setFlightData({...flightData, arrivalDate: e.target.value})} />
                           <Input label="Arrival Time" type="time" value={flightData.arrivalTime} onChange={e => setFlightData({...flightData, arrivalTime: e.target.value})} />
                       </div>
                    </div>
                 ) : (
                    <Input label="Activity Name" placeholder="e.g. Visit Tokyo Tower" required value={newItem.title} onChange={e => setNewItem({ ...newItem, title: e.target.value })} />
                 )}

                 <Input 
                    label="Location Link (Google Maps)"
                    placeholder="https://maps.google.com/..."
                    value={newItem.locationLink || ''} 
                    onChange={e => setNewItem({ ...newItem, locationLink: e.target.value })}
                 />

                 <Input 
                    label="Notes"
                    placeholder="Details, reservation #..."
                    value={newItem.notes} 
                    onChange={e => setNewItem({ ...newItem, notes: e.target.value })}
                 />
                 
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-gray-500 ml-3 uppercase tracking-wider text-[10px]">Who's Going?</label>
                   <div className="flex flex-wrap gap-2">
                      <button 
                        type="button"
                        onClick={() => setNewItem({ ...newItem, participants: trip.allowedEmails })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${newItem.participants?.length === trip.allowedEmails.length ? 'bg-ink text-white border-ink' : 'bg-white text-gray-400 border-dashed border-gray-300'}`}
                      >
                         Everyone
                      </button>
                      {trip.allowedEmails.map(email => {
                        const isSelected = newItem.participants?.includes(email);
                        return (
                            <button 
                            key={email} type="button" onClick={() => toggleParticipant(email)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${isSelected ? 'bg-brand/10 text-brand border-brand' : 'bg-white text-gray-400 border-gray-100'}`}
                            >
                            {email.split('@')[0]}
                            </button>
                        );
                      })}
                   </div>
                 </div>
                 <div className="h-4"></div>
              </form>
          </div>

          <div className="p-4 border-t border-[#E0E5D5] bg-[#F7F4EB] flex gap-3">
             {editingId && (
                 <button type="button" onClick={() => onDelete(editingId)} className="w-12 h-12 rounded-full border-2 border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50 transition-colors"><Trash2 size={20} /></button>
             )}
             <Button type="submit" form="schedule-form" className="flex-1">
                {editingId ? 'Save Changes' : 'Add to Schedule'}
             </Button>
          </div>

       </div>
    </div>
  );
};