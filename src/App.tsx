import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './features/auth/Login';
import { TripList } from './features/trips/TripList';
import { ScheduleTab } from './features/schedule/ScheduleTab';
import { MembersTab } from './features/members/MembersTab';
import { BookingsTab } from './features/bookings/BookingsTab'; 
import { ExpensesTab } from './features/expenses/ExpensesTab';
import { TabBar } from './components/ui/TabBar';
import { Screen, TopBar } from './components/ui/Layout';
import { AppTab, Trip } from './types';
import { WifiOff, Loader } from 'lucide-react';
import { db } from './lib/firebase';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  
  // State for Trip Management
  const [tripId, setTripId] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.Schedule);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // New state to control initial sub-tab in Bookings
  const [bookingsInitialTab, setBookingsInitialTab] = useState<'flight' | 'hotel' | 'transport' | 'general' | undefined>(undefined);

  useEffect(() => {
    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Listen to the active trip document
  useEffect(() => {
    if (!tripId) {
        setTrip(null);
        return;
    }

    console.log(`[App] Listening to trip ${tripId}`);
    const unsub = db.collection('trips').doc(tripId).onSnapshot(
        (doc) => {
            if (doc.exists) {
                setTrip({ id: doc.id, ...doc.data() } as Trip);
            } else {
                console.log("[App] Trip document disappeared or deleted.");
                setTripId(null);
                setTrip(null);
            }
        },
        (error) => {
            console.error("[App] Trip listener error:", error);
            // Likely permission denied (e.g. user left trip)
            setTripId(null);
            setTrip(null);
        }
    );

    return () => unsub();
  }, [tripId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4EB]">
        <div className="animate-pulse text-brand font-bold">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // View: Trip List
  if (!tripId) {
    return (
      <div className="relative">
        {isOffline && <OfflineBanner />}
        <TripList onSelectTrip={(t) => {
            // Optimistically set trip to avoid flash of loading
            setTrip(t);
            setTripId(t.id);
        }} />
      </div>
    );
  }

  // View: Loading Trip Data (if accessing directly or slow connection)
  if (!trip) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F4EB] gap-2 text-brand">
             <Loader className="animate-spin" size={32} />
             <span className="font-bold text-sm">Opening Trip...</span>
          </div>
      );
  }

  const handleTabChange = (tab: AppTab, subTab?: any) => {
      if (subTab && tab === AppTab.Bookings) {
          setBookingsInitialTab(subTab);
      }
      setCurrentTab(tab);
  };

  // View: Trip Detail (Tabs)
  return (
    <div className="relative">
      <TopBar 
        title={trip.title} 
        onBack={() => setTripId(null)}
        rightAction={isOffline ? <WifiOff size={18} className="text-gray-400" /> : null}
      />
      
      <Screen>
        {currentTab === AppTab.Schedule && <ScheduleTab trip={trip} onTabChange={handleTabChange} />}
        {currentTab === AppTab.Bookings && <BookingsTab trip={trip} initialTab={bookingsInitialTab} />}
        {currentTab === AppTab.Expenses && <ExpensesTab trip={trip} />}
        {currentTab === AppTab.Members && <MembersTab trip={trip} onTripExit={() => setTripId(null)} />}
        
        {/* Placeholders for other tabs */}
        {(currentTab !== AppTab.Schedule && currentTab !== AppTab.Bookings && currentTab !== AppTab.Expenses && currentTab !== AppTab.Members) && (
             <div className="text-center py-20 opacity-50">
                <div className="text-4xl mb-4">🚧</div>
                <h3 className="font-bold">Coming Soon</h3>
                <p>This tab is under construction.</p>
             </div>
        )}
      </Screen>

      <TabBar currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
};

const OfflineBanner = () => (
  <div className="bg-ink text-white text-xs text-center py-1 sticky top-0 z-[60]">
    You are offline. Changes will sync when connection returns.
  </div>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;