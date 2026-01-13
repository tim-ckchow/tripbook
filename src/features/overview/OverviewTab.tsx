import React, { useEffect, useState } from 'react';
import { Trip, ScheduleItem, TripMember, Transaction, FlightDetails } from '../../types';
import { Calendar, CreditCard } from 'lucide-react';
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { NoticeBoardCard } from '../shared/NoticeBoardCard';

// Components
import { CountdownWidget } from './CountdownWidget';
import { UpNextWidget } from './UpNextWidget';
import { WeatherWidget } from './WeatherWidget';

// Modals
import { ScheduleEditModal } from '../schedule/ScheduleEditModal';
import { TransactionEditModal } from '../expenses/TransactionEditModal';

interface OverviewTabProps {
  trip: Trip;
  onNavigateToSchedule?: (date: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ trip, onNavigateToSchedule }) => {
  const { user } = useAuth();
  
  // Modals State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  
  // Data for Modals
  const [members, setMembers] = useState<TripMember[]>([]);

  // Fetch Members (Needed for Expense Modal)
  useEffect(() => {
    const unsub = db.collection(`trips/${trip.id}/members`).onSnapshot(snap => {
        setMembers(snap.docs.map(doc => doc.data() as TripMember));
    });
    return () => unsub();
  }, [trip.id]);

  // --- SAVE HANDLERS ---
  const handleSavePlan = async (newItem: Partial<ScheduleItem>, flightData: FlightDetails) => {
    try {
      const payload: any = { ...newItem };
      if (newItem.type === 'flight') {
        payload.flightDetails = { ...flightData, arrivalDate: flightData.arrivalDate || newItem.date };
        if (!payload.title) payload.title = `Flight to ${flightData.destination}`;
        delete payload.endDate; 
      } else {
        if (!payload.endDate) payload.endDate = payload.date;
      }
      
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      payload.createdBy = user?.uid;
      
      await db.collection(`trips/${trip.id}/schedule`).add(payload);
      
      // Quick Log
      db.collection(`trips/${trip.id}/logs`).add({
            tripId: trip.id,
            timestamp: new Date().toISOString(),
            category: 'plan',
            action: 'create',
            title: payload.title,
            details: `Quick add from Home`,
            userUid: user?.uid || 'unknown',
            userName: user?.displayName || 'Member'
      });
      
      setIsPlanModalOpen(false);
    } catch (err) { console.error(err); alert("Failed to save plan."); }
  };

  const handleSaveExpense = async (data: Omit<Transaction, 'id' | 'tripId' | 'createdAt' | 'createdBy'>) => {
      try {
          await db.collection(`trips/${trip.id}/transactions`).add({
              ...data,
              tripId: trip.id,
              createdAt: new Date().toISOString(),
              createdBy: user?.uid
          });

           // Quick Log
          db.collection(`trips/${trip.id}/logs`).add({
                tripId: trip.id,
                timestamp: new Date().toISOString(),
                category: 'expense',
                action: 'create',
                title: data.title,
                details: `Amount: ${data.amount} ${data.currency} (Quick Add)`,
                userUid: user?.uid || 'unknown',
                userName: user?.displayName || 'Member'
          });

          setIsExpenseModalOpen(false);
      } catch (err) { console.error(err); alert("Failed to save expense."); }
  };

  return (
    <div className="flex flex-col gap-6 pt-4 pb-32">
        {/* Countdown */}
        <CountdownWidget startDate={trip.startDate} />

        {/* Up Next (Context Aware) */}
        <UpNextWidget tripId={trip.id} onNavigate={onNavigateToSchedule} />

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 gap-3">
             <button 
                onClick={() => setIsPlanModalOpen(true)}
                className="bg-white p-4 rounded-3xl shadow-soft border border-gray-200 flex items-center gap-3 hover:-translate-y-1 transition-transform active:scale-95 text-left"
             >
                 <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                     <Calendar size={20} />
                 </div>
                 <div className="flex-1 min-w-0">
                     <div className="font-bold text-sm text-ink truncate">Add Plan</div>
                     <div className="text-[10px] text-gray-400 font-bold truncate">Schedule activity</div>
                 </div>
             </button>

             <button 
                onClick={() => setIsExpenseModalOpen(true)}
                className="bg-white p-4 rounded-3xl shadow-soft border border-gray-200 flex items-center gap-3 hover:-translate-y-1 transition-transform active:scale-95 text-left"
             >
                 <div className="w-10 h-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center flex-shrink-0">
                     <CreditCard size={20} />
                 </div>
                 <div className="flex-1 min-w-0">
                     <div className="font-bold text-sm text-ink truncate">Split Bill</div>
                     <div className="text-[10px] text-gray-400 font-bold truncate">Add expense</div>
                 </div>
             </button>
        </div>

        {/* Weather */}
        <WeatherWidget trip={trip} />

        {/* Notice Board (Permanent) */}
        <div className="animate-in slide-in-from-bottom-4">
             <div className="flex justify-between items-center px-1 mb-2">
                <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest">Notice Board</h3>
            </div>
            <NoticeBoardCard trip={trip} />
        </div>

        {/* --- MODALS --- */}
        {isPlanModalOpen && (
            <ScheduleEditModal 
                trip={trip}
                itemToEdit={null}
                selectedDate={new Date().toISOString().split('T')[0]} // Default to today for quick add
                onClose={() => setIsPlanModalOpen(false)}
                onSave={handleSavePlan}
                onDelete={async () => {}}
            />
        )}

        <TransactionEditModal 
            isOpen={isExpenseModalOpen}
            onClose={() => setIsExpenseModalOpen(false)}
            onSave={handleSaveExpense}
            itemToEdit={null}
            trip={trip}
            members={members}
        />

    </div>
  );
};