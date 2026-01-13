import React, { useEffect, useState } from 'react';
import { Trip, WeatherLocation } from '../../types';
import { Card, Button, Input } from '../../components/ui/Layout';
import { 
    Cloud, CloudRain, Sun, CloudLightning, Snowflake, CloudFog, 
    Plus, X, Search, Loader, Settings, ArrowUp, ArrowDown, Trash2, MapPin 
} from 'lucide-react';
import { db } from '../../lib/firebase';

interface WeatherWidgetProps {
    trip: Trip;
}

interface WeatherData { date: string; code: number; max: number; min: number; }
interface CityForecast { name: string; lat: number; lng: number; forecast: WeatherData[]; loading: boolean; error?: boolean; }

const getWeatherIcon = (code: number, size = 24, className = "") => {
    // WMO Weather interpretation codes (WW)
    if (code === 0) return <Sun size={size} className={`text-orange-400 ${className}`} />;
    if (code >= 1 && code <= 3) return <Cloud size={size} className={`text-gray-400 ${className}`} />;
    if (code >= 45 && code <= 48) return <CloudFog size={size} className={`text-blue-300 ${className}`} />;
    if (code >= 51 && code <= 67) return <CloudRain size={size} className={`text-blue-500 ${className}`} />;
    if (code >= 71 && code <= 77) return <Snowflake size={size} className={`text-cyan-300 ${className}`} />;
    if (code >= 80 && code <= 82) return <CloudRain size={size} className={`text-blue-600 ${className}`} />;
    if (code >= 95 && code <= 99) return <CloudLightning size={size} className={`text-purple-500 ${className}`} />;
    return <Sun size={size} className={`text-orange-400 ${className}`} />;
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ trip }) => {
    const [cities, setCities] = useState<CityForecast[]>([]);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        const locations = trip.weatherLocations || [];
        setCities(prevCities => {
            return locations.map((loc) => {
                const existing = prevCities.find(c => c.name === loc.name && c.lat === loc.lat);
                return {
                    name: loc.name,
                    lat: loc.lat,
                    lng: loc.lng,
                    forecast: existing ? existing.forecast : [],
                    loading: existing ? existing.loading : true,
                    error: existing ? existing.error : false
                };
            });
        });

        locations.forEach((loc) => {
             fetchForecast(loc.lat, loc.lng).then(data => {
                setCities(prev => prev.map(c => {
                    if (c.lat === loc.lat && c.lng === loc.lng) return { ...c, forecast: data, loading: false };
                    return c;
                }));
             }).catch(() => {
                setCities(prev => prev.map(c => {
                    if (c.lat === loc.lat && c.lng === loc.lng) return { ...c, loading: false, error: true };
                    return c;
                }));
             });
        });
    }, [trip.weatherLocations]);

    // Cache duration in milliseconds (4 hours)
    const CACHE_DURATION = 1000 * 60 * 60 * 4;

    const fetchForecast = async (lat: number, lng: number) => {
        const cacheKey = `weather_v1_${lat}_${lng}`;
        const cached = localStorage.getItem(cacheKey);
        
        // Check cache
        if (cached) {
            try {
                const { timestamp, data } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    console.log(`[Weather] Using cached data for ${lat},${lng}`);
                    return data as WeatherData[];
                }
            } catch (e) {
                console.warn("Invalid cache data");
            }
        }

        try {
            console.log(`[Weather] Fetching new data for ${lat},${lng}`);
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`);
            const data = await res.json();
            if (!data.daily) return [];
            const forecast: WeatherData[] = [];
            for(let i=0; i<7; i++) {
                if(data.daily.time[i]) {
                    forecast.push({
                        date: data.daily.time[i],
                        code: data.daily.weathercode[i],
                        max: data.daily.temperature_2m_max[i],
                        min: data.daily.temperature_2m_min[i]
                    });
                }
            }

            // Save to cache
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: forecast
            }));

            return forecast;
        } catch (err) { console.error(err); throw err; }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!searchQuery) return;
        setSearchLoading(true);
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${searchQuery}&count=5&language=en&format=json`);
            const data = await res.json();
            setSearchResults(data.results || []);
        } catch (err) { console.error(err); } finally { setSearchLoading(false); }
    };

    const updateTripLocations = async (newLocations: WeatherLocation[]) => {
        try { await db.collection('trips').doc(trip.id).update({ weatherLocations: newLocations }); } catch (err) { console.error(err); alert("Failed to update locations"); }
    };

    const addCity = async (name: string, lat: number, lng: number) => {
        const currentLocs = trip.weatherLocations || [];
        if (currentLocs.some(l => l.name === name)) { alert("City already added"); return; }
        await updateTripLocations([...currentLocs, { name, lat, lng }]);
        setSearchQuery(''); setSearchResults([]);
    };

    const removeCity = async (index: number) => {
        const currentLocs = [...(trip.weatherLocations || [])];
        currentLocs.splice(index, 1);
        await updateTripLocations(currentLocs);
    };

    const moveCity = async (index: number, direction: -1 | 1) => {
        const currentLocs = [...(trip.weatherLocations || [])];
        if (index + direction < 0 || index + direction >= currentLocs.length) return;
        const temp = currentLocs[index];
        currentLocs[index] = currentLocs[index + direction];
        currentLocs[index + direction] = temp;
        await updateTripLocations(currentLocs);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest">Weather Dashboard</h3>
                <button onClick={() => setIsManageModalOpen(true)} className="text-gray-500 text-xs font-bold flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors shadow-sm"><Settings size={12} /> Edit</button>
            </div>

            {cities.length === 0 && (
                 <button onClick={() => setIsManageModalOpen(true)} className="text-center py-8 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50 hover:bg-gray-100 transition-colors flex flex-col items-center gap-2">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-400"><Plus size={20} /></div>
                     <div className="text-xs text-gray-400 font-bold">Add a city to see the forecast</div>
                 </button>
            )}

            <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 no-scrollbar snap-x">
                {cities.map((city, idx) => (
                    <Card key={`${city.name}-${idx}`} className="min-w-[85vw] snap-center relative border-blue-100 bg-gradient-to-br from-white to-blue-50/30 !p-0 overflow-hidden shadow-md">
                        <div className="p-5 flex justify-between items-start pb-2">
                             <div>
                                 <h4 className="font-black text-3xl text-ink tracking-tight font-rounded">{city.name}</h4>
                                 <div className="text-xs text-blue-400 font-bold uppercase tracking-wide mt-1 flex items-center gap-1"><MapPin size={12} /> 7 Day Forecast</div>
                             </div>
                             {!city.loading && !city.error && city.forecast[0] && (<div className="bg-white/50 p-2 rounded-2xl backdrop-blur-sm border border-white/50 shadow-sm">{getWeatherIcon(city.forecast[0].code, 48)}</div>)}
                        </div>
                        <div className="px-5 pb-5">
                            {city.loading && <div className="py-12 text-center text-sm font-bold text-gray-300 flex items-center justify-center gap-2"><Loader className="animate-spin" size={16}/> Forecast loading...</div>}
                            {city.error && <div className="py-12 text-center text-sm font-bold text-red-300">Weather data unavailable</div>}
                            {!city.loading && !city.error && (
                                <div className="flex justify-between gap-1 mt-4">
                                    {city.forecast.map((day, dIdx) => {
                                        const d = new Date(day.date);
                                        const isToday = new Date().toDateString() === d.toDateString();
                                        return (
                                            <div key={dIdx} className={`flex flex-col items-center gap-2 p-1.5 rounded-2xl flex-1 ${isToday ? 'bg-white shadow-md border border-blue-100 scale-110 z-10' : 'hover:bg-white/50'}`}>
                                                <span className={`text-[9px] font-black uppercase tracking-tight ${isToday ? 'text-brand' : 'text-gray-400'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</span>
                                                <div className="my-0.5">{getWeatherIcon(day.code, 20)}</div>
                                                <div className="flex flex-col items-center text-[10px] font-mono font-bold text-ink leading-none gap-0.5"><span>{Math.round(day.max)}°</span><span className="text-gray-300 text-[8px]">{Math.round(day.min)}°</span></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            {isManageModalOpen && (
                <div className="fixed inset-0 bg-ink/30 z-[100] flex items-end sm:items-center justify-center backdrop-blur-sm sm:p-4" onClick={() => setIsManageModalOpen(false)}>
                    <div className="bg-white w-full max-w-md max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 overflow-hidden pb-[env(safe-area-inset-bottom)]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg font-rounded">Manage Locations</h3>
                            <button onClick={() => setIsManageModalOpen(false)} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                            <div className="space-y-2 mb-6">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Saved Cities</label>
                                {(trip.weatherLocations || []).length === 0 && (<div className="text-center py-4 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">No cities added yet.</div>)}
                                {(trip.weatherLocations || []).map((loc, idx) => (
                                    <div key={`${loc.name}-${idx}`} className="flex items-center gap-3 bg-white border border-gray-200 p-3 rounded-xl shadow-sm">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                        <div className="flex-1 font-bold text-ink truncate">{loc.name}</div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => moveCity(idx, -1)} disabled={idx === 0} className="p-1.5 text-gray-400 hover:text-brand disabled:opacity-30 disabled:hover:text-gray-400"><ArrowUp size={16} /></button>
                                            <button onClick={() => moveCity(idx, 1)} disabled={idx === (trip.weatherLocations?.length || 0) - 1} className="p-1.5 text-gray-400 hover:text-brand disabled:opacity-30 disabled:hover:text-gray-400"><ArrowDown size={16} /></button>
                                            <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                            <button onClick={() => removeCity(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-gray-100">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Add New City</label>
                                <form onSubmit={handleSearch} className="flex gap-2 mb-3">
                                    <Input placeholder="City name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="!text-sm" />
                                    <Button type="submit" disabled={searchLoading} className="!px-4">{searchLoading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}</Button>
                                </form>
                                <div className="flex flex-col gap-2">
                                    {searchResults.map((res: any) => (
                                        <button key={res.id} onClick={() => addCity(res.name, res.latitude, res.longitude)} className="text-left p-3 rounded-xl bg-gray-50 hover:bg-white flex justify-between items-center border border-transparent hover:border-brand transition-all group">
                                            <div><div className="font-bold text-sm text-ink">{res.name}</div><div className="text-xs text-gray-400">{res.admin1} {res.country}</div></div>
                                            <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-300 group-hover:text-brand group-hover:border-brand"><Plus size={14} /></div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};