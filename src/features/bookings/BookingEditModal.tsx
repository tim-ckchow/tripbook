import React, { useState, useEffect } from 'react';
import { ScheduleItem, FlightDetails, Trip } from '../../types';
import { Button, Input } from '../../components/ui/Layout';
import { X, Trash2 } from 'lucide-react';

interface BookingEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (editForm: Partial<ScheduleItem>, flightForm: FlightDetails) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  itemToEdit: ScheduleItem | null;
  trip: Trip;
  activeTab: 'flight' | 'hotel' | 'transport' | 'general';
}

export const BookingEditModal: React.FC<BookingEditModalProps> = ({ 
  isOpen, onClose, onSave, onDelete, itemToEdit, trip, activeTab 
}) => {
  if (!isOpen) return null;

  const editingId = itemToEdit?.id;

  const [editForm, setEditForm] = useState<Partial<ScheduleItem>>({});
  const [flightForm, setFlightForm] = useState<FlightDetails>({
      flightNumber: '', origin: '', destination: '', arrivalTime: '', 
      seat: '', terminal: '', gate: '', bookingReference: '', 
      checkInTime: '', baggageAllowanceKg: '', arrivalDate: ''
  });

  useEffect(() => {
    if (itemToEdit) {
      setEditForm({
          type: itemToEdit.type,
          date: itemToEdit.date,
          endDate: itemToEdit.endDate || itemToEdit.date,
          time: itemToEdit.time,
          endTime: itemToEdit.endTime || '',
          participants: itemToEdit.participants || trip.allowedEmails,
          notes: itemToEdit.notes,
          title: itemToEdit.title,
          locationLink: itemToEdit.locationLink
      });
      if (itemToEdit.type === 'flight' && itemToEdit.flightDetails) {
          setFlightForm({ ...itemToEdit.flightDetails });
      } else {
        setFlightForm({
            flightNumber: '', origin: '', destination: '', arrivalTime: '', 
            seat: '', terminal: '', gate: '', bookingReference: '', 
            checkInTime: '', baggageAllowanceKg: '', arrivalDate: itemToEdit.date
        });
      }
    } else {
      setEditForm({
        type: activeTab === 'general' ? 'sightseeing' : activeTab,
        date: trip.startDate,
        endDate: trip.startDate,
        time: '12:00',
        endTime: '',
        participants: trip.allowedEmails,
        title: '',
        notes: '',
        locationLink: ''
      });
      setFlightForm({
        flightNumber: '', origin: '', destination: '', arrivalTime: '', 
        seat: '', terminal: '', gate: '', bookingReference: '', 
        checkInTime: '', baggageAllowanceKg: '', arrivalDate: trip.startDate
      });
    }
  }, [itemToEdit, activeTab, trip.startDate, trip.allowedEmails]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editForm, flightForm);
  };

  const toggleParticipant = (email: string) => {
    const current = editForm.participants || [];
    if (current.includes(email)) {
      setEditForm({ ...editForm, participants: current.filter(e => e !== email) });
    } else {
      setEditForm({ ...editForm, participants: [...current, email] });
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/20 z-[100] flex items-end sm:items-center justify-center backdrop-blur-sm sm:p-4">
       <div className="bg-white w-full max-w-md max-h-[90dvh] h-auto rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col animate-in slide-in-from-bottom-10 overflow-hidden pb-[env(safe-area-inset-bottom)]">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
             <h3 className="font-bold text-lg font-rounded">{editingId ? 'Edit Booking' : 'Add Booking'}</h3>
             <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500">
                <X size={18} />
             </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 no-scrollbar">
              <form id="booking-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                  
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
                    label="Location Link (Google Maps)" 
                    placeholder="https://maps.google.com/..."
                    value={editForm.locationLink || ''} 
                    onChange={e => setEditForm({...editForm, locationLink: e.target.value})} 
                  />

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

          <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              {editingId && (
                 <button type="button" onClick={() => onDelete(editingId)} className="w-12 h-12 rounded-full border-2 border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50 transition-colors"><Trash2 size={20} /></button>
              )}
              <Button type="submit" form="booking-form" className="w-full">
                  {editingId ? 'Save Changes' : 'Add Booking'}
              </Button>
          </div>
       </div>
    </div>
  );
};