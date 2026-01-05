import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { Trip, LogEntry, LogCategory } from '../../types';
import { Card } from '../../components/ui/Layout';
import { Calendar, Map, CreditCard, Users, Clock, Filter, Plus, Edit2, Trash2 } from 'lucide-react';

interface LogTabProps {
  trip: Trip;
}

export const LogTab: React.FC<LogTabProps> = ({ trip }) => {
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
      case 'plan': return <Calendar size={16} className="text-blue-500" />;
      case 'booking': return <Map size={16} className="text-purple-500" />;
      case 'expense': return <CreditCard size={16} className="text-green-500" />;
      case 'member': return <Users size={16} className="text-orange-500" />;
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
        case 'create': return <Plus size={10} />;
        case 'update': return <Edit2 size={10} />;
        case 'delete': return <Trash2 size={10} />;
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
    <div className="pb-24 pt-4 flex flex-col gap-4">
      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
        {(['all', 'plan', 'booking', 'expense', 'member'] as const).map(cat => (
           <button
             key={cat}
             onClick={() => setFilter(cat)}
             className={`px-4 py-2 rounded-full border-2 text-xs font-bold capitalize transition-all whitespace-nowrap ${filter === cat ? 'bg-ink text-white border-ink' : 'bg-white text-gray-400 border-gray-200'}`}
           >
             {cat === 'all' ? 'All Activity' : cat + 's'}
           </button>
        ))}
      </div>

      {loading && <div className="text-center text-gray-400 py-10">Loading history...</div>}

      {!loading && filteredLogs.length === 0 && (
          <div className="text-center py-20 opacity-50 flex flex-col items-center">
              <Clock size={40} className="mb-4 text-gray-300" />
              <h3 className="font-bold text-gray-400">No activity yet</h3>
              <p className="text-xs text-gray-300 mt-1">Changes made to the trip will appear here.</p>
          </div>
      )}

      <div className="flex flex-col gap-4">
          {filteredLogs.map((log) => (
             <Card key={log.id} className="flex gap-4 relative overflow-hidden">
                 {/* Timeline Line */}
                 <div className="absolute left-[27px] top-10 bottom-0 w-[2px] bg-gray-100 -z-0"></div>

                 <div className="relative z-10 flex flex-col items-center gap-1">
                     <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-100 shadow-sm flex items-center justify-center">
                         {getIcon(log.category)}
                     </div>
                 </div>

                 <div className="flex-1 pt-1">
                     <div className="flex justify-between items-start mb-1">
                         <div className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit ${getActionColor(log.action)}`}>
                            {getActionIcon(log.action)} {log.action}
                         </div>
                         <div className="text-[10px] text-gray-400 font-medium">
                             {formatTime(log.timestamp)}
                         </div>
                     </div>
                     
                     <h4 className="font-bold text-ink text-sm leading-tight mb-1">{log.title}</h4>
                     {/* Updated: whitespace-pre-wrap to handle newlines for multiple changes */}
                     <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100 leading-relaxed whitespace-pre-wrap font-mono">
                         {log.details}
                     </p>
                     
                     <div className="mt-2 flex items-center gap-1.5">
                         <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500">
                             {log.userName[0]?.toUpperCase()}
                         </div>
                         <span className="text-[10px] font-bold text-gray-400 uppercase">{log.userName}</span>
                     </div>
                 </div>
             </Card>
          ))}
      </div>
    </div>
  );
};