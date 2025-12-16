import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './features/auth/Login';
import { TripList } from './features/trips/TripList';
import { ScheduleTab } from './features/schedule/ScheduleTab';
import { MembersTab } from './features/members/MembersTab';
import { BookingsTab } from './features/bookings/BookingsTab'; // Import BookingsTab
import { TabBar } from './components/ui/TabBar';
import { Screen, TopBar } from './components/ui/Layout';
import { AppTab, Trip } from './types';
import { WifiOff } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.Schedule);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

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
  if (!selectedTrip) {
    return (
      <div className="relative">
        {isOffline && <OfflineBanner />}
        <TripList onSelectTrip={setSelectedTrip} />
      </div>
    );
  }

  // View: Trip Detail (Tabs)
  return (
    <div className="relative">
      <TopBar 
        title={selectedTrip.title} 
        onBack={() => setSelectedTrip(null)}
        rightAction={isOffline ? <WifiOff size={18} className="text-gray-400" /> : null}
      />
      
      <Screen>
        {currentTab === AppTab.Schedule && <ScheduleTab trip={selectedTrip} onTabChange={setCurrentTab} />}
        {currentTab === AppTab.Bookings && <BookingsTab trip={selectedTrip} />}
        {currentTab === AppTab.Members && <MembersTab trip={selectedTrip} onTripExit={() => setSelectedTrip(null)} />}
        {/* Placeholders for other tabs */}
        {(currentTab !== AppTab.Schedule && currentTab !== AppTab.Bookings && currentTab !== AppTab.Members) && (
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