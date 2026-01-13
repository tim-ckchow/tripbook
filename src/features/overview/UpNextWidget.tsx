import React, { useEffect, useState } from 'react';
import { ScheduleItem } from '../../types';
import { Card } from '../../components/ui/Layout';
import { Clock, ChevronRight, Calendar } from 'lucide-react';
import { db } from '../../lib/firebase';
import { TypeIcon } from '../schedule/ScheduleShared';

interface UpNextWidgetProps {
    tripId: string;
    onNavigate?: (date: string) => void;
}

export const UpNextWidget: React.FC<UpNextWidgetProps> = ({ tripId, onNavigate }) => {
    const [nextItem, setNextItem] = useState<ScheduleItem | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // FIX: Use local time instead of UTC (toISOString) to ensure we don't miss "today's" events
        // due to timezone offsets.
        const now = new Date();
        // Format: YYYY-MM-DD in local time
        const offset = now.getTimezoneOffset();
        const localDate = new Date(now.getTime() - (offset * 60 * 1000));
        const todayStr = localDate.toISOString().split('T')[0];
        
        // Query items from today onwards
        const unsub = db.collection(`trips/${tripId}/schedule`)
            .where('date', '>=', todayStr)
            .orderBy('date', 'asc')
            .orderBy('time', 'asc')
            .limit(10) // Limit to save bandwidth, we only need the first valid one
            .onSnapshot(snap => {
                const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleItem));
                
                // Client side filtering: Find the first item that hasn't "passed" yet.
                // We show items that started within the last hour (current) or are in the future.
                const upcoming = items.find(item => {
                    const itemDateTime = new Date(`${item.date}T${item.time}`);
                    // Buffer: Event remains "Up Next" for 1 hour after start time
                    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); 
                    return itemDateTime > cutoffTime;
                });

                setNextItem(upcoming || null);
                setLoading(false);
            });
        
        return () => unsub();
    }, [tripId]);

    if (loading) return null;

    // Optional: Show a placeholder if nothing is up next (helps user know it's working)
    if (!nextItem) {
        return (
            <div className="animate-in slide-in-from-bottom-2 duration-500 opacity-60">
                 <div className="flex justify-between items-center px-1 mb-2">
                    <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest flex items-center gap-1">
                        <Clock size={12} /> Up Next
                    </h3>
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-3xl p-4 flex items-center gap-3 bg-gray-50/50">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        <Calendar size={18} />
                    </div>
                    <div className="text-xs font-bold text-gray-400">
                        No upcoming plans scheduled.
                    </div>
                </div>
            </div>
        );
    }

    const isFlight = nextItem.type === 'flight';
    const isToday = nextItem.date === new Date().toISOString().split('T')[0];
    
    // Determine subtitle text
    let subtitle: string = nextItem.type;
    if (isFlight && nextItem.flightDetails?.flightNumber) {
        subtitle = `Flight ${nextItem.flightDetails.flightNumber}`;
    } else if (nextItem.type === 'sightseeing') {
        subtitle = 'Activity';
    }

    return (
        <div className="animate-in slide-in-from-bottom-2 duration-500">
            <div className="flex justify-between items-center px-1 mb-2">
                <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest flex items-center gap-1">
                    <Clock size={12} /> Up Next
                </h3>
                {isToday && <span className="text-[10px] font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded-full animate-pulse">Happening Today</span>}
            </div>
            
            <Card 
                onClick={() => nextItem && onNavigate?.(nextItem.date)}
                className="border-l-4 border-l-brand relative overflow-hidden group active:scale-[0.99] transition-transform cursor-pointer"
            >
                <div className="flex items-center gap-4">
                     {/* Time Box */}
                     <div className="flex flex-col items-center justify-center min-w-[50px] border-r border-gray-100 pr-4">
                         <div className="font-mono font-bold text-xl text-ink leading-none">{nextItem.time}</div>
                         <div className="text-[10px] text-gray-400 font-bold uppercase mt-1 whitespace-nowrap">
                             {isToday ? 'Today' : new Date(nextItem.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}
                         </div>
                     </div>
                     
                     {/* Details */}
                     <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                             <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                                 <TypeIcon type={nextItem.type} />
                             </div>
                             <span className="text-xs font-bold text-gray-500 uppercase tracking-wide truncate">{subtitle}</span>
                         </div>
                         <h4 className="font-bold text-lg text-ink truncate font-rounded leading-tight">{nextItem.title}</h4>
                         {nextItem.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{nextItem.notes}</p>}
                     </div>

                     <div className="text-gray-300">
                         <ChevronRight size={20} />
                     </div>
                </div>
            </Card>
        </div>
    );
};