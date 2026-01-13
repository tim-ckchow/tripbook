import React from 'react';
import { Settings } from 'lucide-react';

interface DateScrollerProps {
    allDates: string[];
    selectedDate: string;
    onSelectDate: (date: string) => void;
    onOpenSettings: () => void;
    items: any[];
}

export const DateScroller: React.FC<DateScrollerProps> = ({ allDates, selectedDate, onSelectDate, onOpenSettings, items }) => {
    return (
        <div className="flex items-center">
             <div className="flex-1 overflow-x-auto flex gap-3 px-4 pb-4 pt-4 no-scrollbar snap-x">
                {allDates.map(date => {
                    const d = new Date(date + 'T00:00:00');
                    const isSelected = date === selectedDate;
                    const hasPlans = items.some(i => i.date === date || i.endDate === date || (i.type === 'flight' && i.flightDetails?.arrivalDate === date));

                    return (
                    <button 
                        key={date}
                        onClick={() => onSelectDate(date)}
                        id={`date-${date}`}
                        className={`snap-start flex-shrink-0 flex flex-col items-center justify-center w-[72px] h-[84px] rounded-3xl border-2 transition-all duration-300 ${
                        isSelected 
                            ? 'bg-brand border-brand text-white shadow-md scale-105 rotate-1' 
                            : 'bg-white border-gray-300 text-gray-400 hover:border-brand/50 hover:scale-105'
                        }`}
                    >
                        <span className="text-xs font-bold uppercase tracking-wide">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className={`text-2xl font-black font-rounded ${isSelected ? 'text-white' : 'text-ink'}`}>{d.getDate()}</span>
                        {hasPlans && (<div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-brand'}`}></div>)}
                    </button>
                    );
                })}
            </div>
            <div className="pr-4 pl-2">
                <button 
                    onClick={onOpenSettings}
                    className="w-12 h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-gray-400 hover:text-brand hover:border-brand transition-colors shadow-sm"
                >
                    <Settings size={20} />
                </button>
            </div>
        </div>
    );
};