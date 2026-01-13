import React, { useState, useEffect } from 'react';
import { Trip } from '../../types';
import { db } from '../../lib/firebase';
import { Card, Button } from '../../components/ui/Layout';
import { Pin, Edit2, X, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NoticeBoardCardProps {
    trip: Trip;
    className?: string;
    onRemove?: () => void;
}

export const NoticeBoardCard: React.FC<NoticeBoardCardProps> = ({ trip, className = "", onRemove }) => {
    const { user } = useAuth();
    const isOwner = user?.uid === trip.ownerUid;

    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(trip.noticeBoard || '');
    const [saving, setSaving] = useState(false);

    // Sync when trip updates
    useEffect(() => {
        if (!isEditing) {
            setText(trip.noticeBoard || '');
        }
    }, [trip.noticeBoard, isEditing]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await db.collection('trips').doc(trip.id).update({
                noticeBoard: text
            });
            
            // Log the update
            await db.collection(`trips/${trip.id}/logs`).add({
                tripId: trip.id,
                timestamp: new Date().toISOString(),
                category: 'member', // Categorized as member/admin action
                action: 'update',
                title: 'Notice Board',
                details: 'Updated board content',
                userUid: user?.uid || 'unknown',
                userName: user?.displayName || 'Member'
            });

            setIsEditing(false);
        } catch (err) {
            console.error(err);
            alert("Failed to save notice.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className={`bg-yellow-50 border-yellow-100 relative overflow-hidden ${className}`}>
            {/* Decorative Pin */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 text-red-400 drop-shadow-sm z-10">
                <Pin size={24} fill="currentColor" />
            </div>

            <div className="flex justify-between items-start mb-2 pt-2">
                <h3 className="font-bold text-lg text-yellow-800 flex items-center gap-2">
                    Trip Board
                </h3>
                <div className="flex gap-1">
                    {isOwner && !isEditing && (
                        <button 
                            onClick={() => setIsEditing(true)} 
                            className="p-1.5 bg-yellow-100 rounded-full text-yellow-700 hover:bg-yellow-200 transition-colors"
                        >
                            <Edit2 size={14} />
                        </button>
                    )}
                    {/* Optional remove button if used in dashboard context */}
                    {onRemove && (
                         <button 
                            onClick={onRemove} 
                            className="p-1.5 bg-yellow-100/50 rounded-full text-yellow-700/50 hover:bg-yellow-200 hover:text-red-500 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {isEditing ? (
                <div className="flex flex-col gap-3 animate-in fade-in">
                    <textarea 
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Enter emergency contacts, wifi passwords, insurance info..."
                        className="w-full h-32 p-3 rounded-xl border-2 border-yellow-200 bg-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
                        autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setIsEditing(false)} className="!px-3 !py-1 text-xs h-8">
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="!px-4 !py-1 text-xs h-8 bg-yellow-500 border-yellow-500 text-white">
                            {saving ? '...' : 'Save'}
                        </Button>
                    </div>
                </div>
            ) : (
                <div>
                    {trip.noticeBoard ? (
                        <p className="text-sm text-yellow-900/80 leading-relaxed whitespace-pre-wrap font-medium">
                            {trip.noticeBoard}
                        </p>
                    ) : (
                        <div className="text-center py-4 text-yellow-700/50">
                            <p className="text-xs italic font-medium">
                                {isOwner ? "Tap edit to add emergency contacts or important notes." : "No notices posted yet."}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};
