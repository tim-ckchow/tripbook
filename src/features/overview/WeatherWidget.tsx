import React, { useEffect, useState } from 'react';
import { Trip, WeatherLocation } from '../../types';
import { Plus, Settings, RefreshCw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { CityForecast, DailyData, HourlyData, CurrentWeather } from './WeatherShared';
import { WeatherPrimaryCard } from './components/WeatherPrimaryCard';
import { WeatherSecondaryCard } from './components/WeatherSecondaryCard';
import { WeatherManageModal } from './components/WeatherManageModal';

interface WeatherWidgetProps {
    trip: Trip;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ trip }) => {
    const [cities, setCities] = useState<CityForecast[]>([]);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    useEffect(() => {
        const locations = trip.weatherLocations || [];
        setCities(prevCities => {
            return locations.map((loc) => {
                const existing = prevCities.find(c => c.name === loc.name && c.lat === loc.lat);
                return {
                    name: loc.name,
                    lat: loc.lat,
                    lng: loc.lng,
                    // Persist data if exists to prevent flicker
                    current: existing?.current,
                    daily: existing ? existing.daily : [],
                    hourly: existing ? existing.hourly : [],
                    loading: existing ? existing.loading : true,
                    error: existing ? existing.error : false,
                    lastUpdated: existing?.lastUpdated
                };
            });
        });

        locations.forEach((loc) => {
             fetchDetailedForecast(loc.lat, loc.lng).then(data => {
                setCities(prev => prev.map(c => {
                    if (c.lat === loc.lat && c.lng === loc.lng) {
                        return { ...c, ...data, loading: false };
                    }
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

    // Cache duration in milliseconds (1 hour for current/hourly)
    const CACHE_DURATION = 1000 * 60 * 60 * 1;

    const fetchDetailedForecast = async (lat: number, lng: number, ignoreCache = false) => {
        const cacheKey = `weather_v3_${lat}_${lng}`; 
        const cachedString = localStorage.getItem(cacheKey);
        
        // 1. Check valid cache first (unless ignoring)
        if (!ignoreCache && cachedString) {
            try {
                const { timestamp, data } = JSON.parse(cachedString);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    return { ...data, lastUpdated: timestamp };
                }
            } catch (e) { console.warn("Invalid cache data"); }
        }

        // 2. Try network fetch
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability,precipitation,snowfall&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,precipitation_sum,snowfall_sum&timezone=auto`;
            
            const res = await fetch(url);
            if (!res.ok) throw new Error('Weather API fetch failed');
            const data = await res.json();
            
            if (!data.daily || !data.daily.time || !data.hourly || !data.hourly.time) {
                throw new Error("Incomplete data");
            }

            const daily: DailyData[] = [];
            for(let i=0; i<7; i++) {
                if(data.daily.time[i]) {
                    daily.push({
                        date: data.daily.time[i],
                        code: data.daily.weather_code ? data.daily.weather_code[i] : (data.daily.weathercode ? data.daily.weathercode[i] : 0),
                        max: data.daily.temperature_2m_max[i],
                        min: data.daily.temperature_2m_min[i],
                        maxWind: data.daily.wind_speed_10m_max[i],
                        precipProbMax: data.daily.precipitation_probability_max[i],
                        precipSum: data.daily.precipitation_sum ? data.daily.precipitation_sum[i] : 0,
                        snowSum: data.daily.snowfall_sum ? data.daily.snowfall_sum[i] : 0
                    });
                }
            }

            const hourly: HourlyData[] = [];
            const limit = Math.min(data.hourly.time.length, 168); 
            for(let i=0; i<limit; i++) {
                hourly.push({
                    time: data.hourly.time[i],
                    temp: data.hourly.temperature_2m[i],
                    code: data.hourly.weather_code ? data.hourly.weather_code[i] : (data.hourly.weathercode ? data.hourly.weathercode[i] : 0),
                    precipProb: data.hourly.precipitation_probability[i],
                    precipAmount: data.hourly.precipitation ? data.hourly.precipitation[i] : 0,
                    snowAmount: data.hourly.snowfall ? data.hourly.snowfall[i] : 0,
                });
            }

            const current: CurrentWeather = {
                temp: data.current.temperature_2m,
                code: data.current.weather_code,
                windSpeed: data.current.wind_speed_10m,
                humidity: data.current.relative_humidity_2m
            };

            const result = { current, daily, hourly };
            const now = Date.now();

            // Only write to cache if successful
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: now,
                data: result
            }));

            return { ...result, lastUpdated: now };
        } catch (err) { 
            console.error("Network fetch failed, attempting stale cache fallback", err);
            
            // 3. FALLBACK: Return stale cache if available (critical for offline)
            if (cachedString) {
                try {
                    const { timestamp, data } = JSON.parse(cachedString);
                    // Return stale data instead of throwing
                    return { ...data, lastUpdated: timestamp };
                } catch (e) { /* ignore corrupt cache */ }
            }
            
            // If no cache at all, then throw
            throw err; 
        }
    };

    const updateTripLocations = async (newLocations: WeatherLocation[]) => {
        try { await db.collection('trips').doc(trip.id).update({ weatherLocations: newLocations }); } catch (err) { console.error(err); alert("Failed to update locations"); }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        const locations = trip.weatherLocations || [];
        let successCount = 0;
        let failCount = 0;

        await Promise.all(locations.map(async (loc) => {
            try {
                // Pass true to ignoreCache to attempt fresh fetch
                const data = await fetchDetailedForecast(loc.lat, loc.lng, true);
                
                // Update state on success (or stale fallback success)
                setCities(prev => prev.map(c => {
                    if (c.lat === loc.lat && c.lng === loc.lng) {
                        return { ...c, ...data, loading: false, error: false };
                    }
                    return c;
                }));
                successCount++;
            } catch (err) {
                console.error(`Failed to refresh ${loc.name}`, err);
                failCount++;
            }
        }));

        setRefreshing(false);
        
        if (failCount > 0 && successCount === 0) {
            setToastMsg("Update failed. Check connection.");
        } else if (failCount > 0 && successCount > 0) {
            setToastMsg("Some updates failed.");
        } else if (successCount > 0) {
            setToastMsg("Weather updated!");
        } else {
            // No locations or other edge case
            if(locations.length > 0) setToastMsg("Update failed.");
        }

        // Fade away toast
        if (locations.length > 0) {
            setTimeout(() => setToastMsg(null), 3000);
        }
    };

    const primaryCity = cities[0];
    const secondaryCities = cities.slice(1);

    return (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 relative">
            <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest">Weather</h3>
                <div className="flex gap-2">
                    <button 
                        onClick={handleRefresh} 
                        disabled={refreshing || cities.length === 0}
                        className="text-gray-500 text-xs font-bold flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 active:scale-95"
                    >
                        <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Refresh
                    </button>
                    <button 
                        onClick={() => setIsManageModalOpen(true)} 
                        className="text-gray-500 text-xs font-bold flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
                    >
                        <Settings size={12} /> Edit
                    </button>
                </div>
            </div>

            {cities.length === 0 && (
                 <button onClick={() => setIsManageModalOpen(true)} className="text-center py-8 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50 hover:bg-gray-100 transition-colors flex flex-col items-center gap-2">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-400"><Plus size={20} /></div>
                     <div className="text-xs text-gray-400 font-bold">Add a city to see the forecast</div>
                 </button>
            )}

            {/* PRIMARY MAJOR CARD */}
            {primaryCity && <WeatherPrimaryCard city={primaryCity} />}

            {/* SECONDARY CITIES ROW */}
            {secondaryCities.length > 0 && (
                <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 no-scrollbar snap-x">
                    {secondaryCities.map((city, idx) => (
                        <WeatherSecondaryCard key={idx} city={city} />
                    ))}
                </div>
            )}

            {/* MANAGE MODAL */}
            <WeatherManageModal 
                isOpen={isManageModalOpen}
                onClose={() => setIsManageModalOpen(false)}
                locations={trip.weatherLocations || []}
                onUpdateLocations={updateTripLocations}
            />

            {/* TOAST MESSAGE */}
            {toastMsg && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-ink/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-md z-[100] animate-in fade-in slide-in-from-bottom-2 duration-300 whitespace-nowrap pointer-events-none">
                    {toastMsg}
                </div>
            )}
        </div>
    );
};