import React from 'react';
import { ScheduleType } from '../../types';
import { MapPin, Coffee, Bed, Bus, Plane } from 'lucide-react';

export const TypeIcon: React.FC<{ type: ScheduleType }> = ({ type }) => {
  switch (type) {
    case 'sightseeing': return <MapPin className="text-blue-500" size={18} />;
    case 'food': return <Coffee className="text-orange-500" size={18} />;
    case 'hotel': return <Bed className="text-purple-500" size={18} />;
    case 'transport': return <Bus className="text-green-500" size={18} />;
    case 'flight': return <Plane className="text-brand" size={18} />;
  }
};

export const AvatarPile: React.FC<{ emails: string[], size?: 'sm' | 'md' }> = ({ emails, size = 'sm' }) => {
  if (!emails || emails.length === 0) return null;
  
  const dims = size === 'md' ? 'w-9 h-9 text-[10px]' : 'w-6 h-6 text-[8px]';

  return (
    <div className="flex -space-x-2">
      {emails.slice(0, 4).map((email, i) => (
        <div key={email} className={`${dims} rounded-full bg-paper border-2 border-white flex items-center justify-center font-bold text-gray-600 uppercase shadow-sm`} title={email}>
          {email[0]}
        </div>
      ))}
      {emails.length > 4 && (
        <div className={`${dims} rounded-full bg-gray-100 border-2 border-white flex items-center justify-center font-bold text-gray-500 shadow-sm`}>
          +{emails.length - 4}
        </div>
      )}
    </div>
  );
};

export const ParticipantTags: React.FC<{ emails: string[], className?: string }> = ({ emails, className = "justify-end" }) => {
  if (!emails || emails.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {emails.slice(0, 2).map((email) => (
        <div key={email} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full pl-0.5 pr-2 py-0.5 shadow-sm">
          <div className="w-4 h-4 rounded-full bg-brand text-white text-[8px] flex items-center justify-center font-black uppercase">
            {email[0]}
          </div>
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">{email.split('@')[0]}</span>
        </div>
      ))}
      {emails.length > 2 && (
        <div className="bg-gray-100 text-gray-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-gray-200">
          +{emails.length - 2}
        </div>
      )}
    </div>
  );
};

export const AvatarFilter: React.FC<{ 
    email: string; 
    active: boolean; 
    onClick: () => void 
}> = ({ email, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all flex-shrink-0 ${active ? 'bg-ink text-white border-ink' : 'bg-white text-gray-400 border-gray-200'}`}
    >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-white text-ink' : 'bg-gray-100 text-gray-500'}`}>
            {email[0].toUpperCase()}
        </div>
        <span className="text-xs font-bold">{email.split('@')[0]}</span>
    </button>
);