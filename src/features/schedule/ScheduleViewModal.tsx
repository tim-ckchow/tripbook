import React from 'react';
import { ScheduleItem } from '../../types';
import { Button } from '../../components/ui/Layout';
import { MapPin, Users, Calendar, X, Edit2, ExternalLink } from 'lucide-react';
import { TypeIcon } from './ScheduleShared';

interface ScheduleViewModalProps {
  item: ScheduleItem | null;
  onClose: () => void;
  onEdit: (item: ScheduleItem) => void;
}

export const ScheduleViewModal: React.FC<ScheduleViewModalProps> = ({ item, onClose, onEdit }) => {
  if (!item) return null;

  const getSafeLink = (link?: string) => {
    if (!link) return '';
    if (link.startsWith('http://') || link.startsWith('https://')) return link;
    return `https://${link}`;
  };

  return (
      <div className="fixed inset-0 bg-ink/20 z-[100] flex items-end sm:items-center justify-center backdrop-blur-sm sm:p-4" onClick={onClose}>
          <div 
              className="bg-white w-full max-w-md max-h-[90dvh] rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col animate-in slide-in-from-bottom-10 overflow-hidden pb-[env(safe-area-inset-bottom)]"
              onClick={e => e.stopPropagation()} 
          >
              {/* Header */}
              <div className="p-4 border-b border-[#E0E5D5] flex justify-between items-center bg-[#F7F4EB]">
                 <h3 className="font-bold text-lg font-rounded">Activity Details</h3>
                 <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-[#E0E5D5] flex items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors">
                    <X size={18} />
                 </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1 no-scrollbar flex flex-col gap-6">
                   
                   {/* Header Info Block */}
                   <div className="flex items-start gap-4">
                       <div className="bg-brand/10 p-4 rounded-2xl text-brand flex items-center justify-center">
                           <TypeIcon type={item.type} />
                       </div>
                       <div className="flex-1">
                           <h2 className="text-2xl font-bold font-rounded text-ink leading-tight mb-2">{item.title}</h2>
                           <div className="flex flex-col gap-1">
                               <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                                   <Calendar size={14} />
                                   {new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric'})}
                               </div>
                               <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                                   <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex items-center justify-center text-[8px] font-mono">L</div>
                                   {item.time}
                                   {item.endTime && ` - ${item.endTime}`}
                               </div>
                           </div>
                       </div>
                   </div>

                   {/* Location */}
                   {item.locationLink && (
                       <a href={getSafeLink(item.locationLink)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50/50 border border-blue-100 hover:bg-blue-50 transition-colors group">
                           <div className="bg-white p-2 rounded-full text-blue-500 shadow-sm">
                              <MapPin size={20} />
                           </div>
                           <div className="flex-1 overflow-hidden">
                               <div className="text-sm font-bold text-ink truncate">Open in Google Maps</div>
                               <div className="text-xs text-blue-500 truncate underline">{item.locationLink}</div>
                           </div>
                           <ExternalLink size={16} className="text-blue-300 group-hover:text-blue-500" />
                       </a>
                   )}

                   {/* Notes */}
                   {item.notes && (
                       <div className="bg-white rounded-2xl p-4 border border-dashed border-gray-200 shadow-sm">
                           <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</div>
                           <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{item.notes}</p>
                       </div>
                   )}
                   
                   {/* Participants */}
                   <div className="">
                       <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Users size={12} /> Who's Going
                       </div>
                       <div className="flex flex-wrap gap-2">
                           {(item.participants || []).map(email => (
                               <div key={email} className="pl-1 pr-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 flex items-center gap-2 shadow-sm">
                                   <div className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center text-[9px]">
                                        {email[0]}
                                   </div>
                                   {email.split('@')[0]}
                               </div>
                           ))}
                       </div>
                   </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#E0E5D5] bg-[#F7F4EB]">
                 <Button onClick={() => onEdit(item)} className="w-full">
                    <Edit2 size={18} /> Edit Activity
                 </Button>
              </div>
          </div>
      </div>
  );
};