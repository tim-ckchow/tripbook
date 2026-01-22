import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './features/auth/Login';
import { TripList } from './features/trips/TripList';
import { ScheduleTab } from './features/schedule/ScheduleTab';
import { MembersTab } from './features/members/MembersTab';
import { BookingsTab } from './features/bookings/BookingsTab'; 
import { ExpensesTab } from './features/expenses/ExpensesTab';
import { OverviewTab } from './features/overview/OverviewTab';
import { PlanningTab } from './features/planning/PlanningTab';
import { TabBar } from './components/ui/TabBar';
import { Screen, TopBar } from './components/ui/Layout';
import { AppTab, Trip } from './types';
import { WifiOff, Loader } from 'lucide-react';
import { db } from './lib/firebase';
import { UserMenu } from './components/ui/UserMenu';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  
  // State for Trip Management
  const [tripId, setTripId] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.Overview);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Tab State Control
  const [bookingsInitialTab, setBookingsInitialTab] = useState<'flight' | 'hotel' | 'transport' | 'general' | undefined>(undefined);
  const [scheduleInitialDate, setScheduleInitialDate] = useState<string | undefined>(undefined);

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
    
    // CRITICAL UPDATE: { includeMetadataChanges: true }
    // Ensures the Trip Object loads from cache instantly when offline.
    const unsub = db.collection('trips').doc(tripId).onSnapshot(
        { includeMetadataChanges: true },
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

  // AUTO-JOIN: Ensure member document exists if user is allowed
  useEffect(() => {
    if (!trip || !user || !user.email) return;

    // Only attempt to join if I am in the allow list
    if (trip.allowedEmails && trip.allowedEmails.includes(user.email)) {
        const checkAndJoin = async () => {
            try {
                const memberRef = db.collection(`trips/${trip.id}/members`).doc(user.uid);
                const doc = await memberRef.get();
                
                // If doc doesn't exist, create it to move from "Pending" to "Joined"
                if (!doc.exists) {
                    console.log("[App] Auto-joining trip...");
                    await memberRef.set({
                        uid: user.uid,
                        email: user.email,
                        role: 'editor',
                        nickname: user.displayName || user.email?.split('@')[0],
                        createdAt: new Date().toISOString()
                    });
                }
            } catch (err) {
                console.warn("[App] Auto-join check failed:", err);
            }
        };
        checkAndJoin();
    }
  }, [trip?.id, user?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
            setCurrentTab(AppTab.Overview); // Reset to overview on new trip select
            setScheduleInitialDate(undefined);
            setBookingsInitialTab(undefined);
        }} />
      </div>
    );
  }

  // View: Loading Trip Data (if accessing directly or slow connection)
  if (!trip) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-brand">
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
  
  const handleGoToSchedule = (date: string) => {
      setScheduleInitialDate(date);
      setCurrentTab(AppTab.Schedule);
  };

  const handleStandardTabSwitch = (tab: AppTab) => {
      // Clear specific navigational states when user manually switches tabs
      setScheduleInitialDate(undefined);
      setBookingsInitialTab(undefined);
      setCurrentTab(tab);
  };

  // View: Trip Detail (Tabs)
  return (
    <div className="relative">
      <TopBar 
        title={trip.title} 
        onBack={() => setTripId(null)}
        rightAction={
          <div className="flex items-center gap-3">
             {isOffline && <WifiOff size={18} className="text-gray-400" />}
             <UserMenu />
          </div>
        }
      />
      
      <Screen>
        {currentTab === AppTab.Overview && <OverviewTab trip={trip} onNavigateToSchedule={handleGoToSchedule} />}
        {currentTab === AppTab.Schedule && <ScheduleTab trip={trip} onTabChange={handleTabChange} initialDate={scheduleInitialDate} />}
        {currentTab === AppTab.Bookings && <BookingsTab trip={trip} initialTab={bookingsInitialTab} />}
        {currentTab === AppTab.Expenses && <ExpensesTab trip={trip} />}
        {currentTab === AppTab.Members && <MembersTab trip={trip} onTripExit={() => setTripId(null)} />}
        {currentTab === AppTab.Planning && <PlanningTab trip={trip} />}
      </Screen>

      <TabBar currentTab={currentTab} onTabChange={handleStandardTabSwitch} />
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
