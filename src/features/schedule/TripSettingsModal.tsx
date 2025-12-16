import React, { useState } from 'react';
import { Card, Button, Input } from '../../components/ui/Layout';
import { Trip } from '../../types';

interface TripSettingsModalProps {
  trip: Trip;
  onSave: (start: string, end: string) => Promise<void>;
  onClose: () => void;
}

export const TripSettingsModal: React.FC<TripSettingsModalProps> = ({ trip, onSave, onClose }) => {
  const [editDateRange, setEditDateRange] = useState({ start: trip.startDate, end: trip.endDate });
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingSettings(true);
      await onSave(editDateRange.start, editDateRange.end);
      setSavingSettings(false);
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-ink/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
        <Card className="w-full max-w-sm">
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
                <div className="flex gap-2 mt-2">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
                    <Button type="submit" disabled={savingSettings} className="flex-1">{savingSettings ? 'Saving...' : 'Save'}</Button>
                </div>
            </form>
        </Card>
    </div>
  );
};