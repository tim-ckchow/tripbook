import React from 'react';
import { Card } from '../../../components/ui/Layout';
import { CityForecast, getWeatherIcon } from '../WeatherShared';

export const WeatherSecondaryCard: React.FC<{ city: CityForecast }> = ({ city }) => {
    if (city.loading) return <div className="min-w-[300px] h-44 bg-gray-50 rounded-3xl animate-pulse snap-center border border-gray-100"></div>;
    if (city.error || !city.current || !city.daily?.length) return null;

    return (
        <Card className="min-w-[300px] snap-center !p-5 border border-gray-100 shadow-sm relative overflow-hidden bg-white">
             <div className="flex justify-between items-start mb-4">
                 <div>
                    <h3 className="text-2xl font-black font-rounded text-ink tracking-tight">{city.name}</h3>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">7 Day Forecast</div>
                 </div>
                 {/* Current Icon Large */}
                 <div className="opacity-80">
                     {getWeatherIcon(city.current.code, 40)}
                 </div>
             </div>

             <div className="flex justify-between gap-0.5">
                 {city.daily.map((day, i) => (
                     <div key={i} className="flex flex-col items-center gap-1 flex-1">
                         <span className="text-[11px] font-black font-rounded text-ink leading-none">
                             {new Date(day.date).getDate()}
                         </span>
                         <span className="text-[8px] font-bold text-gray-400 uppercase">
                             {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                         </span>
                         <div className="my-1">{getWeatherIcon(day.code, 16)}</div>
                         <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold text-ink">{Math.round(day.max)}°</span>
                            <span className="text-[9px] font-bold text-gray-300">{Math.round(day.min)}°</span>
                         </div>
                     </div>
                 ))}
             </div>
        </Card>
    );
};