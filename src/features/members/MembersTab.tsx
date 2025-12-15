import React, { useEffect, useState } from 'react';
// FIX: Switched to v8 compat style imports
import { db, firebase } from '../../lib/firebase';
import { Trip, TripMember } from '../../types';
import { Card, Button, Input } from '../../components/ui/Layout';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, Crown, Mail, Copy, Check, Clock, Plus } from 'lucide-react';

export const MembersTab: React.FC<{ trip: Trip }> = ({ trip }) => {
  const { user } = useAuth();
  
  // We maintain both the official members (those who have logged in/joined) 
  // and the raw allowedEmails list (for invites).
  const [members, setMembers] = useState<TripMember[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<string[]>(trip.allowedEmails || []);
  
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const isOwner = user?.uid === trip.ownerUid;

  useEffect(() => {
    // 1. Listen to the Members Collection (Profile data for joined users)
    const unsubMembers = db.collection(`trips/${trip.id}/members`)
      .onSnapshot(snapshot => {
        const membersData = snapshot.docs.map(doc => doc.data() as TripMember);
        setMembers(membersData);
      });

    // 2. Listen to the Trip Document (Real-time list of allowed emails)
    const unsubTrip = db.collection('trips').doc(trip.id)
      .onSnapshot(doc => {
        const data = doc.data() as Trip;
        if (data && data.allowedEmails) {
            setAllowedEmails(data.allowedEmails);
        }
        setLoading(false);
      });

    return () => {
        unsubMembers();
        unsubTrip();
    };
  }, [trip.id]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    
    // Simple email validation
    if (!newEmail.includes('@') || !newEmail.includes('.')) {
        alert("Please enter a valid email.");
        return;
    }

    setAddLoading(true);
    try {
      const tripRef = db.collection('trips').doc(trip.id);
      await tripRef.update({
        allowedEmails: firebase.firestore.FieldValue.arrayUnion(newEmail.trim().toLowerCase())
      });
      
      setNewEmail('');
    } catch (err) {
      console.error(err);
      alert("Failed to add member.");
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-4 pb-24">
      
      {/* ADD MEMBER FORM */}
      <Card className="border-brand/30">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
          <UserPlus size={20} className="text-brand" /> Add Team Member
        </h3>
        <p className="text-xs text-gray-500 mb-4">
            Add their email below. The trip will automatically appear in their "My Trips" list.
        </p>
        <form onSubmit={handleAddMember} className="flex gap-2">
          <Input 
            placeholder="friend@email.com" 
            type="email" 
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="!text-sm"
          />
          <Button type="submit" disabled={addLoading}>
            {addLoading ? '...' : <Plus size={18} />}
          </Button>
        </form>
      </Card>

      {/* MEMBER LIST */}
      <Card>
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
           <Crown size={20} className="text-yellow-500" />
           Team List
        </h3>
        <div className="flex flex-col gap-3">
          {allowedEmails.map((email) => {
            // Find if this email has a corresponding member doc (joined user)
            const memberDoc = members.find(m => m.email === email);
            const isMe = email === user?.email;
            
            return (
                <div key={email} className="flex items-center gap-3 p-2 border-b border-gray-100 last:border-0">
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
                </div>
            );
          })}

          {loading && <div className="text-gray-400 text-sm">Loading team...</div>}
        </div>
      </Card>
      
      <div className="flex justify-center">
          <div className="bg-gray-100 rounded-full px-4 py-1 text-[10px] text-gray-400 font-mono">
              Trip ID: {trip.id}
          </div>
      </div>

    </div>
  );
};