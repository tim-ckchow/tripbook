import React, { useEffect, useState, useMemo } from 'react';
import { Trip, Transaction, TripMember } from '../../types';
import { db, firebase } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Card, Button } from '../../components/ui/Layout';
import { Plus, ArrowLeftRight, History, Trash2, AlertCircle } from 'lucide-react';
import { TransactionEditModal } from './TransactionEditModal';
import { CategoryIcon, CurrencyIcon, formatMoney } from './ExpenseShared';

interface ExpensesTabProps {
  trip: Trip;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({ trip }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Transaction | null>(null);
  
  // Log Modal State
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  // Fetch Members
  useEffect(() => {
    const unsub = db.collection(`trips/${trip.id}/members`).onSnapshot(snap => {
        setMembers(snap.docs.map(doc => doc.data() as TripMember));
    });
    return () => unsub();
  }, [trip.id]);

  // Fetch Transactions
  useEffect(() => {
    setLoading(true);
    const unsub = db.collection(`trips/${trip.id}/transactions`)
        .orderBy('date', 'desc')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
            setTransactions(data);
            setLoading(false);
        });
    return () => unsub();
  }, [trip.id]);

  // Fetch Logs (Lazy load only when modal opens theoretically, but simple here)
  useEffect(() => {
      if (isLogOpen) {
          db.collection(`trips/${trip.id}/expense_logs`)
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get()
            .then(snap => {
                setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
      }
  }, [isLogOpen, trip.id]);

  // --- BALANCE CALCULATION ---
  const balances = useMemo(() => {
      // Init balances
      const bal: { [uid: string]: { JPY: number, HKD: number } } = {};
      members.forEach(m => {
          bal[m.uid] = { JPY: 0, HKD: 0 };
      });

      transactions.forEach(t => {
          const { amount, currency, paidBy, splitAmong, type } = t;
          
          if (!bal[paidBy]) bal[paidBy] = { JPY: 0, HKD: 0 }; // Safety
          
          if (type === 'expense') {
              // Payer gets +Amount
              bal[paidBy][currency] += amount;
              
              // Splitters get -Share
              const share = amount / splitAmong.length;
              splitAmong.forEach(uid => {
                  if (!bal[uid]) bal[uid] = { JPY: 0, HKD: 0 };
                  bal[uid][currency] -= share;
              });
          } else if (type === 'settlement') {
              // PaidBy (Giver of Cash) gets +Amount (Restoring their negative balance)
              bal[paidBy][currency] += amount;
              // Receiver gets -Amount (Reducing their positive balance)
              const receiver = splitAmong[0];
              if (receiver) {
                  if (!bal[receiver]) bal[receiver] = { JPY: 0, HKD: 0 };
                  bal[receiver][currency] -= amount;
              }
          }
      });

      return bal;
  }, [transactions, members]);

  // Helpers
  const getMemberName = (uid: string) => {
      if (uid === user?.uid) return 'Me';
      return members.find(m => m.uid === uid)?.nickname || 'Unknown';
  };

  const handleSave = async (data: any) => {
      try {
          if (editingItem) {
              await db.collection(`trips/${trip.id}/transactions`).doc(editingItem.id).update(data);
          } else {
              await db.collection(`trips/${trip.id}/transactions`).add({
                  ...data,
                  tripId: trip.id,
                  createdAt: new Date().toISOString(),
                  createdBy: user?.uid
              });
          }
          setIsModalOpen(false);
          setEditingItem(null);
      } catch (err) {
          console.error(err);
          alert("Failed to save transaction.");
      }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Are you sure you want to delete this transaction?")) return;
      try {
          const docRef = db.collection(`trips/${trip.id}/transactions`).doc(id);
          const docSnap = await docRef.get();
          if (docSnap.exists) {
              const data = docSnap.data();
              // Create Audit Log
              await db.collection(`trips/${trip.id}/expense_logs`).add({
                  action: 'delete',
                  transactionSnapshot: data,
                  performedBy: user?.uid,
                  timestamp: new Date().toISOString()
              });
              // Delete
              await docRef.delete();
          }
          setIsModalOpen(false);
          setEditingItem(null);
      } catch (err) {
          console.error(err);
          alert("Failed to delete.");
      }
  };

  const myBalance = user ? balances[user.uid] : { JPY: 0, HKD: 0 };

  return (
    <div className="pb-24 flex flex-col gap-6">
      
      {/* --- MY BALANCE CARD --- */}
      <Card className="bg-ink text-white !border-none relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
          <div className="relative z-10 flex justify-between items-start">
              <div>
                  <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">My Balance</h3>
                  <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                          <CurrencyIcon currency="JPY" className="!bg-white/20 !text-white" />
                          <span className={`text-2xl font-mono font-bold ${(myBalance?.JPY || 0) < 0 ? 'text-red-300' : 'text-green-300'}`}>
                              {formatMoney(myBalance?.JPY || 0, 'JPY')}
                          </span>
                      </div>
                      <div className="flex items-center gap-3">
                          <CurrencyIcon currency="HKD" className="!bg-white/20 !text-white" />
                          <span className={`text-2xl font-mono font-bold ${(myBalance?.HKD || 0) < 0 ? 'text-red-300' : 'text-green-300'}`}>
                              {formatMoney(myBalance?.HKD || 0, 'HKD')}
                          </span>
                      </div>
                  </div>
              </div>
              <button onClick={() => setIsLogOpen(true)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                  <History size={18} />
              </button>
          </div>
          <div className="mt-4 text-[10px] text-gray-500 flex gap-2">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-300"></div> Owed to me</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-300"></div> I owe</span>
          </div>
      </Card>

      {/* --- OTHERS' BALANCES --- */}
      <div className="grid grid-cols-2 gap-3">
          {members.filter(m => m.uid !== user?.uid).map(m => {
              const b = balances[m.uid] || { JPY: 0, HKD: 0 };
              // Only show if non-zero
              if (Math.abs(b.JPY) < 1 && Math.abs(b.HKD) < 1) return null;

              return (
                  <div key={m.uid} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="font-bold text-sm text-ink mb-2">{m.nickname}</div>
                      <div className="space-y-1">
                          <div className={`text-xs font-mono font-bold flex justify-between ${b.JPY < 0 ? 'text-red-500' : 'text-green-600'}`}>
                              <span>JPY</span>
                              <span>{Math.round(b.JPY)}</span>
                          </div>
                          <div className={`text-xs font-mono font-bold flex justify-between ${b.HKD < 0 ? 'text-red-500' : 'text-green-600'}`}>
                              <span>HKD</span>
                              <span>{Math.round(b.HKD)}</span>
                          </div>
                      </div>
                  </div>
              );
          })}
      </div>

      {/* --- TRANSACTIONS LIST --- */}
      <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
             <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest">Transactions</h3>
             <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded-full text-gray-400">{transactions.length}</span>
          </div>
          
          {loading && <div className="text-center text-gray-400 py-10">Loading transactions...</div>}
          
          {!loading && transactions.length === 0 && (
              <div className="text-center py-10 opacity-50">
                  <div className="text-4xl mb-2">💸</div>
                  <p className="text-sm font-bold text-gray-400">No transactions yet.</p>
              </div>
          )}

          {transactions.map(t => (
              <div 
                key={t.id} 
                onClick={() => { setEditingItem(t); setIsModalOpen(true); }}
                className="bg-white p-4 rounded-2xl shadow-soft border border-[#E0E5D5] flex items-center gap-4 active:scale-95 transition-transform cursor-pointer"
              >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${t.type === 'settlement' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                      <CategoryIcon title={t.title} type={t.type} />
                  </div>
                  
                  <div className="flex-1">
                      <div className="flex justify-between items-start">
                          <h4 className="font-bold text-ink text-sm leading-tight">{t.title}</h4>
                          <span className={`font-mono font-bold text-sm ${t.type === 'settlement' ? 'text-green-600' : 'text-ink'}`}>
                              {t.type === 'settlement' ? '+' : ''}{formatMoney(t.amount, t.currency)}
                          </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                          <div className="text-xs text-gray-400 font-medium">
                              {t.type === 'settlement' ? (
                                  <span><span className="font-bold text-gray-500">{getMemberName(t.paidBy)}</span> sent to <span className="font-bold text-gray-500">{getMemberName(t.splitAmong[0])}</span></span>
                              ) : (
                                  <span><span className="font-bold text-gray-500">{getMemberName(t.paidBy)}</span> for {t.splitAmong.length} people</span>
                              )}
                          </div>
                          <div className="text-[10px] text-gray-300 font-bold">{new Date(t.date).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</div>
                      </div>
                  </div>
              </div>
          ))}
      </div>

      <button
        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
        className="fixed bottom-24 right-4 w-14 h-14 bg-brand text-white rounded-full shadow-soft hover:shadow-soft-hover hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-40"
      >
        <Plus size={28} />
      </button>

      <TransactionEditModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        onSave={handleSave}
        onDelete={handleDelete}
        itemToEdit={editingItem}
        trip={trip}
        members={members}
      />

      {/* LOG MODAL */}
      {isLogOpen && (
          <div className="fixed inset-0 bg-ink/50 z-[100] flex items-center justify-center backdrop-blur-sm p-6" onClick={() => setIsLogOpen(false)}>
              <div className="bg-white w-full max-w-sm max-h-[70vh] rounded-3xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold font-rounded">Audit Log (Deletes)</h3>
                      <button onClick={() => setIsLogOpen(false)}><X size={18}/></button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 no-scrollbar space-y-3">
                      {logs.length === 0 && <div className="text-center text-gray-400 text-xs py-4">No deletion logs found.</div>}
                      {logs.map(log => (
                          <div key={log.id} className="text-xs bg-red-50 p-3 rounded-xl border border-red-100">
                              <div className="flex items-center gap-2 font-bold text-red-500 mb-1">
                                  <Trash2 size={12} /> Transaction Deleted
                              </div>
                              <div className="text-gray-600 mb-1">
                                  <span className="font-bold">{log.transactionSnapshot.title}</span> ({formatMoney(log.transactionSnapshot.amount, log.transactionSnapshot.currency)})
                              </div>
                              <div className="text-gray-400 text-[10px]">
                                  Deleted by {getMemberName(log.performedBy)} on {new Date(log.timestamp).toLocaleString()}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

// Helper for log close
const X = ({size}: {size:number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
