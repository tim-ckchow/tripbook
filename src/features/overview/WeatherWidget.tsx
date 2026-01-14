import React, { useEffect, useState } from 'react';
import { Trip, WeatherLocation } from '../../types';
import { Plus, Settings, RefreshCw, AlertTriangle, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { CityForecast, DailyData, HourlyData, CurrentWeather, getSeverityScore, JMAWarning, mapJMACode } from './WeatherShared';
import { WeatherPrimaryCard } from './components/WeatherPrimaryCard';
import { WeatherSecondaryCard } from './components/WeatherSecondaryCard';
import { WeatherManageModal } from './components/WeatherManageModal';
import { WeatherJMAWarningCard } from './components/WeatherJMAWarningCard';
import { Card, Button } from '../../components/ui/Layout';

interface WeatherWidgetProps {
    trip: Trip;
}

// Logic to find the "worst" weather in a specific set of hours
const getSegmentDominantCode = (hours: number[]) => {
    let maxSeverity = -1;
    let dominantCode = 0; // Default clear

    hours.forEach(code => {
        const severity = getSeverityScore(code);
        if (severity > maxSeverity) {
            maxSeverity = severity;
            dominantCode = code;
        }
    });

    if (hours.length === 0) return 0;
    return dominantCode;
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ trip }) => {
    const [cities, setCities] = useState<CityForecast[]>([]);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    // JMA Beta State
    const [jmaWarnings, setJmaWarnings] = useState<JMAWarning[]>([]);
    const [jmaLoading, setJmaLoading] = useState(false);
    const isJMAEnabled = trip.betaFeatures?.enableNisekoJMA;

    // Redirect Modal State
    const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

    // --- STANDARD WEATHER FETCH ---
    useEffect(() => {
        const locations = trip.weatherLocations || [];
        // Optimistically load structure
        setCities(prevCities => {
            return locations.map((loc) => {
                const existing = prevCities.find(c => c.name === loc.name && c.lat === loc.lat);
                return {
                    name: loc.name,
                    lat: loc.lat,
                    lng: loc.lng,
                    current: existing?.current,
                    daily: existing ? existing.daily : [],
                    hourly: existing ? existing.hourly : [],
                    officialAlerts: existing ? existing.officialAlerts : [],
                    loading: existing ? existing.loading : true,
                    error: existing ? existing.error : false,
                    lastUpdated: existing?.lastUpdated
                };
            });
        });

        locations.forEach((loc) => {
             // Fetch everything from Open-Meteo
             fetchWeather(loc.lat, loc.lng).then(data => {
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

    // --- JMA BETA FETCH ---
    useEffect(() => {
        if (!isJMAEnabled) {
            setJmaWarnings([]);
            return;
        }

        const fetchJMA = async () => {
            setJmaLoading(true);
            try {
                // JMA JSON for Shiribeshi Region (Code 016000)
                const res = await fetch('https://www.jma.go.jp/bosai/warning/data/warning/016000.json');
                if (!res.ok) throw new Error('JMA Fetch Failed');
                
                const data = await res.json();
                
                // Niseko Town Code: 0139500
                // BUG FIX: Don't assume areaTypes[1]. Scan all areaTypes.
                // The JSON structure has multiple areaTypes (Forecast Areas vs Municipalities)
                let foundWarnings: JMAWarning[] = [];
                let nisekoFound = false;

                if (data.areaTypes && Array.isArray(data.areaTypes)) {
                    for (const type of data.areaTypes) {
                        if (!type.areas) continue;
                        
                        const nisekoArea = type.areas.find((a: any) => a.code === '0139500');
                        if (nisekoArea && nisekoArea.warnings) {
                            nisekoFound = true;
                            foundWarnings = nisekoArea.warnings
                                .filter((w: any) => 
                                    w.status !== '解除' && // Not Cleared
                                    w.status !== '発表なし' // Not "None"
                                )
                                .map((w: any) => {
                                    const info = mapJMACode(w.code);
                                    return {
                                        code: w.code,
                                        status: w.status,
                                        title: info.title,
                                        level: info.level
                                    };
                                });
                            break; // Found Niseko, stop searching
                        }
                    }
                }
                
                if (!nisekoFound) {
                    console.log("JMA Beta: Niseko code 0139500 not found in response.");
                }

                setJmaWarnings(foundWarnings);
            } catch (err) {
                console.warn("JMA Beta Fetch Error", err);
            } finally {
                setJmaLoading(false);
            }
        };

        fetchJMA();
        const interval = setInterval(fetchJMA, 1000 * 60 * 10); // Poll every 10m
        return () => clearInterval(interval);
    }, [isJMAEnabled]);

    const CACHE_DURATION = 1000 * 60 * 60 * 1; // 1 hour

    const fetchWeather = async (lat: number, lng: number, ignoreCache = false) => {
        const cacheKey = `weather_om_v2_${lat}_${lng}`; 
        const cachedString = localStorage.getItem(cacheKey);
        
        if (!ignoreCache && cachedString) {
            try {
                const { timestamp, data } = JSON.parse(cachedString);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    return { ...data, lastUpdated: timestamp };
                }
            } catch (e) { console.warn("Invalid cache"); }
        }

        try {
            // Fetch Open-Meteo
            const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability,precipitation,snowfall&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,precipitation_sum,snowfall_sum&timezone=auto&alerts=true`;
            const omRes = await fetch(openMeteoUrl);
            if (!omRes.ok) throw new Error('Open-Meteo API failed');
            const omData = await omRes.json();
            
            if (!omData.daily || !omData.daily.time) throw new Error("Incomplete data");

            const hourlyCodeSource = omData.hourly.weather_code || omData.hourly.weathercode || [];

            const daily: DailyData[] = [];
            for(let i=0; i<7; i++) {
                if(omData.daily.time[i]) {
                    const startHourIdx = i * 24;
                    const endHourIdx = startHourIdx + 24;
                    
                    const dayCodes: number[] = [];
                    const amCodes: number[] = [];
                    const pmCodes: number[] = [];

                    for(let h = startHourIdx; h < endHourIdx; h++) {
                        if (hourlyCodeSource[h] !== undefined) {
                            const code = hourlyCodeSource[h];
                            dayCodes.push(code);
                            const hourOfDay = h % 24;
                            if (hourOfDay >= 6 && hourOfDay < 12) amCodes.push(code);
                            if (hourOfDay >= 12 && hourOfDay <= 21) pmCodes.push(code);
                        }
                    }

                    daily.push({
                        date: omData.daily.time[i],
                        code: getSegmentDominantCode(dayCodes),
                        amCode: getSegmentDominantCode(amCodes.length > 0 ? amCodes : dayCodes),
                        pmCode: getSegmentDominantCode(pmCodes.length > 0 ? pmCodes : dayCodes),
                        max: omData.daily.temperature_2m_max[i],
                        min: omData.daily.temperature_2m_min[i],
                        maxWind: omData.daily.wind_speed_10m_max[i],
                        precipProbMax: omData.daily.precipitation_probability_max[i],
                        precipSum: omData.daily.precipitation_sum ? omData.daily.precipitation_sum[i] : 0,
                        snowSum: omData.daily.snowfall_sum ? omData.daily.snowfall_sum[i] : 0
                    });
                }
            }

            const hourly: HourlyData[] = [];
            const limit = Math.min(omData.hourly.time.length, 168); 
            for(let i=0; i<limit; i++) {
                hourly.push({
                    time: omData.hourly.time[i],
                    temp: omData.hourly.temperature_2m[i],
                    code: omData.hourly.weather_code ? omData.hourly.weather_code[i] : 0,
                    precipProb: omData.hourly.precipitation_probability[i],
                    precipAmount: omData.hourly.precipitation ? omData.hourly.precipitation[i] : 0,
                    snowAmount: omData.hourly.snowfall ? omData.hourly.snowfall[i] : 0,
                });
            }

            const current: CurrentWeather = {
                temp: omData.current.temperature_2m,
                code: omData.current.weather_code,
                windSpeed: omData.current.wind_speed_10m,
                humidity: omData.current.relative_humidity_2m
            };

            const result = { 
                current, 
                daily, 
                hourly, 
                officialAlerts: omData.alerts || [] 
            };
            const now = Date.now();

            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: now,
                data: result
            }));

            return { ...result, lastUpdated: now };
        } catch (err) { 
            console.error(err);
            if (cachedString) {
                try {
                    const { timestamp, data } = JSON.parse(cachedString);
                    return { ...data, lastUpdated: timestamp };
                } catch (e) { /* ignore */ }
            }
            throw err; 
        }
    };

    const updateTripLocations = async (newLocations: WeatherLocation[]) => {
        try { await db.collection('trips').doc(trip.id).update({ weatherLocations: newLocations }); } catch (err) { console.error(err); alert("Failed to update locations"); }
    };

    const toggleBetaJMA = async () => {
        const newVal = !isJMAEnabled;
        try {
            await db.collection('trips').doc(trip.id).update({
                'betaFeatures.enableNisekoJMA': newVal
            });
        } catch (err) { console.error(err); }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        const locations = trip.weatherLocations || [];
        let successCount = 0;
        let failCount = 0;

        await Promise.all(locations.map(async (loc) => {
            try {
                const data = await fetchWeather(loc.lat, loc.lng, true);
                setCities(prev => prev.map(c => {
                    if (c.lat === loc.lat && c.lng === loc.lng) {
                        return { ...c, ...data, loading: false, error: false };
                    }
                    return c;
                }));
                successCount++;
            } catch (err) {
                failCount++;
            }
        }));

        setRefreshing(false);
        if (failCount > 0 && successCount === 0) setToastMsg("Update failed.");
        else if (failCount > 0) setToastMsg("Some updates failed.");
        else if (successCount > 0) setToastMsg("Weather updated!");

        if (locations.length > 0) setTimeout(() => setToastMsg(null), 3000);
    };

    const openJmaRedirect = () => {
        setRedirectUrl('https://www.jma.go.jp/bosai/warning/#area_type=class20s&area_code=0139500');
    };

    const confirmRedirect = () => {
        if (redirectUrl) {
            window.open(redirectUrl, '_blank');
            setRedirectUrl(null);
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

            {/* --- JMA WARNING SECTION (BETA) --- */}
            {isJMAEnabled && (
                <div className="animate-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center px-1 mb-2 mt-2">
                        <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest flex items-center gap-1">
                             Niseko Warnings (Beta)
                        </h3>
                        <a href="https://www.jma.go.jp/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-300 font-mono">Source: JMA</a>
                    </div>
                    {jmaLoading ? (
                        <div className="h-28 bg-gray-100 animate-pulse border-2 border-gray-200"></div>
                    ) : jmaWarnings.length > 0 ? (
                        <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 no-scrollbar snap-x">
                            {jmaWarnings.map((warning, idx) => (
                                <WeatherJMAWarningCard 
                                    key={idx} 
                                    warning={warning} 
                                    regionName="Niseko" 
                                    onClick={openJmaRedirect}
                                />
                            ))}
                        </div>
                    ) : (
                        <div 
                            onClick={openJmaRedirect}
                            className="p-4 bg-[#00C853] !rounded-none border-2 border-green-800 flex items-center gap-3 cursor-pointer hover:bg-[#00E676] active:scale-95 transition-all group shadow-none relative overflow-hidden"
                        >
                            {/* Subtle Pattern */}
                             <div className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(circle,black_1px,transparent_1px)] bg-[length:10px_10px]"></div>

                            <div className="w-10 h-10 border-2 border-white/30 text-white flex items-center justify-center relative z-10 bg-black/10">
                                <CheckCircle2 size={20} />
                            </div>
                            <div className="flex-1 relative z-10">
                                <div className="font-black text-white text-base uppercase tracking-tight leading-none mb-1">No Active Warnings</div>
                                <div className="text-[10px] text-white/90 font-mono uppercase flex items-center gap-1">
                                    Niseko (Shiribeshi) <ExternalLink size={10} className="opacity-50" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {cities.length === 0 && (
                 <button onClick={() => setIsManageModalOpen(true)} className="text-center py-8 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50 hover:bg-gray-100 transition-colors flex flex-col items-center gap-2">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-400"><Plus size={20} /></div>
                     <div className="text-xs text-gray-400 font-bold">Add a city to see the forecast</div>
                 </button>
            )}

            {primaryCity && <WeatherPrimaryCard city={primaryCity} />}

            {secondaryCities.length > 0 && (
                <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 no-scrollbar snap-x">
                    {secondaryCities.map((city, idx) => (
                        <WeatherSecondaryCard key={idx} city={city} />
                    ))}
                </div>
            )}

            <WeatherManageModal 
                isOpen={isManageModalOpen}
                onClose={() => setIsManageModalOpen(false)}
                locations={trip.weatherLocations || []}
                onUpdateLocations={updateTripLocations}
                betaEnabled={!!isJMAEnabled}
                onToggleBeta={toggleBetaJMA}
            />

            {toastMsg && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-ink/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-md z-[100] animate-in fade-in slide-in-from-bottom-2 duration-300 whitespace-nowrap pointer-events-none">
                    {toastMsg}
                </div>
            )}

            {/* REDIRECT CONFIRMATION MODAL */}
            {redirectUrl && (
                <div className="fixed inset-0 bg-ink/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-xs text-center p-6">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ExternalLink size={24} />
                        </div>
                        <h3 className="font-bold text-lg text-ink mb-2">Leave TripBook?</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            You are about to visit the official <strong>Japan Meteorological Agency</strong> website.
                        </p>
                        <div className="flex gap-2">
                            <Button 
                                variant="secondary" 
                                onClick={() => setRedirectUrl(null)} 
                                className="flex-1 text-xs"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={confirmRedirect} 
                                className="flex-1 text-xs bg-blue-600 border-blue-600"
                            >
                                Visit Site
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
