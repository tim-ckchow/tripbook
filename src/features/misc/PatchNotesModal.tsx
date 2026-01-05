import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/Layout';
import { X, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';

interface PatchNote {
  id: string;
  version: string;
  tag?: string;
  order: number;
  sections: {
    title: string;
    items: string[];
  }[];
}

interface PatchNotesModalProps {
  onClose: () => void;
}

export const PatchNotesModal: React.FC<PatchNotesModalProps> = ({ onClose }) => {
  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState(false);

  useEffect(() => {
    setLoadingNotes(true);
    setNotesError(false);
    const unsub = db.collection('patch_notes')
        .orderBy('order', 'desc')
        .onSnapshot((snapshot) => {
            const fetchedNotes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PatchNote[];
            setNotes(fetchedNotes);
            setLoadingNotes(false);
            setNotesError(false);
        }, (err) => {
            console.warn("Failed to load patch notes", err.message);
            setLoadingNotes(false);
            setNotesError(true);
        });
    return () => unsub();
  }, []);

  const renderNoteItem = (text: any) => {
      if (typeof text !== 'string') return String(text || '');
      const parts = text.split(':');
      if (parts.length > 1) {
          return (
              <span>
                  <span className="font-bold text-ink">{parts[0]}:</span>
                  {parts.slice(1).join(':')}
              </span>
          );
      }
      return text;
  };

  return (
    <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
        <div 
            className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
        >
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/90 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-500">
                        <Sparkles size={16} />
                    </div>
                    <div>
                    <h3 className="font-bold text-lg font-rounded text-ink leading-none">Patch Notes</h3>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Latest Updates</div>
                    </div>
                </div>
                <button 
                onClick={onClose} 
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
            
            <div className="p-6 overflow-y-auto no-scrollbar flex-1">
                {loadingNotes && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                        <RefreshCw className="animate-spin" size={20} />
                        <span className="text-xs font-bold">Loading updates...</span>
                    </div>
                )}
                
                {!loadingNotes && notesError && (
                    <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                        <AlertTriangle size={24} className="mb-2 opacity-50 text-red-400"/>
                        <p className="text-sm font-bold text-red-400">Unable to load notes</p>
                        <p className="text-xs max-w-[200px] mt-1">Check your connection or permissions.</p>
                    </div>
                )}

                {!loadingNotes && !notesError && notes.length === 0 && (
                        <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                            <Sparkles size={24} className="mb-2 opacity-50"/>
                            <p className="text-sm font-bold">No updates yet.</p>
                            <p className="text-xs max-w-[200px] mt-1">We'll post new features here soon!</p>
                        </div>
                )}

                <div className="space-y-8">
                    {notes.map((note, index) => {
                        const isFirst = index === 0;
                        const opacityClass = isFirst ? 'opacity-100' : 'opacity-60 hover:opacity-100 transition-opacity';
                        const dotClass = isFirst ? 'bg-brand border-white shadow-sm' : 'bg-gray-200 border-white';
                        
                        return (
                            <div key={note.id} className={`relative ${opacityClass}`}>
                                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gray-100 rounded-full"></div>
                                <div className="pl-6 relative">
                                    <div className={`absolute -left-[5px] top-0 w-3 h-3 rounded-full border-2 ${dotClass}`}></div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`font-black text-xl font-rounded ${isFirst ? 'text-ink' : 'text-gray-400'}`}>
                                            {note.version}
                                        </span>
                                        {note.tag && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${isFirst ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-400'}`}>
                                                {note.tag}
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        {Array.isArray(note.sections) && note.sections.map((section, sIdx) => (
                                            <div key={sIdx}>
                                                <h4 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-2">
                                                    {section.title}
                                                </h4>
                                                <ul className="space-y-2">
                                                    {Array.isArray(section.items) && section.items.map((item, iIdx) => (
                                                        <li key={iIdx} className="text-sm text-gray-600 pl-3 border-l-2 border-gray-100">
                                                            {renderNoteItem(item)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 sticky bottom-0 z-10">
                <Button onClick={onClose} className="w-full">
                    Close
                </Button>
            </div>
        </div>
    </div>
  );
};