import React from 'react';
import { Card } from '../../../components/ui/Layout';
import { Map, Bus, FileText, ArrowRight, MapPin } from 'lucide-react';
import { ScheduleItem } from '../../../types';
import { ParticipantTags } from '../../schedule/ScheduleShared';

interface BookingGenericCardProps {
    item: ScheduleItem;
    activeTab: string;
    onClick: () => void;
}

function formatDateRange(start: string, end?: string) {
    if (!start) return '';
    const d1 = new Date(start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (end && end !== start) {
        const d2 = new Date(end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${d1} - ${d2}`;
    }
    return d1;
}

export const BookingGenericCard: React.FC<BookingGenericCardProps> = ({ item, activeTab, onClick }) => {
    return (
        <div key={item.id} className="relative group cursor-pointer" onClick={onClick}>
            <Card className="!p-4 border-l-4 border-l-brand hover:-translate-y-1 transition-transform">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                            {activeTab} • {new Date(item.date).toLocaleDateString('en-US', {month: 'short', day:'numeric'})}
                        </div>
                        <h4 className="font-bold text-ink text-lg">{item.title}</h4>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-xl text-gray-400">
                        {activeTab === 'hotel' ? <Map size={20} /> : (activeTab === 'transport' ? <Bus size={20} /> : <FileText size={20} />)}
                    </div>
                </div>
                
                <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                    <span className="font-bold">{item.time}</span>
                    {item.endDate && (
                        <>
                        <ArrowRight size={14} className="text-gray-300" />
                        <span className="font-bold">{item.endTime || '10:00'}</span>
                        <span className="text-xs text-gray-400">({formatDateRange(item.endDate)})</span>
                        </>
                    )}
                </div>

                <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                    {item.locationLink ? (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                            <MapPin size={12} /> View Map
                        </div>
                    ) : <div></div>}
                    <ParticipantTags emails={item.participants || []} />
                </div>
            </Card>
        </div>
    );
};