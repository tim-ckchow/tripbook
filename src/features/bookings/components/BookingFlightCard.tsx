import React from 'react';
import { Plane, ArrowRight, RefreshCw } from 'lucide-react';
import { ScheduleItem } from '../../../types';
import { ParticipantTags, getTicketTheme } from '../../schedule/ScheduleShared';

interface BookingFlightCardProps {
    item: ScheduleItem;
    onClick: () => void;
}

export const BookingFlightCard: React.FC<BookingFlightCardProps> = ({ item, onClick }) => {
    const theme = getTicketTheme(item.themeColor);
              
    return (
        <div key={item.id} className="relative group cursor-pointer" onClick={onClick}>
            {/* REDESIGN: Boxy Boarding Pass (Square-ish Radius, Custom Border Color #B3B3B3) */}
            <div className={`bg-white rounded-lg shadow-soft border border-[#B3B3B3] overflow-hidden transition-all group-hover:shadow-soft-hover group-hover:-translate-y-1`}>
                {/* Header */}
                <div className="p-3 bg-white border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Plane size={14} className="text-gray-400" />
                        <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${theme.text}`}>Boarding Pass</span>
                    </div>
                    {item.flightDetails?.bookingReference && (
                        <span className="text-[9px] font-sans font-medium text-gray-300">Ref: {item.flightDetails.bookingReference}</span>
                    )}
                </div>
                
                <div className="p-5">
                    {/* Soft UI Flight Box - PILL SHAPE */}
                    <div className="flex justify-center mb-6">
                    <div className="px-6 py-3 rounded-3xl bg-white shadow-[4px_4px_10px_#e5e7eb,-4px_-4px_10px_#ffffff] border border-gray-50 flex flex-col items-center min-w-[140px]">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Flight Number</div>
                        <div className="text-3xl font-black text-ink tracking-tight font-sans">{item.flightDetails?.flightNumber || 'TBD'}</div>
                    </div>
                    </div>

                    <div className="flex justify-between items-center mb-6 relative">
                        <div className="text-left">
                            <div className="text-3xl font-black text-ink font-sans">{item.flightDetails?.origin}</div>
                            <div className="text-[9px] font-bold uppercase mt-1 text-gray-400">{item.date} • {item.time}</div>
                        </div>
                        
                        <div className="flex-1 flex flex-col items-center px-2 relative -top-2">
                            <div className="w-full h-[2px] bg-gray-200 relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-1">
                                    <Plane size={12} className="text-gray-300 rotate-90" />
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            <div className="text-3xl font-black text-ink font-sans">{item.flightDetails?.destination}</div>
                            <div className="text-[9px] font-bold uppercase mt-1 text-gray-400">
                                {item.flightDetails?.arrivalDate && item.flightDetails.arrivalDate !== item.date ? item.flightDetails.arrivalDate : ''} {item.flightDetails?.arrivalTime}
                            </div>
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-4 mb-4">
                        <div className="text-center">
                            <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Terminal</div>
                            <div className="font-bold text-ink text-sm font-sans">{item.flightDetails?.terminal || '-'}</div>
                        </div>
                        <div className="text-center border-x border-gray-100">
                            <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Gate</div>
                            <div className="font-bold text-ink text-sm font-sans">{item.flightDetails?.gate || '-'}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-0.5">Seat</div>
                            <div className="font-bold text-ink text-sm font-sans">{item.flightDetails?.seat || 'ANY'}</div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <div>
                            <div className="text-[9px] uppercase text-gray-400 font-bold tracking-wider mb-1">Passengers</div>
                            <ParticipantTags emails={item.participants || []} className="justify-start gap-1" />
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); /* Refresh Status Mock */ }} className="text-[9px] font-bold text-brand uppercase flex items-center gap-1 hover:underline">
                            <RefreshCw size={10} /> Check Status
                        </button>
                    </div>
                </div>

                {/* Perforated Edge */}
                <div className="h-3 bg-gray-50 flex gap-1.5 px-2 border-t border-gray-100 overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className="w-3 h-3 rounded-full bg-white border border-gray-100 -mt-2"></div>
                    ))}
                </div>
            </div>
        </div>
    );
};