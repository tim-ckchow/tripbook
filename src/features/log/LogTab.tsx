import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { Trip, LogEntry, LogCategory } from '../../types';
import { Card } from '../../components/ui/Layout';
import { Calendar, Map, CreditCard, Users, Clock, Plus, Edit2, Trash2, BookOpen, Filter } from 'lucide-react';

interface TripActivityLogProps {
  trip: Trip;
}

type TimeFilter = 'all' | '24h' | '7d' | 'old';

export const TripActivityLog: React.FC<TripActivityLogProps> = ({ trip }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<LogCategory | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  useEffect(() => {
    setLoading(true);
    // Removed limit(50) to show all history
    const unsub = db.collection(`trips/${trip.id}/logs`)
      .orderBy('timestamp', 'desc')
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

  const filteredLogs = logs.filter(log => {
      // 1. Category Filter
      if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;

      // 2. Time Filter
      const logTime = new Date(log.timestamp).getTime();
      const now = Date.now();
      const diffHours = (now - logTime) / (1000 * 60 * 60);

      if (timeFilter === '24h') return diffHours <= 24;
      if (timeFilter === '7d') return diffHours <= 24 * 7;
      if (timeFilter === 'old') return diffHours > 24 * 7;

      return true;
  });

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
    <Card className="flex flex-col h-[600px] shadow-sm border border-gray-200 !p-0 overflow-hidden bg-white">
      {/* Sticky Header Section */}
      <div className="flex-none p-5 pb-0 border-b border-gray-100 bg-white z-10 shadow-sm">
          <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 p-2 rounded-xl text-purple-600">
                    <BookOpen size={18} />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-ink leading-none">Activity Log</h3>
                    <div className="text-[10px] font-bold text-gray-400 mt-0.5">{filteredLogs.length} events</div>
                </div>
              </div>
          </div>

          {/* Filters Stack */}
          <div className="flex flex-col gap-3 pb-3">
              {/* Row 1: Time Filters */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-2">
                    <Clock size={12} /> Time
                </div>
                {[
                    { id: 'all', label: 'All Time' },
                    { id: '24h', label: 'Past 24h' },
                    { id: '7d', label: 'Past Week' },
                    { id: 'old', label: 'Older' }
                ].map((tf) => (
                   <button
                        key={tf.id}
                        onClick={() => setTimeFilter(tf.id as TimeFilter)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border ${
                            timeFilter === tf.id 
                            ? 'bg-gray-800 text-white border-gray-800' 
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                   >
                       {tf.label}
                   </button>
                ))}
              </div>

              {/* Row 2: Category Filters */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-2">
                    <Filter size={12} /> Type
                </div>
                {(['all', 'plan', 'booking', 'expense', 'member'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full border text-[10px] font-bold capitalize transition-all whitespace-nowrap flex-shrink-0 ${
                        categoryFilter === cat 
                        ? 'bg-brand text-white border-brand' 
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>
          </div>
      </div>

      {/* Scrollable List Section */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/30 relative">
        <div className="p-2 flex flex-col gap-2 pb-10">
            {loading && <div className="text-center text-gray-400 py-10 text-xs flex items-center justify-center gap-2"><Clock className="animate-spin" size={14}/> Loading history...</div>}

            {!loading && filteredLogs.length === 0 && (
                <div className="text-center py-20 opacity-50 flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                        <Clock size={20} className="text-gray-400" />
                    </div>
                    <h3 className="font-bold text-gray-400 text-sm">No activity found</h3>
                    <p className="text-[10px] text-gray-300">Try adjusting your filters</p>
                </div>
            )}

            {filteredLogs.map((log) => (
                <div key={log.id} className="flex gap-3 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm relative group transition-all hover:border-brand/30 hover:shadow-md">
                    
                    {/* Icon Column */}
                    <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                            {getIcon(log.category)}
                        </div>
                        <div className="w-px h-full bg-gray-100 group-hover:bg-brand/20 transition-colors"></div>
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0 pb-1">
                        <div className="flex justify-between items-start mb-1">
                            <h4 className="font-bold text-ink text-sm leading-tight pr-2">{log.title}</h4>
                            <div className="text-[10px] text-gray-400 font-mono whitespace-nowrap bg-gray-50 px-1.5 py-0.5 rounded">
                                {formatTime(log.timestamp)}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 w-fit ${getActionColor(log.action)}`}>
                                {getActionIcon(log.action)} {log.action}
                            </div>
                            <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[8px] font-black text-gray-500">
                                    {log.userName[0]?.toUpperCase()}
                                </div>
                                {log.userName}
                            </span>
                        </div>

                        {/* Details - Updated to show full text with wrapping */}
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                            <p className="text-[11px] text-gray-600 leading-relaxed font-mono whitespace-pre-wrap break-words">
                                {log.details}
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </Card>
  );
};