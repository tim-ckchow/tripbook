import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components/ui/Layout';
import { Trip } from '../../types';
import { ALL_CURRENCIES } from '../expenses/ExpenseShared';
import { db } from '../../lib/firebase';

interface TripSettingsModalProps {
  trip: Trip;
  onSave: (start: string, end: string, baseCurrency: string, currencies: string[]) => Promise<void>;
  onClose: () => void;
}

export const TripSettingsModal: React.FC<TripSettingsModalProps> = ({ trip, onSave, onClose }) => {
  const [editDateRange, setEditDateRange] = useState({ start: trip.startDate, end: trip.endDate });
  const [baseCurrency, setBaseCurrency] = useState(trip.baseCurrency || 'JPY');
  const [currencies, setCurrencies] = useState<string[]>(trip.currencies || ['JPY', 'HKD']);
  const [savingSettings, setSavingSettings] = useState(false);
  const [usedCurrencies, setUsedCurrencies] = useState<Set<string>>(new Set());

  useEffect(() => {
      const fetchUsedCurrencies = async () => {
          try {
              const snap = await db.collection(`trips/${trip.id}/transactions`).get();
              const used = new Set<string>();
              snap.docs.forEach(doc => {
                  const data = doc.data();
                  if (data.currency) {
                      used.add(data.currency);
                  }
              });
              setUsedCurrencies(used);
          } catch (err) {
              console.error("Failed to fetch used currencies:", err);
          }
      };
      fetchUsedCurrencies();
  }, [trip.id]);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingSettings(true);
      
      await onSave(editDateRange.start, editDateRange.end, baseCurrency, currencies);
      setSavingSettings(false);
      onClose();
  };

  const toggleCurrency = (curr: string) => {
      if (currencies.includes(curr)) {
          if (usedCurrencies.has(curr)) {
              alert(`Cannot remove ${curr} because it is currently used in active transactions.`);
              return;
          }
          if (curr === baseCurrency) {
              alert(`Cannot remove the base currency (${curr}). Please change the base currency first.`);
              return;
          }
          setCurrencies(currencies.filter(c => c !== curr));
      } else {
          setCurrencies([...currencies, curr].sort());
      }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
        <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto no-scrollbar">
            <h3 className="font-bold text-lg mb-4">Trip Settings</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input 
                    label="Start Date" 
                    type="date" 
                    value={editDateRange.start}
                    onChange={e => setEditDateRange({...editDateRange, start: e.target.value})}
                />
                <Input 
                    label="End Date" 
                    type="date" 
                    value={editDateRange.end}
                    onChange={e => setEditDateRange({...editDateRange, end: e.target.value})}
                />
                
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Base Currency</label>
                    <select
                        value={baseCurrency}
                        onChange={(e) => {
                            const newBase = e.target.value;
                            setBaseCurrency(newBase);
                            if (!currencies.includes(newBase)) {
                                setCurrencies([...currencies, newBase].sort());
                            }
                        }}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:border-brand font-bold"
                    >
                        {ALL_CURRENCIES.map(curr => (
                            <option key={curr} value={curr}>{curr}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Available Currencies</label>
                    <div className="bg-gray-50 border-2 border-gray-100 rounded-xl p-3 max-h-48 overflow-y-auto flex flex-wrap gap-2">
                        {ALL_CURRENCIES.map(curr => (
                            <button
                                key={curr}
                                type="button"
                                onClick={() => toggleCurrency(curr)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold border-2 transition-all ${currencies.includes(curr) ? 'bg-brand text-white border-brand' : 'bg-white text-gray-400 border-gray-200'}`}
                            >
                                {curr}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 mt-2">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
                    <Button type="submit" disabled={savingSettings} className="flex-1">{savingSettings ? 'Saving...' : 'Save'}</Button>
                </div>
            </form>
        </Card>
    </div>
  );
};
