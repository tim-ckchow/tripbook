import React from 'react';
import { AppTab } from '../../types';
import { Calendar, Users, Map, CheckSquare, BookOpen, CreditCard } from 'lucide-react';

interface TabBarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: AppTab.Schedule, label: 'Plan', icon: Calendar },
    { id: AppTab.Bookings, label: 'Book', icon: Map },
    { id: AppTab.Expenses, label: 'Split', icon: CreditCard },
    { id: AppTab.Journal, label: 'Log', icon: BookOpen },
    { id: AppTab.Planning, label: 'Todo', icon: CheckSquare },
    { id: AppTab.Members, label: 'Team', icon: Users },
  ];

  return (
    // Added pb-[env(safe-area-inset-bottom)] for iPhone home bar
    // Added backdrop-blur for modern feel
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E0E5D5] pb-[env(safe-area-inset-bottom)] pt-2 px-2 z-50 max-w-md mx-auto flex justify-between items-end">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center w-full h-[50px] mb-1 rounded-xl transition-all ${isActive ? 'text-brand -translate-y-1' : 'text-gray-400 active:scale-95'}`}
          >
            <tab.icon size={isActive ? 24 : 20} strokeWidth={2.5} />
            <span className={`text-[10px] font-bold mt-1 ${isActive ? 'text-brand' : 'text-gray-400'}`}>
              {tab.label}
            </span>
            {isActive && <div className="w-1 h-1 bg-brand rounded-full mt-1" />}
          </button>
        );
      })}
    </div>
  );
};