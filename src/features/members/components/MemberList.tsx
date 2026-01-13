import React from 'react';
import { Card } from '../../../components/ui/Layout';
import { Crown, Check, Clock, UserMinus } from 'lucide-react';
import { Trip, TripMember } from '../../../types';
import { useAuth } from '../../../context/AuthContext';

interface MemberListProps {
    trip: Trip;
    members: TripMember[];
    onRemoveMember: (email: string, uid?: string, name?: string) => void;
}

export const MemberList: React.FC<MemberListProps> = ({ trip, members, onRemoveMember }) => {
    const { user } = useAuth();
    const isOwner = user?.uid === trip.ownerUid;

    return (
        <Card>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Crown size={20} className="text-yellow-500" />
            Team List
            </h3>
            <div className="flex flex-col gap-3">
            {(trip.allowedEmails || []).map((email) => {
                const memberDoc = members.find(m => m.email === email);
                const isMe = email === user?.email;
                
                return (
                    <div key={email} className="flex items-center gap-3 p-2 border-b border-gray-100 last:border-0 group">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold ${memberDoc ? 'bg-ink text-white' : 'bg-gray-100 text-gray-400'}`}>
                            {memberDoc?.nickname?.[0]?.toUpperCase() || email[0].toUpperCase()}
                        </div>
                        
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className={`font-bold text-sm ${memberDoc ? 'text-ink' : 'text-gray-400'}`}>
                                    {memberDoc ? memberDoc.nickname : email.split('@')[0]}
                                </span>
                                {memberDoc && <Check size={12} className="text-green-500" />}
                                {!memberDoc && <Clock size={12} className="text-orange-400" />}
                            </div>
                            <div className="text-xs text-gray-400">{email}</div>
                        </div>

                        {trip.ownerUid === memberDoc?.uid && (
                            <div className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                <Crown size={10} /> OWNER
                            </div>
                        )}
                        
                        {!memberDoc && (
                            <div className="bg-gray-100 text-gray-400 text-[10px] font-bold px-2 py-1 rounded-full">
                                PENDING
                            </div>
                        )}

                        {isOwner && !isMe && (
                            <button 
                                onClick={() => onRemoveMember(email, memberDoc?.uid, memberDoc?.nickname || email.split('@')[0])}
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-95"
                                title="Remove Member"
                            >
                                <UserMinus size={18} />
                            </button>
                        )}
                    </div>
                );
            })}
            </div>
        </Card>
    );
};