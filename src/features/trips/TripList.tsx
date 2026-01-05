import React, { useEffect, useState } from 'react';
// FIX: Switched to v8 compat style imports
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Trip } from '../../types';
import { Screen, TopBar, Card, Button, Input } from '../../components/ui/Layout';
import { Plus, ChevronRight, MapPin, RefreshCw, AlertTriangle, Loader, Lock } from 'lucide-react';
import { UserMenu } from '../../components/ui/UserMenu';

interface TripListProps {
  onSelectTrip: (trip: Trip) => void;
}

export const TripList: React.FC<TripListProps> = ({ onSelectTrip }) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  
  // Track which trip is currently being joined
  const [joiningTripId, setJoiningTripId] = useState<string | null>(null);
  
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

    const unsubscribe = tripsQuery.onSnapshot((snapshot) => {
      console.log(`[TripList] Realtime update received. Docs: ${snapshot.docs.length}`);
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
    });

    return () => unsubscribe();
  }, [user, retryTrigger]);

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
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
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

      setNewTripTitle('');
      setIsCreating(false);
      setRetryTrigger(prev => prev + 1); // Force refresh
    } catch (err: any) {
      console.error("Create Trip Error:", err);
      alert(`Failed to create trip: ${err.message}`);
    }
  };

  const handleJoinTrip = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user?.email || !joiningTripId) return;

      setLoading(true);
      try {
          // 1. Check if trip exists
          const tripRef = db.collection('trips').doc(joiningTripId);
          const tripDoc = await tripRef.get();
          
          if (!tripDoc.exists) {
              alert("Trip not found. Check the ID.");
              setLoading(false);
              return;
          }

          // 2. Add email to allowlist if not already present
          await tripRef.update({
             allowedEmails: firebase.firestore.FieldValue.arrayUnion(user.email)
          });
          
          // 3. Create Member Record
          await tripRef.collection('members').doc(user.uid).set({
              uid: user.uid,
              email: user.email,
              role: 'editor',
              nickname: user.displayName || user.email.split('@')[0],
              createdAt: new Date().toISOString()
          });

          setJoiningTripId(null);
          setRetryTrigger(prev => prev + 1);
          alert("Joined successfully!");

      } catch (err: any) {
          console.error(err);
          alert("Failed to join: " + err.message);
      } finally {
          setLoading(false);
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
                  placeholder="Trip Name (e.g. Japan 2024)" 
                  value={newTripTitle}
                  onChange={e => setNewTripTitle(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                   <Button type="button" variant="secondary" onClick={() => setIsCreating(false)} className="flex-1">Cancel</Button>
                   <Button type="submit" className="flex-1">Create</Button>
                </div>
             </form>
          </Card>
        ) : (
            <div className="flex gap-2 mb-6">
                <Button onClick={() => setIsCreating(true)} className="flex-1 shadow-md">
                    <Plus size={20} /> New Trip
                </Button>
                <div className="relative flex-1">
                   {joiningTripId === null ? (
                       <Button variant="secondary" onClick={() => setJoiningTripId('')} className="w-full">
                           Join with ID
                       </Button>
                   ) : (
                       <form onSubmit={handleJoinTrip} className="flex gap-2 animate-in fade-in">
                           <input 
                              className="flex-1 min-w-0 bg-white border-2 border-brand rounded-full px-4 text-sm focus:outline-none"
                              placeholder="Trip ID..."
                              value={joiningTripId}
                              onChange={e => setJoiningTripId(e.target.value)}
                              autoFocus
                           />
                           <button type="submit" className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center flex-shrink-0">
                               <ChevronRight size={20} />
                           </button>
                           <button type="button" onClick={() => setJoiningTripId(null)} className="w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0">
                               <Plus size={20} className="rotate-45" />
                           </button>
                       </form>
                   )}
                </div>
            </div>
        )}

        <div className="flex flex-col gap-4">
           {loading && <div className="text-center text-gray-400 py-10 flex flex-col items-center gap-2"><Loader className="animate-spin" /> Loading trips...</div>}
           
           {!loading && trips.length === 0 && !errorState && (
               <div className="text-center py-20 opacity-50">
                   <div className="text-6xl mb-4">🌏</div>
                   <h3 className="font-bold text-gray-500">No trips yet</h3>
                   <p className="text-sm text-gray-400">Create one or join a friend!</p>
               </div>
           )}

           {trips.map(trip => (
             <Card 
                key={trip.id} 
                onClick={() => onSelectTrip(trip)}
                className="group hover:border-brand/50 transition-colors relative overflow-hidden"
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