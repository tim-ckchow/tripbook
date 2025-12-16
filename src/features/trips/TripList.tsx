import React, { useEffect, useState } from 'react';
// FIX: Switched to v8 compat style imports
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Trip } from '../../types';
import { Screen, TopBar, Card, Button, Input } from '../../components/ui/Layout';
import { Plus, ChevronRight, MapPin, RefreshCw, AlertTriangle, Loader, Lock } from 'lucide-react';

interface TripListProps {
  onSelectTrip: (trip: Trip) => void;
}

export const TripList: React.FC<TripListProps> = ({ onSelectTrip }) => {
  const { user, logout } = useAuth();
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
        baseCurrency: 'USD',
        allowedEmails: [user.email], 
        createdAt: new Date().toISOString(),
      };
      await newTripRef.set(tripData);
      console.log(`[TripList] Trip doc created: ${newTripRef.id}`);

      // 2. Create Member Document (Owner)
      const memberRef = newTripRef.collection('members').doc(user.uid);
      const memberData = {
        uid: user.uid,
        email: user.email,
        role: 'owner',
        nickname: user.displayName || user.email.split('@')[0],
        createdAt: new Date().toISOString()
      };
      await memberRef.set(memberData);

      setNewTripTitle('');
      setIsCreating(false);
      setRetryTrigger(prev => prev + 1);

    } catch (err) {
      console.error("Error creating trip:", err);
      alert("Could not create trip. Check console for details.");
    }
  };

  const handleTripSelection = async (trip: Trip) => {
      if (!user) return;
      
      // Indicate joining process
      setJoiningTripId(trip.id);

      // Auto-Join: Ensure the user has a member document when they enter the trip.
      // This solves the issue of the owner not knowing the UID. 
      // The user adds their OWN UID here.
      try {
          const memberRef = db.collection(`trips/${trip.id}/members`).doc(user.uid);
          const memberSnap = await memberRef.get();
          
          if (!memberSnap.exists) {
              await memberRef.set({
                  uid: user.uid,
                  email: user.email,
                  role: 'editor', // Default role for added members
                  nickname: user.displayName || user.email?.split('@')[0],
                  createdAt: new Date().toISOString()
              });
              console.log("Joined trip successfully.");
          }
      } catch (err) {
          console.error("Auto-join failed:", err);
          // We proceed anyway because if the rules allow 'isEmailAllowed', they can still view partial data.
          // But usually this write should succeed.
      } finally {
          setJoiningTripId(null);
          onSelectTrip(trip);
      }
  };

  const handleRetry = () => {
    setLoading(true);
    setErrorState(null);
    setRetryTrigger(prev => prev + 1);
  };

  // --- ERROR STATE VIEWS ---

  if (errorState?.code === 'missing-index') {
    return (
      <Screen className="flex flex-col items-center justify-center h-[80vh] text-center px-6">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">Configuration Required</h2>
        <p className="text-gray-600 mb-6">
          The database requires a specific index to load your trips.
        </p>
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-left text-sm text-orange-800 mb-8 w-full">
          <strong>Action Required:</strong>
          <ol className="list-decimal ml-4 mt-2 space-y-2">
            <li>Open your browser's Developer Tools (F12).</li>
            <li>Look for a red error message with a link.</li>
            <li>Click the link to create the index.</li>
          </ol>
        </div>
        <Button onClick={handleRetry} className="w-full max-w-xs">
          <RefreshCw size={18} /> Retry Connection
        </Button>
      </Screen>
    );
  }

  // Permission Denied View (Matches "Coming Soon" style)
  if (errorState?.code === 'permission-denied') {
      return (
          <Screen className="flex flex-col items-center justify-center h-[80vh] text-center px-6">
              <div className="text-center py-20 opacity-50">
                <div className="text-4xl mb-4 flex justify-center"><Lock size={48} /></div>
                <h3 className="font-bold text-xl mb-2">Access Restricted</h3>
                <p className="max-w-[250px] mx-auto mb-6">
                    You do not have permission to view these trips or the database rules are currently restricting access.
                </p>
                <div className="flex flex-col gap-3 items-center">
                    <button onClick={handleRetry} className="text-sm font-bold underline">Try Again</button>
                    <button onClick={logout} className="text-xs font-bold text-red-400">Logout</button>
                </div>
             </div>
          </Screen>
      );
  }

  return (
    <>
    
      <TopBar 
        title="My Trips" 
        rightAction={
          <button onClick={logout} className="text-sm font-bold text-gray-400">Logout</button>
        } 
      />
      <Screen className="flex flex-col gap-6">
        {loading ? (
           <div className="text-center text-gray-400 py-10 flex flex-col items-center gap-2">
             <RefreshCw className="animate-spin" size={20}/>
             <span>Loading trips...</span>
           </div>
        ) : (
          <>
            {errorState && (
               <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm flex flex-col gap-2">
                  <div className="font-bold flex items-center gap-2"><AlertTriangle size={16}/> Error loading trips</div>
                  <div>{errorState.message}</div>
                  <Button variant="secondary" onClick={handleRetry} className="self-start py-2 h-auto text-xs">Retry</Button>
               </div>
            )}

            {!errorState && trips.length === 0 && !isCreating && (
              <div className="text-center py-10 px-6">
                <div className="text-6xl mb-4">🌏</div>
                <h3 className="font-bold text-xl text-ink mb-2">No trips yet!</h3>
                <p className="text-gray-500 mb-6">
                  {/* Inform user about old data visibility issue */}
                  If you have old trips, they may be hidden until they are migrated to the new format.
                  <br/><br/>
                  Start a new adventure below.
                </p>
                <Button onClick={() => setIsCreating(true)}>Plan a New Trip</Button>
              </div>
            )}

            {trips.map(trip => (
              <Card 
                key={trip.id} 
                onClick={() => !joiningTripId && handleTripSelection(trip)}
                className={`group relative overflow-hidden transition-all ${joiningTripId === trip.id ? 'opacity-80 scale-95' : ''}`}
              >
                {joiningTripId === trip.id && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 flex items-center justify-center gap-2 font-bold text-brand">
                        <Loader className="animate-spin" size={20} /> Joining...
                    </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-ink">{trip.title}</h3>
                    <div className="flex items-center gap-1 text-gray-400 text-sm font-medium mt-1">
                      <MapPin size={14} />
                      <span>{trip.startDate}</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand group-active:scale-90 transition-transform">
                    <ChevronRight size={20} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   {/* Simple avatar pile based on allowed emails */}
                   <div className="flex -space-x-2">
                      {trip.allowedEmails.slice(0, 4).map((email, i) => (
                          <div key={i} className="w-8 h-8 rounded-full bg-yellow-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-ink uppercase">
                              {email[0]}
                          </div>
                      ))}
                      {trip.allowedEmails.length > 4 && (
                          <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-500">
                              +{trip.allowedEmails.length - 4}
                          </div>
                      )}
                   </div>
                </div>
              </Card>
            ))}
          </>
        )}

        {isCreating ? (
          <Card className="border-brand">
            <form onSubmit={handleCreateTrip} className="flex flex-col gap-4">
              <h3 className="font-bold text-lg">New Adventure</h3>
              <Input 
                autoFocus
                placeholder="Where are we going?" 
                value={newTripTitle}
                onChange={e => setNewTripTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsCreating(false)} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1">Create</Button>
              </div>
            </form>
          </Card>
        ) : (
          !loading && trips.length > 0 && (
            <button 
              onClick={() => setIsCreating(true)}
              className="flex items-center justify-center gap-2 p-4 text-gray-400 font-bold border-2 border-dashed border-[#E0E5D5] rounded-3xl hover:bg-white/50 active:scale-95 transition-all"
            >
              <Plus size={20} /> Create New Trip
            </button>
          )
        )}
      </Screen>
    </>
  );
};