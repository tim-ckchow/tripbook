import React, { useState, useMemo } from 'react';
import { Card } from '../../../components/ui/Layout';
import { Loader, Wind, Droplets, CloudRain, ArrowUp, ArrowDown, Snowflake } from 'lucide-react';
import { CityForecast, getWeatherIcon } from '../WeatherShared';

export const WeatherPrimaryCard: React.FC<{ city: CityForecast }> = ({ city }) => {
    const [selectedDateIndex, setSelectedDateIndex] = useState(0);

    const selectedDay = city.daily[selectedDateIndex];
    
    // Filter hourly data for the selected day
    const hourlyForDay = useMemo(() => {
        if (!city.hourly || !selectedDay) return [];
        const targetDate = selectedDay.date; 
        return city.hourly.filter(h => h.time.startsWith(targetDate));
    }, [city.hourly, selectedDay]);

    if (city.loading) {
         return (
             <Card className="min-h-[300px] flex flex-col items-center justify-center text-gray-400 gap-3 bg-gradient-to-br from-white to-blue-50/50">
                 <Loader className="animate-spin" />
                 <span className="text-xs font-bold">Loading Weather...</span>
             </Card>
         );
    }

    if (city.error || !city.current || !selectedDay) {
        return (
            <Card className="min-h-[200px] flex items-center justify-center text-red-300 bg-red-50/50">
                <span className="text-xs font-bold">Weather Unavailable</span>
            </Card>
        );
    }

    return (
        <Card className="!p-0 overflow-hidden border-blue-100 bg-white shadow-md relative">
            {/* Top: Current Conditions */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-400 text-white p-6 relative overflow-hidden">
                <div className="absolute top-[-20px] right-[-20px] opacity-20">
                    {getWeatherIcon(city.current.code, 120, "text-white")}
                </div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black font-rounded tracking-tight leading-none">{city.name}</h2>
                            <div className="text-blue-100 text-xs font-bold mt-1 uppercase tracking-wider flex items-center gap-2">
                                <span>Right Now</span>
                                {city.lastUpdated && (
                                    <span className="opacity-70 text-[10px]">
                                        • {new Date(city.lastUpdated).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                             <div className="text-4xl font-black font-rounded tracking-tighter">{Math.round(city.current.temp)}°</div>
                             <div className="text-blue-100 text-xs font-bold">{getWeatherIcon(city.current.code, 12, "inline mr-1 text-white")} Condition</div>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-6">
                        <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                            <Wind size={14} className="text-blue-100" />
                            <span className="text-xs font-bold">{city.current.windSpeed} km/h</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                            <Droplets size={14} className="text-blue-100" />
                            <span className="text-xs font-bold">{city.current.humidity}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle: Details for Selected Day */}
            <div className="p-5 bg-blue-50/30">
                <div className="flex justify-between items-end mb-3">
                    <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {new Date(selectedDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                        <div className="text-lg font-black text-ink font-rounded flex items-center gap-2">
                             Hourly Forecast
                             {selectedDay.precipProbMax > 20 && (
                                 <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                     <CloudRain size={10} /> {selectedDay.precipProbMax}%
                                     {selectedDay.snowSum > 0 ? ` • ${selectedDay.snowSum}cm` : (selectedDay.precipSum > 0 ? ` • ${Math.round(selectedDay.precipSum)}mm` : ' Rain')}
                                 </span>
                             )}
                        </div>
                    </div>
                    <div className="text-xs font-bold text-gray-500 flex gap-2">
                        <span className="flex items-center gap-1"><ArrowUp size={12} className="text-orange-400"/> {Math.round(selectedDay.max)}°</span>
                        <span className="flex items-center gap-1"><ArrowDown size={12} className="text-blue-400"/> {Math.round(selectedDay.min)}°</span>
                    </div>
                </div>

                {/* Hourly Horizontal Scroll */}
                <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar snap-x -mx-5 px-5">
                    {hourlyForDay.map((hour, idx) => {
                        const timeLabel = new Date(hour.time).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
                        const hasSnow = hour.snowAmount > 0;
                        const hasPrecip = hour.precipAmount > 0 || hour.precipProb > 0;
                        
                        return (
                            <div key={idx} className="flex flex-col items-center justify-between min-w-[54px] p-2 bg-white rounded-xl border border-gray-100 shadow-sm snap-start">
                                <span className="text-[9px] font-bold text-gray-400 uppercase">{timeLabel}</span>
                                <div className="my-2">{getWeatherIcon(hour.code, 20)}</div>
                                <span className="text-sm font-black text-ink">{Math.round(hour.temp)}°</span>
                                {hasSnow ? (
                                    <div className="mt-1 flex flex-col items-center">
                                        <div className="text-[8px] font-bold text-cyan-500 flex items-center leading-none mb-0.5">
                                            <Snowflake size={8} className="mr-0.5" /> {hour.precipProb}%
                                        </div>
                                        <div className="text-[8px] font-bold text-cyan-600 leading-none">{hour.snowAmount}cm</div>
                                    </div>
                                ) : hasPrecip ? (
                                    <div className="mt-1 flex flex-col items-center">
                                        <div className="text-[8px] font-bold text-blue-500 flex items-center leading-none mb-0.5">
                                            <Droplets size={8} className="mr-0.5" /> {hour.precipProb}%
                                        </div>
                                        {hour.precipAmount > 0.1 && <div className="text-[8px] font-bold text-blue-600 leading-none">{hour.precipAmount}mm</div>}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                    {hourlyForDay.length === 0 && (
                        <div className="text-xs text-gray-400 py-4 italic">Hourly data not available for this date.</div>
                    )}
                </div>
            </div>

            {/* Bottom: 7 Day Strip */}
            <div className="p-4 bg-white border-t border-gray-100">
                 <div className="flex justify-between gap-1 overflow-x-auto no-scrollbar py-2">
                    {city.daily.map((day, idx) => {
                        const d = new Date(day.date);
                        const isSelected = selectedDateIndex === idx;
                        return (
                            <button 
                                key={idx} 
                                onClick={() => setSelectedDateIndex(idx)}
                                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl flex-1 transition-all min-w-[50px] ${isSelected ? 'bg-ink text-white shadow-lg scale-105' : 'hover:bg-gray-50 text-gray-400'}`}
                            >
                                <span className={`text-[11px] font-black font-rounded leading-none ${isSelected ? 'text-white' : 'text-ink'}`}>
                                    {d.getDate()}
                                </span>
                                <span className={`text-[9px] font-bold uppercase tracking-tight -mt-1 ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                                    {d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                                </span>
                                <div className="my-0.5">{getWeatherIcon(day.code, 18, isSelected ? "text-white" : "")}</div>
                                <div className={`flex flex-col items-center text-[10px] font-mono font-bold leading-none gap-0.5 ${isSelected ? 'text-white' : 'text-ink'}`}>
                                    <span>{Math.round(day.max)}°</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
};