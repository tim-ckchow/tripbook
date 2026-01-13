import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { Trip, LogEntry, LogCategory } from '../../types';
import { Card } from '../../components/ui/Layout';
import { Calendar, Map, CreditCard, Users, Clock, Plus, Edit2, Trash2, BookOpen } from 'lucide-react';

interface TripActivityLogProps {
  trip: Trip;
}

export const TripActivityLog: React.FC<TripActivityLogProps> = ({ trip }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LogCategory | 'all'>('all');

  useEffect(() => {
    setLoading(true);
    const unsub = db.collection(`trips/${trip.id}/logs`)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as LogEntry[];
        setLogs(data);
        setLoading(false);
      });
    return () => unsub();
  }, [trip.id]);

  const filteredLogs = logs.filter(log => filter === 'all' || log.category === filter);

  const getIcon = (category: LogCategory) => {
    switch(category) {
      case 'plan': return <Calendar size={14} className="text-blue-500" />;
      case 'booking': return <Map size={14} className="text-purple-500" />;
      case 'expense': return <CreditCard size={14} className="text-green-500" />;
      case 'member': return <Users size={14} className="text-orange-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch(action) {
      case 'create': return 'bg-green-100 text-green-600 border-green-200';
      case 'update': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'delete': return 'bg-red-100 text-red-600 border-red-200';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getActionIcon = (action: string) => {
    switch(action) {
        case 'create': return <Plus size={8} />;
        case 'update': return <Edit2 size={8} />;
        case 'delete': return <Trash2 size={8} />;
    }
  };

  const formatTime = (iso: string) => {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return timeStr;
      
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
  };

  return (
    <Card className="flex flex-col gap-4 max-h-[500px] shadow-sm border border-gray-200">
      <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 p-1.5 rounded-lg text-purple-600">
                <BookOpen size={16} />
            </div>
            <h3 className="font-bold text-lg text-ink">Activity Log</h3>
          </div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
              Recent 50
          </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(['all', 'plan', 'booking', 'expense', 'member'] as const).map(cat => (
           <button
             key={cat}
             onClick={() => setFilter(cat)}
             className={`px-3 py-1 rounded-lg border text-[10px] font-bold capitalize transition-all whitespace-nowrap ${filter === cat ? 'bg-ink text-white border-ink' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'}`}
           >
             {cat === 'all' ? 'All' : cat}
           </button>
        ))}
      </div>

      <div className="overflow-y-auto pr-2 -mr-2 flex flex-col gap-0 min-h-[200px]">
        {loading && <div className="text-center text-gray-400 py-10 text-xs">Loading history...</div>}

        {!loading && filteredLogs.length === 0 && (
            <div className="text-center py-10 opacity-50 flex flex-col items-center">
                <Clock size={32} className="mb-2 text-gray-300" />
                <h3 className="font-bold text-gray-400 text-sm">No activity</h3>
            </div>
        )}

        {filteredLogs.map((log) => (
             <div key={log.id} className="flex gap-3 py-3 border-b border-gray-50 last:border-0 relative group hover:bg-gray-50/50 rounded-lg px-2 transition-colors">
                 
                 <div className="relative z-10 flex flex-col items-center gap-1 mt-0.5">
                     <div className="w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                         {getIcon(log.category)}
                     </div>
                 </div>

                 <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start mb-0.5">
                         <h4 className="font-bold text-ink text-xs leading-tight truncate pr-2">{log.title}</h4>
                         <div className="text-[9px] text-gray-400 font-mono whitespace-nowrap">
                             {formatTime(log.timestamp)}
                         </div>
                     </div>
                     
                     <div className="flex items-center gap-2 mb-1">
                        <div className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 w-fit ${getActionColor(log.action)}`}>
                            {getActionIcon(log.action)} {log.action}
                        </div>
                        <span className="text-[9px] text-gray-400 font-bold">by {log.userName}</span>
                     </div>

                     <p className="text-[10px] text-gray-500 leading-relaxed font-mono truncate opacity-80">
                         {log.details.split('\n')[0]}
                         {log.details.includes('\n') && '...'}
                     </p>
                 </div>
             </div>
        ))}
      </div>
    </Card>
  );
};
