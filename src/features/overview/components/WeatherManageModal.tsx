import React, { useState } from 'react';
import { Button, Input } from '../../../components/ui/Layout';
import { X, Search, Loader, ArrowUp, ArrowDown, Trash2, Plus, Activity, ExternalLink, Beaker } from 'lucide-react';
import { WeatherLocation } from '../../../types';

interface WeatherManageModalProps {
    isOpen: boolean;
    onClose: () => void;
    locations: WeatherLocation[];
    onUpdateLocations: (locs: WeatherLocation[]) => Promise<void>;
    betaEnabled: boolean;
    onToggleBeta: () => void;
}

export const WeatherManageModal: React.FC<WeatherManageModalProps> = ({ 
    isOpen, onClose, locations, onUpdateLocations, betaEnabled, onToggleBeta 
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Diagnostics State
    const [diagLoading, setDiagLoading] = useState(false);
    const [diagResult, setDiagResult] = useState<string | null>(null);
    const [diagUrl, setDiagUrl] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!searchQuery.trim()) return;
        
        setSearchLoading(true);
        setHasSearched(true);
        setSearchResults([]);

        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${searchQuery}&count=5&language=en&format=json`);
            const data = await res.json();
            setSearchResults(data.results || []);
        } catch (err) { console.error(err); } finally { setSearchLoading(false); }
    };

    const addCity = async (name: string, lat: number, lng: number) => {
        if (locations.some(l => l.name === name)) { alert("City already added"); return; }
        await onUpdateLocations([...locations, { name, lat, lng }]);
        setSearchQuery(''); 
        setSearchResults([]); 
        setHasSearched(false);
    };

    const removeCity = async (index: number) => {
        const currentLocs = [...locations];
        currentLocs.splice(index, 1);
        await onUpdateLocations(currentLocs);
    };

    const moveCity = async (index: number, direction: -1 | 1) => {
        const currentLocs = [...locations];
        if (index + direction < 0 || index + direction >= currentLocs.length) return;
        const temp = currentLocs[index];
        currentLocs[index] = currentLocs[index + direction];
        currentLocs[index + direction] = temp;
        await onUpdateLocations(currentLocs);
    };

    const runDiagnostics = async () => {
        if (locations.length === 0) return;
        const loc = locations[0]; // Test the first location
        setDiagLoading(true);
        setDiagResult(null);

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=weather_code&alerts=true&timezone=auto`;
        setDiagUrl(url);

        try {
            const res = await fetch(url);
            const data = await res.json();
            
            let report = `Location: ${loc.name}\n`;
            report += `Status: ${res.status} ${res.statusText}\n`;
            
            if (data.alerts && Array.isArray(data.alerts)) {
                report += `Alerts Found: ${data.alerts.length}\n`;
                if (data.alerts.length > 0) {
                    report += JSON.stringify(data.alerts, null, 2);
                } else {
                    report += "Note: Open-Meteo returns empty array if no official government warnings are active.";
                }
            } else {
                report += "Alerts field missing in response.";
            }
            setDiagResult(report);
        } catch (err: any) {
            setDiagResult(`Error: ${err.message}`);
        } finally {
            setDiagLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-ink/30 z-[100] flex items-end sm:items-center justify-center backdrop-blur-sm sm:p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-md max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 overflow-hidden pb-[env(safe-area-inset-bottom)]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg font-rounded">Manage Locations</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"><X size={18} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                    {/* Saved Cities List */}
                    <div className="space-y-2 mb-6">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Saved Cities</label>
                        {locations.length === 0 && (<div className="text-center py-4 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">No cities added yet.</div>)}
                        {locations.map((loc, idx) => (
                            <div key={`${loc.name}-${idx}`} className="flex items-center gap-3 bg-white border border-gray-200 p-3 rounded-xl shadow-sm">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}>{idx + 1}</div>
                                <div className="flex-1">
                                    <div className="font-bold text-ink truncate">{loc.name}</div>
                                    {idx === 0 && <div className="text-[10px] text-brand font-bold uppercase">Primary</div>}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => moveCity(idx, -1)} disabled={idx === 0} className="p-1.5 text-gray-400 hover:text-brand disabled:opacity-30 disabled:hover:text-gray-400"><ArrowUp size={16} /></button>
                                    <button onClick={() => moveCity(idx, 1)} disabled={idx === locations.length - 1} className="p-1.5 text-gray-400 hover:text-brand disabled:opacity-30 disabled:hover:text-gray-400"><ArrowDown size={16} /></button>
                                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                    <button onClick={() => removeCity(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add New */}
                    <div className="pt-4 border-t border-gray-100 mb-6">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Add New City</label>
                        <form onSubmit={handleSearch} className="flex gap-2 mb-3">
                            <Input 
                                placeholder="City name..." 
                                value={searchQuery} 
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    if (e.target.value === '') {
                                        setHasSearched(false);
                                        setSearchResults([]);
                                    }
                                }} 
                                className="!text-sm" 
                            />
                            <Button type="submit" disabled={searchLoading || !searchQuery.trim()} className="!px-4">
                                {searchLoading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
                            </Button>
                        </form>
                        <div className="flex flex-col gap-2">
                            {hasSearched && !searchLoading && searchResults.length === 0 && (
                                <div className="text-center py-8 text-gray-400 flex flex-col items-center">
                                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                                        <Search size={16} className="opacity-40" />
                                    </div>
                                    <span className="text-xs font-bold">No results found</span>
                                </div>
                            )}

                            {searchResults.map((res: any) => (
                                <button key={res.id} onClick={() => addCity(res.name, res.latitude, res.longitude)} className="text-left p-3 rounded-xl bg-gray-50 hover:bg-white flex justify-between items-center border border-transparent hover:border-brand transition-all group">
                                    <div><div className="font-bold text-sm text-ink">{res.name}</div><div className="text-xs text-gray-400">{res.admin1} {res.country}</div></div>
                                    <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-300 group-hover:text-brand group-hover:border-brand"><Plus size={14} /></div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* BETA FEATURES SECTION */}
                    <div className="pt-4 border-t border-gray-100 mb-6">
                        <label className="text-xs font-bold text-purple-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                            <Beaker size={12} /> Weather Warnings (Beta)
                        </label>
                        <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl">
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    id="jma-toggle" 
                                    checked={betaEnabled} 
                                    onChange={onToggleBeta}
                                    className="w-5 h-5 text-brand rounded border-gray-300 focus:ring-brand"
                                />
                                <label htmlFor="jma-toggle" className="flex-1">
                                    <div className="font-bold text-sm text-ink">Niseko JMA Feed</div>
                                    <div className="text-xs text-gray-500">Enable direct warning feed from Japan Meteorological Agency for Niseko area.</div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Diagnostics Tool */}
                    <div className="pt-4 border-t border-gray-100">
                         <div className="flex items-center justify-between mb-3">
                             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Diagnostics</label>
                             <button onClick={runDiagnostics} disabled={locations.length === 0 || diagLoading} className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-blue-100 disabled:opacity-50">
                                 <Activity size={12} /> Test API
                             </button>
                         </div>
                         
                         {diagResult && (
                             <div className="bg-gray-900 text-green-400 p-3 rounded-xl text-[10px] font-mono overflow-x-auto">
                                 <pre>{diagResult}</pre>
                                 {diagUrl && (
                                     <a href={diagUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-2 text-white underline decoration-dashed">
                                         Open Raw JSON <ExternalLink size={10} />
                                     </a>
                                 )}
                             </div>
                         )}
                         {locations.length > 0 && !diagResult && (
                             <p className="text-[10px] text-gray-400">
                                 Not seeing alerts? Click "Test API" to check if Open-Meteo is returning data.
                             </p>
                         )}
                    </div>

                </div>
            </div>
        </div>
    );
};