import React from 'react';
import { X, Construction } from 'lucide-react';
import { Button } from '../../components/ui/Layout';

interface DummyPageProps {
  title: string;
  onClose: () => void;
}

export const DummyPage: React.FC<DummyPageProps> = ({ title, onClose }) => {
  return (
    <div className="fixed inset-0 bg-ink/50 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in" style={{ zIndex: 9999 }}>
      <div 
        className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg font-rounded">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-10 flex flex-col items-center justify-center text-center gap-4">
           <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-2">
              <Construction size={40} />
           </div>
           <h4 className="text-xl font-bold text-ink">Coming Soon</h4>
           <p className="text-gray-500 text-sm max-w-[200px]">
             The <strong>{title}</strong> page is currently under development.
           </p>
        </div>
        
        <div className="p-4 border-t border-gray-100">
           <Button onClick={onClose} className="w-full" variant="secondary">Got it</Button>
        </div>
      </div>
    </div>
  );
};