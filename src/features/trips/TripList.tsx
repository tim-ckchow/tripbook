import React, { useEffect, useState } from 'react';
// FIX: Switched to v8 compat style imports
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Trip } from '../../types';
import { Screen, TopBar, Card, Button, Input } from '../../components/ui/Layout';
import { Plus, MapPin, RefreshCw, AlertTriangle, Loader, WifiOff } from 'lucide-react';
import { UserMenu } from '../../components/ui/UserMenu';

interface TripListProps {
  onSelectTrip: (trip: Trip) => void;
}

export const TripList: React.FC<TripListProps> = ({ onSelectTrip }) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  
  // Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  
  // This state is used to force-restart the listener after a creation or manual retry
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Firestore Subscription
  useEffect(() => {
    if (!user?.uid || !user?.email) return;

    setLoading(true);
    setErrorState(null);
    console.log(`[TripList] Starting realtime listener...`);

    // UPDATED QUERY: Find trips where this user's email is allowed.
    const tripsQuery = db.collection('trips')
      .where('allowedEmails', 'array-contains', user.email);

    // CRITICAL UPDATE: { includeMetadataChanges: true }
    // This forces the listener to fire immediately with cached data (fromCache: true)
    // instead of waiting for the network. This makes the app work offline.
    const unsubscribe = tripsQuery.onSnapshot(
      { includeMetadataChanges: true },
      (snapshot) => {
        console.log(`[TripList] Realtime update received. Docs: ${snapshot.docs.length}. From Cache: ${snapshot.metadata.fromCache}`);
        setErrorState(null); 
        
        const tripsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Trip[];

        // Sort by start date descending
        tripsData.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        
        setTrips(tripsData);
        setLoading(false);

      }, (error: any) => {
        console.error("[TripList] ❌ SNAPSHOT ERROR:", error);
        
        setLoading(false);
        
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
          setErrorState({
            code: 'missing-index',
            message: "Database index missing. Please check browser console for the creation link."
          });
        } else if (error.code === 'permission-denied') {
          setErrorState({
            code: 'permission-denied',
            message: "You don't have permission to view these trips."
          });
        } else {
          setErrorState({
            code: 'unknown',
            message: error.message || "Unknown error occurred"
          });
        }
      }
    );

    return () => unsubscribe();
  }, [user, retryTrigger]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStart = e.target.value;
      setStartDate(newStart);
      // If new start date is after current end date, push end date forward
      if (newStart > endDate) {
          setEndDate(newStart);
      }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !newTripTitle.trim()) return;

    console.log("[TripList] Creating new trip...");

    try {
      // 1. Create Trip Document
      const newTripRef = db.collection('trips').doc();
      const tripData = {
        ownerUid: user.uid,
        title: newTripTitle,
        startDate: startDate,
        endDate: endDate,
        baseCurrency: 'JPY',
        allowedEmails: [user.email],
        createdAt: new Date().toISOString()
      };
      
      await newTripRef.set(tripData);
      
      // 2. Add Owner as Member immediately
      await newTripRef.collection('members').doc(user.uid).set({
        uid: user.uid,
        email: user.email,
        role: 'owner',
        nickname: user.displayName || user.email.split('@')[0],
        createdAt: new Date().toISOString()
      });

      // Reset form
      setNewTripTitle('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
      setIsCreating(false);
      
      setRetryTrigger(prev => prev + 1); // Force refresh
    } catch (err: any) {
      console.error("Create Trip Error:", err);
      alert(`Failed to create trip: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar title="My Trips" rightAction={<UserMenu />} />
      
      <Screen className="pt-24 pb-10">
        
        {errorState && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-red-600 font-bold">
                    <AlertTriangle size={20} /> Error
                </div>
                <p className="text-sm text-gray-600">{errorState.message}</p>
                {errorState.code === 'missing-index' && (
                    <div className="text-xs bg-white p-2 rounded border border-gray-200 mt-2">
                        Open your browser console (F12) to see the Firebase link to create the required index.
                    </div>
                )}
                <Button variant="secondary" onClick={() => setRetryTrigger(p => p + 1)} className="mt-2 text-xs h-8">
                    <RefreshCw size={14} /> Retry
                </Button>
            </div>
        )}

        {/* Create Trip Section */}
        {isCreating ? (
          <Card className="mb-6 animate-in slide-in-from-top-4">
             <h3 className="font-bold text-lg mb-4">Start New Trip</h3>
             <form onSubmit={handleCreateTrip} className="flex flex-col gap-4">
                <Input 
                  label="Trip Name"
                  placeholder="e.g. Japan 2024" 
                  value={newTripTitle}
                  onChange={e => setNewTripTitle(e.target.value)}
                  autoFocus
                />
                
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <Input 
                        label="Start Date"
                        type="date"
                        value={startDate}
                        onChange={handleStartDateChange}
                        required
                    />
                    <Input 
                        label="End Date"
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={e => setEndDate(e.target.value)}
                        required
                    />
                </div>

                <div className="flex gap-2 mt-2">
                   <Button type="button" variant="secondary" onClick={() => setIsCreating(false)} className="flex-1">Cancel</Button>
                   <Button type="submit" className="flex-1">Create</Button>
                </div>
             </form>
          </Card>
        ) : (
            <div className="mb-6">
                <Button onClick={() => setIsCreating(true)} className="w-full shadow-md">
                    <Plus size={20} /> New Trip
                </Button>
            </div>
        )}

        <div className="flex flex-col gap-4">
           {loading && <div className="text-center text-gray-400 py-10 flex flex-col items-center gap-2"><Loader className="animate-spin" /> Loading trips...</div>}
           
           {!loading && trips.length === 0 && !errorState && (
               <div className="text-center py-20 opacity-50">
                   <div className="text-6xl mb-4">🌏</div>
                   <h3 className="font-bold text-gray-500">No trips yet</h3>
                   <p className="text-sm text-gray-400">Create one or ask a friend to invite you!</p>
               </div>
           )}

           {trips.map(trip => (
             <Card 
                key={trip.id} 
                onClick={() => onSelectTrip(trip)}
                className="group hover:border-brand/50 transition-colors relative overflow-hidden cursor-pointer"
             >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <MapPin size={60} className="text-brand rotate-12" />
                </div>
                <div className="relative z-10">
                    <h3 className="font-bold text-xl text-ink font-rounded mb-1">{trip.title}</h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                        <span>{new Date(trip.startDate).getFullYear()}</span>
                        <span>•</span>
                        <span>{trip.allowedEmails?.length || 1} Travelers</span>
                        {trip.ownerUid === user?.uid && <span className="text-brand bg-brand/10 px-1.5 py-0.5 rounded">Owner</span>}
                    </div>
                    
                    <div className="flex gap-2">
                        <div className="bg-yellow-100 text-yellow-700 text-[10px] font-bold w-8 h-8 rounded-full flex items-center justify-center border border-yellow-200 shadow-sm">
                            {trip.title[0]}
                        </div>
                        {trip.allowedEmails.length > 1 && (
                            <div className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 h-8 rounded-full flex items-center justify-center border border-gray-200">
                                +{trip.allowedEmails.length - 1}
                            </div>
                        )}
                    </div>
                </div>
             </Card>
           ))}
        </div>
      </Screen>
    </div>
  );
};
