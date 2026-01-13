import React from 'react';
import { Plane, RefreshCw, ArrowRight } from 'lucide-react';
import { ScheduleItem } from '../../../types';
import { ParticipantTags, getTicketTheme } from '../ScheduleShared';

interface FlightCardProps {
    item: ScheduleItem;
    renderMode: 'flight_dep' | 'flight_arr';
    isLast: boolean;
    onClick: () => void;
    onRefreshStatus: (item: ScheduleItem) => void;
}

export const FlightCard: React.FC<FlightCardProps> = ({ item, renderMode, isLast, onClick, onRefreshStatus }) => {
    const uniqueKey = `${item.id}_${renderMode}`;
    const statusText = item.flightDetails?.status || 'Scheduled';
    let statusColorClass = 'text-gray-500';
    let statusDotClass = 'bg-gray-400';
    let statusBgClass = 'bg-gray-50';
    
    if (statusText === 'Unavailable') {
        statusColorClass = 'text-yellow-600'; statusDotClass = 'bg-yellow-500'; statusBgClass = 'bg-yellow-50';
    } else if (statusText.toLowerCase().includes('delayed')) {
        statusColorClass = 'text-orange-600'; statusDotClass = 'bg-orange-500'; statusBgClass = 'bg-orange-50';
    } else if (statusText === 'On Time') {
        statusColorClass = 'text-green-600'; statusDotClass = 'bg-green-500'; statusBgClass = 'bg-green-50';
    }
    
    const theme = getTicketTheme(item.themeColor);

    if (renderMode === 'flight_dep') {
        return (
          <div key={uniqueKey} className="relative z-10 flex gap-3 group cursor-pointer" onClick={onClick}>
             {!isLast && (<div className="absolute left-[19px] top-8 bottom-0 w-[2px] bg-gray-300 z-0 rounded-full"></div>)}
             
             <div className="flex flex-col items-center pt-1 w-10">
                <div className={`w-10 h-10 rounded-full bg-white border-2 ${theme.border} flex items-center justify-center z-10 shadow-sm group-hover:scale-110 transition-transform`}>
                   <Plane className={theme.icon} size={18} />
                </div>
                <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-500 font-mono">{item.time}</div>
             </div>

             <div className="flex-1 min-w-0">
                {/* REDESIGN: Boxy Boarding Pass (Square-ish Radius, Custom Border Color #B3B3B3) */}
                <div className={`bg-white rounded-lg shadow-soft border border-[#B3B3B3] overflow-hidden transition-all group-hover:shadow-soft-hover group-hover:-translate-y-1`}>
                    {/* Header */}
                    <div className="p-3 bg-white border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Plane size={16} className="text-gray-400" />
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.text}`}>Boarding Pass</span>
                        </div>
                        {item.flightDetails?.bookingReference && (
                            <span className="text-[10px] font-sans font-medium text-gray-300">Ref: {item.flightDetails.bookingReference}</span>
                        )}
                    </div>

                    {/* Main Content */}
                    <div className="p-4">
                        {/* Soft UI Flight Number Box - PILL SHAPE */}
                        <div className="flex justify-center mb-4">
                            <div className="px-6 py-3 rounded-3xl bg-white shadow-[2px_2px_8px_#e5e7eb,-2px_-2px_8px_#ffffff] border border-gray-50 flex flex-col items-center min-w-[120px]">
                                <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Flight Number</div>
                                <div className="text-3xl font-black text-ink tracking-tight font-sans">{item.flightDetails?.flightNumber || 'TBD'}</div>
                            </div>
                        </div>

                        {/* Route Row */}
                        <div className="flex justify-between items-center mb-4 relative">
                            <div className="text-left w-1/3">
                                <div className="text-3xl font-black text-ink font-sans leading-none">{item.flightDetails?.origin || 'ORG'}</div>
                                <div className="text-[10px] uppercase font-bold text-gray-400 mt-2 tracking-wider">Departs</div>
                                <div className="text-lg font-black text-ink mt-0.5 font-sans">{item.time}</div>
                            </div>
                            
                            <div className="flex-1 flex flex-col items-center px-2 relative -top-2">
                                {/* Arrow Line */}
                                <div className="w-full h-[2px] bg-gray-200 relative">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-1">
                                        <ArrowRight size={16} className="text-gray-300" />
                                    </div>
                                </div>
                            </div>

                            <div className="text-right w-1/3">
                                <div className="text-3xl font-black text-ink font-sans leading-none">{item.flightDetails?.destination || 'DST'}</div>
                                <div className="text-[10px] uppercase font-bold text-gray-400 mt-2 tracking-wider">Arrives</div>
                                <div className="text-lg font-black text-ink mt-0.5 font-sans">{item.flightDetails?.arrivalTime || '--:--'}</div>
                            </div>
                        </div>

                        {/* Passengers & Status */}
                        <div className="flex justify-between items-end border-t border-gray-100 pt-4">
                            <div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Passengers</div>
                                <ParticipantTags emails={item.participants || []} className="justify-start gap-1" />
                            </div>
                            
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusBgClass}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`}></div>
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${statusColorClass}`}>{statusText}</span>
                                <button onClick={(e) => { e.stopPropagation(); onRefreshStatus(item); }} className="ml-1 text-gray-400 hover:text-brand"><RefreshCw size={10} /></button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Visual Detail: Perforated Edge */}
                    <div className="h-3 bg-gray-50 flex gap-1.5 px-2 border-t border-gray-100 overflow-hidden">
                        {[...Array(20)].map((_, i) => (
                            <div key={i} className="w-3 h-3 rounded-full bg-white border border-gray-100 -mt-2"></div>
                        ))}
                    </div>
                </div>
             </div>
          </div>
        );
    } else {
         // Arrival mode
         return (
            <div key={uniqueKey} className="relative z-10 flex gap-3 group cursor-pointer" onClick={onClick}>
                {!isLast && (<div className="absolute left-[19px] top-8 bottom-0 w-[2px] bg-gray-300 z-0 rounded-full"></div>)}
                <div className="flex flex-col items-center pt-1 w-10">
                    <div className="w-10 h-10 rounded-full bg-white border-2 border-brand/30 flex items-center justify-center z-10 shadow-sm opacity-50">
                        <Plane className="text-brand rotate-90" size={16} />
                    </div>
                    <div className="mt-1 bg-paper px-1 rounded text-[10px] font-bold text-gray-400 font-mono">{item.flightDetails?.arrivalTime}</div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-lg shadow-soft border border-dashed border-gray-400 overflow-hidden opacity-90 group-hover:opacity-100 transition-opacity">
                        <div className="p-3 bg-gray-50 flex items-center justify-between border-b border-gray-100">
                            <div className="flex items-center gap-2 text-gray-400 font-bold"><Plane size={14} className="rotate-90" /><span className="text-[10px] uppercase tracking-widest font-black">Arrival</span></div>
                            <div className="text-[10px] font-mono font-bold text-gray-400">{item.flightDetails?.flightNumber}</div>
                        </div>
                        <div className="p-4 flex justify-between items-center">
                            <div>
                                <div className="text-2xl font-black text-gray-500 font-sans">{item.flightDetails?.destination}</div>
                                <div className="text-[10px] text-gray-400 font-bold uppercase">Arrives {item.flightDetails?.arrivalTime}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-gray-400 font-bold uppercase">From</div>
                                <div className="text-lg font-black text-gray-500 font-sans">{item.flightDetails?.origin}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
};