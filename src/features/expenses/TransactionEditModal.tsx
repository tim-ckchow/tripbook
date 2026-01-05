import React, { useState, useEffect } from 'react';
import { Transaction, Trip, TripMember } from '../../types';
import { Button, Input } from '../../components/ui/Layout';
import { X, ArrowRight, Trash2, Lock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TransactionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Transaction, 'id' | 'tripId' | 'createdAt' | 'createdBy'>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  itemToEdit: Transaction | null;
  trip: Trip;
  members: TripMember[];
}

export const TransactionEditModal: React.FC<TransactionEditModalProps> = ({
  isOpen, onClose, onSave, onDelete, itemToEdit, trip, members
}) => {
  const { user } = useAuth();
  
  // Form State
  const [type, setType] = useState<'expense' | 'settlement'>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'JPY' | 'HKD'>('JPY');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState<string>('');
  
  // For Expense: Multi-select
  const [splitAmong, setSplitAmong] = useState<string[]>([]);
  
  // For Settlement: Single Select
  const [paidTo, setPaidTo] = useState<string>('');
  
  // Actions State
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (itemToEdit) {
        setType(itemToEdit.type);
        setTitle(itemToEdit.title);
        setAmount(itemToEdit.amount.toString());
        setCurrency(itemToEdit.currency);
        setDate(itemToEdit.date);
        setPaidBy(itemToEdit.paidBy);
        if (itemToEdit.type === 'expense') {
            setSplitAmong(itemToEdit.splitAmong);
        } else {
            setPaidTo(itemToEdit.splitAmong[0] || '');
        }
    } else {
        // Defaults
        setType('expense');
        setTitle('');
        setAmount('');
        setCurrency('JPY');
        setDate(new Date().toISOString().split('T')[0]);
        setPaidBy(user?.uid || '');
        // Default split among everyone for new expense
        const allUids = members.map(m => m.uid);
        setSplitAmong(allUids);
        setPaidTo('');
    }
    
    // Reset loading states
    setIsDeleting(false);
    setIsSaving(false);
    setShowDeleteConfirm(false);
  }, [itemToEdit, isOpen, members, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    if (!amount || isNaN(Number(amount))) return alert("Invalid amount");
    if (type === 'expense' && splitAmong.length === 0) return alert("Select at least one person to split with");
    if (type === 'settlement' && !paidTo) return alert("Select who is receiving the money");
    if (type === 'settlement' && paidBy === paidTo) return alert("Cannot pay yourself");

    setIsSaving(true);
    await onSave({
        type,
        title: type === 'settlement' ? 'Settlement' : title,
        amount: Number(amount),
        currency,
        date,
        paidBy,
        splitAmong: type === 'settlement' ? [paidTo] : splitAmong,
    });
    setIsSaving(false);
  };
  
  const handleConfirmDelete = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!itemToEdit || !onDelete) return;
      setIsDeleting(true);
      await onDelete(itemToEdit.id);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
  };

  const toggleSplit = (uid: string) => {
      if (splitAmong.includes(uid)) {
          setSplitAmong(splitAmong.filter(id => id !== uid));
      } else {
          setSplitAmong([...splitAmong, uid]);
      }
  };

  const selectAll = () => {
      if (splitAmong.length === members.length) setSplitAmong([]);
      else setSplitAmong(members.map(m => m.uid));
  };

  return (
    <div className="fixed inset-0 bg-ink/20 z-[100] flex items-end sm:items-center justify-center backdrop-blur-sm sm:p-4">
       <div className="bg-white w-full max-w-md max-h-[90dvh] h-auto rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col animate-in slide-in-from-bottom-10 overflow-hidden pb-[env(safe-area-inset-bottom)]">
          
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
             <h3 className="font-bold text-lg font-rounded">{itemToEdit ? 'Edit Transaction' : 'New Transaction'}</h3>
             <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors">
                <X size={18} />
             </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar p-5 flex flex-col gap-5">
              
              {/* Type Switcher */}
              {itemToEdit ? (
                  <div className="bg-gray-100 p-3 rounded-xl flex items-center justify-center gap-2 text-gray-400 font-bold text-sm">
                      <Lock size={14} />
                      <span>{type === 'expense' ? 'Expense' : 'Pay Back'}</span>
                  </div>
              ) : (
                  <div className="bg-gray-100 p-1 rounded-xl flex">
                      <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type === 'expense' ? 'bg-white text-ink shadow-sm' : 'text-gray-400'}`}>
                          Expense
                      </button>
                      <button type="button" onClick={() => setType('settlement')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type === 'settlement' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>
                          Pay Back
                      </button>
                  </div>
              )}

              {/* Amount Row */}
              <div className="flex gap-3">
                  <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2 mb-1">Amount</label>
                      <input 
                        type="number" 
                        placeholder="0.00" 
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full text-3xl font-bold bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-brand"
                        autoFocus
                      />
                  </div>
                  <div className="w-1/3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2 mb-1">Currency</label>
                      <div className="flex flex-col gap-1">
                          <button type="button" onClick={() => setCurrency('JPY')} className={`py-1.5 px-2 rounded-xl border-2 text-sm font-bold transition-all ${currency === 'JPY' ? 'bg-brand text-white border-brand' : 'bg-white text-gray-400 border-gray-200'}`}>JPY</button>
                          <button type="button" onClick={() => setCurrency('HKD')} className={`py-1.5 px-2 rounded-xl border-2 text-sm font-bold transition-all ${currency === 'HKD' ? 'bg-brand text-white border-brand' : 'bg-white text-gray-400 border-gray-200'}`}>HKD</button>
                      </div>
                  </div>
              </div>

              {/* Title (Only for Expense) */}
              {type === 'expense' && (
                  <Input 
                    label="Description" 
                    placeholder="Lunch, Taxi, Tickets..." 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    required
                  />
              )}

              {/* Payer */}
              <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2 mb-2 block">
                      Paid By
                  </label>
                  <div className="flex flex-wrap gap-2">
                      {members.map(m => (
                          <button 
                            key={m.uid} 
                            type="button"
                            onClick={() => setPaidBy(m.uid)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center gap-2 ${paidBy === m.uid ? 'bg-ink text-white border-ink' : 'bg-white text-gray-400 border-gray-200'}`}
                          >
                              {m.uid === user?.uid ? 'Me' : m.nickname}
                          </button>
                      ))}
                  </div>
              </div>

              {/* Split / Paid To */}
              <div>
                  {type === 'expense' ? (
                      <>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Split Among</label>
                            <button type="button" onClick={selectAll} className="text-[10px] font-bold text-brand uppercase">Select All</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {members.map(m => (
                                <button 
                                    key={m.uid} 
                                    type="button"
                                    onClick={() => toggleSplit(m.uid)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center gap-2 ${splitAmong.includes(m.uid) ? 'bg-brand/10 text-brand border-brand' : 'bg-white text-gray-400 border-gray-200'}`}
                                >
                                    {m.nickname}
                                </button>
                            ))}
                        </div>
                      </>
                  ) : (
                      <>
                         <div className="mb-4 flex items-center justify-center">
                             <ArrowRight className="text-gray-300" />
                         </div>
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2 mb-2 block">
                             Paid To
                         </label>
                         <div className="flex flex-wrap gap-2">
                            {members.filter(m => m.uid !== paidBy).map(m => (
                                <button 
                                    key={m.uid} 
                                    type="button"
                                    onClick={() => setPaidTo(m.uid)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center gap-2 ${paidTo === m.uid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-400 border-gray-200'}`}
                                >
                                    {m.nickname}
                                </button>
                            ))}
                        </div>
                      </>
                  )}
              </div>

              <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <Input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    className="!text-sm"
                    label="Date"
                  />
              </div>

              <div className="h-6"></div>
          </form>

          {/* Footer Action Bar */}
          <div className="p-4 border-t border-gray-100 bg-gray-50">
             {showDeleteConfirm ? (
                 <div className="flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in">
                     <div className="text-xs font-bold text-red-500 uppercase flex-1 flex items-center gap-2">
                         <AlertTriangle size={16} /> Confirm Delete?
                     </div>
                     <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={(e) => { e.preventDefault(); setShowDeleteConfirm(false); }}
                        className="!px-4 !py-2 text-sm"
                     >
                         Cancel
                     </Button>
                     <Button 
                        type="button" 
                        variant="danger" 
                        onClick={handleConfirmDelete}
                        disabled={isDeleting}
                        className="!px-4 !py-2 text-sm"
                     >
                         {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                     </Button>
                 </div>
             ) : (
                 <div className="flex gap-3">
                     {itemToEdit && onDelete && (
                         <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); setShowDeleteConfirm(true); }}
                            className="w-12 h-12 rounded-full border-2 border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50 transition-colors active:scale-95"
                         >
                             <Trash2 size={20} />
                         </button>
                     )}
                     <Button type="button" onClick={handleSubmit} className="w-full" disabled={isSaving}>
                         {isSaving ? 'Saving...' : (itemToEdit ? 'Save Changes' : 'Add Transaction')}
                     </Button>
                 </div>
             )}
          </div>

       </div>
    </div>
  );
};