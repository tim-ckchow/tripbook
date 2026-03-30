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
  const [activeTab, setActiveTab] = useState<'split' | 'budget'>('split');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  useEffect(() => {
      const fetchRates = async () => {
          try {
              const res = await fetch(`https://open.er-api.com/v6/latest/${trip.baseCurrency || 'JPY'}`);
              const data = await res.json();
              if (data && data.rates) {
                  setExchangeRates(data.rates);
              }
          } catch (err) {
              console.error("Failed to fetch exchange rates", err);
          }
      };
      fetchRates();
  }, [trip.baseCurrency]);

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
        // UPDATED: { includeMetadataChanges: true } for offline support
        .onSnapshot(
            { includeMetadataChanges: true },
            (snap) => {
                const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
                setTransactions(data);
                setLoading(false);
            }
        );
    return () => unsub();
  }, [trip.id]);

  // --- BALANCE CALCULATION ---
  const balances = useMemo(() => {
      // Init balances
      const bal: { [uid: string]: { [currency: string]: number } } = {};
      const currencies = trip.currencies && trip.currencies.length > 0 ? trip.currencies : ['JPY', 'HKD'];
      
      members.forEach(m => {
          bal[m.uid] = {};
          currencies.forEach(c => {
              bal[m.uid][c] = 0;
          });
      });

      transactions.forEach(t => {
          const { amount, currency, paidBy, splitAmong, type } = t;
          
          if (!bal[paidBy]) bal[paidBy] = {}; // Safety
          if (bal[paidBy][currency] === undefined) bal[paidBy][currency] = 0;
          
          if (type === 'expense') {
              // Payer gets +Amount
              bal[paidBy][currency] += amount;
              
              // Splitters get -Share
              const share = amount / splitAmong.length;
              splitAmong.forEach(uid => {
                  if (!bal[uid]) bal[uid] = {};
                  if (bal[uid][currency] === undefined) bal[uid][currency] = 0;
                  bal[uid][currency] -= share;
              });
          } else if (type === 'settlement') {
              // PaidBy (Giver of Cash) gets +Amount (Restoring their negative balance)
              bal[paidBy][currency] += amount;
              // Receiver gets -Amount (Reducing their positive balance)
              const receiver = splitAmong[0];
              if (receiver) {
                  if (!bal[receiver]) bal[receiver] = {};
                  if (bal[receiver][currency] === undefined) bal[receiver][currency] = 0;
                  bal[receiver][currency] -= amount;
              }
          }
      });

      return bal;
  }, [transactions, members, trip.currencies]);

  // Helpers
  const getMemberName = (uid: string) => {
      if (uid === user?.uid) return 'Me';
      return members.find(m => m.uid === uid)?.nickname || 'Unknown';
  };

  // --- LOGGING HELPER ---
  const logActivity = async (action: 'create' | 'update' | 'delete', title: string, details: string) => {
    try {
        await db.collection(`trips/${trip.id}/logs`).add({
            tripId: trip.id,
            timestamp: new Date().toISOString(),
            category: 'expense',
            action,
            title,
            details,
            userUid: user?.uid || 'unknown',
            userName: user?.displayName || user?.email?.split('@')[0] || 'Member'
        });
    } catch (err) {
        console.error("Failed to log activity", err);
    }
  };

  const handleSave = async (data: any) => {
      try {
          if (editingItem) {
              await db.collection(`trips/${trip.id}/transactions`).doc(editingItem.id).update(data);
              
              const changes: string[] = [];
              if (editingItem.amount !== data.amount) {
                  changes.push(`Amount updated from ${formatMoney(editingItem.amount, editingItem.currency)} to ${formatMoney(data.amount, data.currency)}`);
              }
              if (editingItem.title !== data.title) {
                  changes.push(`Title updated from "${editingItem.title}" to "${data.title}"`);
              }
              if (editingItem.splitAmong.length !== data.splitAmong.length) {
                  changes.push(`Split participants updated from ${editingItem.splitAmong.length} to ${data.splitAmong.length}`);
              }
              if (editingItem.paidBy !== data.paidBy) {
                  changes.push(`Payer updated from ${getMemberName(editingItem.paidBy)} to ${getMemberName(data.paidBy)}`);
              }
              
              const logMsg = changes.length > 0 ? changes.join('\n') : 'Updated details';
              logActivity('update', data.title, logMsg);

          } else {
              await db.collection(`trips/${trip.id}/transactions`).add({
                  ...data,
                  tripId: trip.id,
                  createdAt: new Date().toISOString(),
                  createdBy: user?.uid
              });
              
              const detailLines = [];
              detailLines.push(`Amount: ${formatMoney(data.amount, data.currency)}`);
              
              if (data.type === 'budget') {
                  detailLines.push(`Budget Expense`);
              } else {
                  detailLines.push(`Paid By: ${getMemberName(data.paidBy)}`);
                  if (data.type === 'settlement') {
                      detailLines.push(`To: ${getMemberName(data.splitAmong[0])}`);
                  } else {
                      detailLines.push(`Split: ${data.splitAmong.length} people`);
                  }
              }
              
              logActivity('create', data.title, detailLines.join('\n'));
          }
          setIsModalOpen(false);
          setEditingItem(null);
      } catch (err) {
          console.error(err);
          alert("Failed to save transaction.");
      }
  };

  const handleDelete = async (id: string) => {
      // Removed native confirm: handled in UI
      try {
          const docRef = db.collection(`trips/${trip.id}/transactions`).doc(id);
          const docSnap = await docRef.get();
          if (docSnap.exists) {
              const data = docSnap.data();
              // Log to main activity log instead of expense_logs
              const detailLines = [];
              detailLines.push(`Amount: ${formatMoney(data?.amount || 0, data?.currency || 'JPY')}`);
              detailLines.push(`Paid By: ${getMemberName(data?.paidBy)}`);
              
              logActivity('delete', data?.title || 'Transaction', detailLines.join('\n'));

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

  const myBalance = user ? balances[user.uid] : {};

  const budgetBalances = useMemo(() => {
      const bal: { [currency: string]: number } = {};
      transactions.forEach(t => {
          if (t.type === 'budget') {
              if (!bal[t.currency]) bal[t.currency] = 0;
              bal[t.currency] += t.amount;
          }
      });
      return bal;
  }, [transactions]);

  const totalInBaseCurrency = useMemo(() => {
      let total = 0;
      Object.entries(budgetBalances).forEach(([curr, amt]) => {
          if (curr === (trip.baseCurrency || 'JPY')) {
              total += amt;
          } else if (exchangeRates[curr]) {
              total += amt / exchangeRates[curr];
          }
      });
      return total;
  }, [budgetBalances, exchangeRates, trip.baseCurrency]);

  const splitTransactions = transactions.filter(t => t.type !== 'budget');
  const budgetTransactions = transactions.filter(t => t.type === 'budget');

  const activeCurrencies = trip.currencies && trip.currencies.length > 0 ? trip.currencies : ['JPY', 'HKD'];

  return (
    <div className="pb-24 flex flex-col gap-6">
      
      {/* --- TAB SELECTOR --- */}
      <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
              onClick={() => setActiveTab('split')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'split' ? 'bg-white text-ink shadow-sm' : 'text-gray-400'}`}
          >
              Split
          </button>
          <button 
              onClick={() => setActiveTab('budget')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'budget' ? 'bg-white text-ink shadow-sm' : 'text-gray-400'}`}
          >
              Budget
          </button>
      </div>

      {activeTab === 'split' && (
          <>
              {/* --- MY BALANCE CARD --- */}
              <Card className="bg-ink text-white !border-none relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative z-10 flex justify-between items-start">
                      <div>
                          <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">My Balance</h3>
                          <div className="flex flex-col gap-2">
                              {activeCurrencies.map(curr => (
                                  <div key={curr} className="flex items-center gap-3">
                                      <CurrencyIcon currency={curr} className="!bg-white/20 !text-white" />
                                      <span className={`text-2xl font-mono font-bold ${(myBalance?.[curr] || 0) < 0 ? 'text-red-300' : 'text-green-300'}`}>
                                          {formatMoney(myBalance?.[curr] || 0, curr)}
                                      </span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="mt-4 text-[10px] text-gray-500 flex gap-2">
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-300"></div> Owed to me</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-300"></div> I owe</span>
                  </div>
              </Card>

              {/* --- OTHERS' BALANCES --- */}
              <div className="grid grid-cols-2 gap-3">
                  {members.filter(m => m.uid !== user?.uid).map(m => {
                      const b = balances[m.uid] || {};
                      // Only show if non-zero
                      const hasNonZeroBalance = activeCurrencies.some(curr => Math.abs(b[curr] || 0) >= 1);
                      if (!hasNonZeroBalance) return null;

                      return (
                          <div key={m.uid} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                              <div className="font-bold text-sm text-ink mb-2">{m.nickname}</div>
                              <div className="space-y-1">
                                  {activeCurrencies.map(curr => {
                                      const amt = b[curr] || 0;
                                      if (Math.abs(amt) < 1) return null;
                                      return (
                                          <div key={curr} className={`text-xs font-mono font-bold flex justify-between ${amt < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                              <span>{curr}</span>
                                              <span>{Math.round(amt)}</span>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      );
                  })}
              </div>

              {/* --- TRANSACTIONS LIST --- */}
              <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center px-1">
                     <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest">Transactions</h3>
                     <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded-full text-gray-400">{splitTransactions.length}</span>
                  </div>
                  
                  {loading && <div className="text-center text-gray-400 py-10">Loading transactions...</div>}
                  
                  {!loading && splitTransactions.length === 0 && (
                      <div className="text-center py-10 opacity-50">
                          <div className="text-4xl mb-2">💸</div>
                          <p className="text-sm font-bold text-gray-400">No transactions yet.</p>
                      </div>
                  )}

                  {splitTransactions.map(t => (
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
          </>
      )}

      {activeTab === 'budget' && (
          <>
              {/* --- BUDGET BALANCE CARD --- */}
              <Card className="bg-ink text-white !border-none relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative z-10 flex justify-between items-start">
                      <div className="w-full">
                          <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-3">Total Expenses</h3>
                          <div className="flex flex-col gap-3">
                              {Object.keys(budgetBalances).length > 0 && (
                                  <div className="flex items-center justify-between w-full border-b border-white/10 pb-3 mb-1">
                                      <div className="flex items-center gap-3">
                                          <CurrencyIcon currency={trip.baseCurrency || 'JPY'} className="!bg-brand !text-white" />
                                          <div className="flex flex-col">
                                              <span className="text-3xl font-mono font-bold text-white">
                                                  {formatMoney(totalInBaseCurrency, trip.baseCurrency || 'JPY')}
                                              </span>
                                              <span className="text-[10px] text-gray-400 uppercase tracking-widest">Total in Base Currency</span>
                                          </div>
                                      </div>
                                  </div>
                              )}

                              {Object.keys(budgetBalances).length === 0 ? (
                                  <div className="text-gray-400 text-sm font-medium">No expenses recorded yet.</div>
                              ) : (
                                  Object.entries(budgetBalances).map(([curr, amt]) => (
                                      <div key={curr} className="flex items-center justify-between w-full">
                                          <div className="flex items-center gap-3">
                                              <CurrencyIcon currency={curr} className="!bg-white/20 !text-white" />
                                              <span className="text-xl font-mono font-bold text-white/80">
                                                  {formatMoney(amt, curr)}
                                              </span>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  </div>
              </Card>

              {/* --- BUDGET TRANSACTIONS LIST --- */}
              <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center px-1">
                     <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest">Budget Expenses</h3>
                     <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded-full text-gray-400">{budgetTransactions.length}</span>
                  </div>
                  
                  {loading && <div className="text-center text-gray-400 py-10">Loading transactions...</div>}
                  
                  {!loading && budgetTransactions.length === 0 && (
                      <div className="text-center py-10 opacity-50">
                          <div className="text-4xl mb-2">💸</div>
                          <p className="text-sm font-bold text-gray-400">No budget expenses yet.</p>
                      </div>
                  )}

                  {budgetTransactions.map(t => (
                      <div 
                        key={t.id} 
                        onClick={() => { setEditingItem(t); setIsModalOpen(true); }}
                        className="bg-white p-4 rounded-2xl shadow-soft border border-[#E0E5D5] flex items-center gap-4 active:scale-95 transition-transform cursor-pointer"
                      >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 bg-gray-50 border-gray-100">
                              <CategoryIcon title={t.title} type={t.type} />
                          </div>
                          
                          <div className="flex-1">
                              <div className="flex justify-between items-start">
                                  <h4 className="font-bold text-ink text-sm leading-tight">{t.title}</h4>
                                  <span className="font-mono font-bold text-sm text-ink">
                                      {formatMoney(t.amount, t.currency)}
                                  </span>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                  <div className="text-xs text-gray-400 font-medium">
                                      {t.currency}
                                  </div>
                                  <div className="text-[10px] text-gray-300 font-bold">{new Date(t.date).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </>
      )}

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
        defaultType={activeTab === 'budget' ? 'budget' : 'expense'}
      />
    </div>
  );
};
