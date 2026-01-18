import React, { useState } from 'react';
import { Trip } from '../../types';
import { TeamTodoList } from './components/TeamTodoList';
import { PrivateTodoList } from './components/PrivateTodoList';

interface PlanningTabProps {
  trip: Trip;
}

export const PlanningTab: React.FC<PlanningTabProps> = ({ trip }) => {
  const [activeTab, setActiveTab] = useState<'team' | 'private'>('team');

  return (
    <div className="pb-24 pt-4 flex flex-col gap-6">
      
      {/* Tab Switcher */}
      <div className="bg-gray-100 p-1 rounded-2xl flex relative">
          <button 
              onClick={() => setActiveTab('team')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all z-10 ${activeTab === 'team' ? 'bg-white text-ink shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
          >
              Shared List
          </button>
          <button 
              onClick={() => setActiveTab('private')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all z-10 ${activeTab === 'private' ? 'bg-white text-ink shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
          >
              My Notes
          </button>
      </div>

      {activeTab === 'team' ? (
          <TeamTodoList trip={trip} />
      ) : (
          <PrivateTodoList trip={trip} />
      )}
      
    </div>
  );
};
