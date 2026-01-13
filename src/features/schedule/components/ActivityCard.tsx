import React from 'react';
import { Card } from '../../../components/ui/Layout';
import { Calendar, MapPin } from 'lucide-react';
import { ScheduleItem } from '../../../types';
import { ParticipantTags, TypeIcon } from '../ScheduleShared';

function formatDateShort(dateStr: string) {
    if(!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ActivityCardProps {
    item: ScheduleItem;
    isLast: boolean;
    onClick: () => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ item, isLast, onClick }) => {
    return (
    <div className="relative z-10 flex gap-3 group cursor-pointer" onClick={onClick}>
        {!isLast && (<div className="absolute left-[19px] top-8 bottom-0 w-[2px] bg-gray-300 z-0 rounded-full"></div>)}
        <div className="flex flex-col items-center pt-1">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-brand flex items-center justify-center z-10 shadow-sm group-hover:scale-110 transition-transform">
                <TypeIcon type={item.type} />
            </div>
            <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-500 font-mono flex flex-col items-center leading-none py-1 gap-0.5 min-w-[32px]">
                <span>{item.time}</span>
                {item.endTime && (<><span className="text-gray-300">↓</span><span>{item.endTime}</span></>)}
            </div>
        </div>
        <div className="flex-1">
            <Card className="!p-4 flex flex-col gap-2 relative overflow-hidden group-hover:-translate-y-1 transition-transform group-hover:border-brand">
                <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <h4 className="font-bold text-ink text-lg leading-tight font-rounded">{item.title}</h4>
                    {item.endDate && item.endDate !== item.date && (
                        <div className="text-[10px] font-bold text-purple-500 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-full self-start mt-1">
                            <Calendar size={10} /> Ends {formatDateShort(item.endDate)}
                        </div>
                    )}
                    <div className="mt-2">
                        <ParticipantTags emails={item.participants || []} className="justify-start" />
                    </div>
                </div>
                </div>
                
                {item.locationLink && (
                    <div className="text-xs text-blue-500 flex items-center gap-1 font-bold">
                        <MapPin size={12} /> Map Link
                    </div>
                )}
                {item.notes && (
                <div className="bg-white rounded-2xl p-3 border border-dashed border-gray-300 shadow-sm mt-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Notes</div>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{item.notes}</p>
                </div>
                )}
            </Card>
        </div>
    </div>
    );
};