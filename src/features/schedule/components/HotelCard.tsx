import React from 'react';
import { Card } from '../../../components/ui/Layout';
import { LogIn, LogOut, Bed, MapPin } from 'lucide-react';
import { ScheduleItem } from '../../../types';
import { ParticipantTags } from '../ScheduleShared';

interface HotelCardProps {
    item: ScheduleItem;
    renderMode: 'hotel_in' | 'hotel_out';
    isLast: boolean;
    onClick: () => void;
}

export const HotelCard: React.FC<HotelCardProps> = ({ item, renderMode, isLast, onClick }) => {
    const isCheckOut = renderMode === 'hotel_out';
    const label = isCheckOut ? 'Check Out' : 'Check In';
    const time = isCheckOut ? (item.endTime || '11:00') : item.time;
    
    return (
    <div className="relative z-10 flex gap-3 group cursor-pointer" onClick={onClick}>
        {!isLast && (<div className="absolute left-[19px] top-8 bottom-0 w-[2px] bg-gray-300 z-0 rounded-full"></div>)}
        <div className="flex flex-col items-center pt-1">
            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 shadow-sm transition-transform group-hover:scale-110 ${isCheckOut ? 'bg-white border-red-200 text-red-500' : 'bg-white border-purple-200 text-purple-500'}`}>
                {isCheckOut ? <LogOut size={16} className="ml-0.5" /> : <LogIn size={16} className="mr-0.5" />}
            </div>
            <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-500 font-mono">{time}</div>
        </div>
        <div className="flex-1">
            <Card className={`!p-4 flex flex-col gap-2 relative overflow-hidden group-hover:-translate-y-1 transition-transform border-2 ${isCheckOut ? 'border-red-100 bg-red-50/30' : 'border-purple-100 bg-purple-50/30'}`}>
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isCheckOut ? 'text-red-400' : 'text-purple-400'}`}>{label}</div>
                        <h4 className="font-bold text-ink text-lg leading-tight font-rounded">{item.title}</h4>
                        <div className="mt-2">
                                <ParticipantTags emails={item.participants || []} className="justify-start" />
                        </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        <div className={`p-2 rounded-full ${isCheckOut ? 'bg-red-100 text-red-500' : 'bg-purple-100 text-purple-500'}`}><Bed size={16} /></div>
                    </div>
                </div>
                {item.locationLink && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                        <MapPin size={10} /> View Map
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