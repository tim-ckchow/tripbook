import React, { useState } from 'react';
import { Button, Input } from '../../../components/ui/Layout';
import { X, Search, Loader, ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';
import { WeatherLocation } from '../../../types';

interface WeatherManageModalProps {
    isOpen: boolean;
    onClose: () => void;
    locations: WeatherLocation[];
    onUpdateLocations: (locs: WeatherLocation[]) => Promise<void>;
}

export const WeatherManageModal: React.FC<WeatherManageModalProps> = ({ isOpen, onClose, locations, onUpdateLocations }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

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

    return (
        <div className="fixed inset-0 bg-ink/30 z-[100] flex items-end sm:items-center justify-center backdrop-blur-sm sm:p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-md max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 overflow-hidden pb-[env(safe-area-inset-bottom)]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg font-rounded">Manage Locations</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
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
                    <div className="pt-4 border-t border-gray-100">
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
                </div>
            </div>
        </div>
    );
};