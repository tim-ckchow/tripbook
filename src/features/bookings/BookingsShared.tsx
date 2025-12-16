import React from 'react';
import { MapPin, Tag, Map, Bus, Plane, FileText } from 'lucide-react';

export const TypeIcon: React.FC<{ type: any }> = ({ type }) => {
    switch (type) {
        case 'sightseeing': return <MapPin className="text-blue-500" size={18} />;
        case 'food': return <Tag className="text-orange-500" size={18} />;
        case 'hotel': return <Map className="text-purple-500" size={18} />;
        case 'transport': return <Bus className="text-green-500" size={18} />;
        case 'flight': return <Plane className="text-brand" size={18} />;
        default: return <FileText className="text-gray-500" size={18} />;
    }
};

export const SubTabButton: React.FC<{ active: boolean; label: string; icon: any; onClick: () => void }> = ({ active, label, icon: Icon, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl transition-all ${active ? 'bg-ink text-white shadow-soft' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
  >
    <Icon size={20} className="mb-1" />
    <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
  </button>
);

export const AvatarFilter: React.FC<{ 
    email: string; 
    active: boolean; 
    onClick: () => void 
}> = ({ email, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all ${active ? 'bg-brand text-white border-brand' : 'bg-white text-gray-400 border-gray-200'}`}
    >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-white text-brand' : 'bg-gray-100 text-gray-500'}`}>
            {email[0].toUpperCase()}
        </div>
        <span className="text-xs font-bold">{email.split('@')[0]}</span>
    </button>
);