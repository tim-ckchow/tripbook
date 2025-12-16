import React, { useEffect, useState } from 'react';
// FIX: Switched to v8 compat style imports
import { db, firebase } from '../../lib/firebase';
import { Trip, TripMember } from '../../types';
import { Card, Button, Input } from '../../components/ui/Layout';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, Crown, Check, Clock, Plus, LogOut, Trash2, AlertTriangle } from 'lucide-react';

interface MembersTabProps {
  trip: Trip;
  onTripExit: () => void;
}

export const MembersTab: React.FC<MembersTabProps> = ({ trip, onTripExit }) => {
  const { user } = useAuth();
  
  // We maintain both the official members (those who have logged in/joined) 
  // and the raw allowedEmails list (for invites).
  const [members, setMembers] = useState<TripMember[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<string[]>(trip.allowedEmails || []);
  
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  
  // Action State
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: 'leave' | 'delete' }>({ isOpen: false, type: 'leave' });

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
        // Handle case where doc is deleted while listener is active
        if (!doc.exists) return;

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

  const executeLeaveTrip = async () => {
      if (!user) return;
      setActionLoading(true);
      try {
          // CRITICAL SEQUENCE:
          // 1. Remove email from allowlist first.
          // This ensures that we are modifying the trip document while we still have the 'member' document,
          // which grants us the permission to update via the `hasMemberDoc` rule.
          await db.collection('trips').doc(trip.id).update({
             allowedEmails: firebase.firestore.FieldValue.arrayRemove(user.email)
          });

          // 2. Delete member doc.
          // Now we can safely remove our own member record.
          await db.collection(`trips/${trip.id}/members`).doc(user.uid).delete();

          // Exit to trip list
          onTripExit();
      } catch (err) {
          console.error("Error leaving trip:", err);
          alert("Failed to leave trip.");
          setActionLoading(false);
          setConfirmModal({ ...confirmModal, isOpen: false });
      }
  };

  const executeDeleteTrip = async () => {
      setActionLoading(true);
      try {
          // Just delete the trip document as requested
          await db.collection('trips').doc(trip.id).delete();
          // Exit to trip list
          onTripExit();
      } catch (err) {
          console.error("Error deleting trip:", err);
          alert("Failed to delete trip.");
          setActionLoading(false);
          setConfirmModal({ ...confirmModal, isOpen: false });
      }
  };

  return (
    <div className="flex flex-col gap-6 pt-4 pb-32">
      
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
      
      {/* DANGER ZONE ACTIONS */}
      <div className="mt-4 px-2">
          {isOwner ? (
              <button 
                  onClick={() => setConfirmModal({ isOpen: true, type: 'delete' })}
                  className="w-full py-4 rounded-3xl border-2 border-red-100 bg-red-50 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors active:scale-95"
              >
                  <Trash2 size={20} /> Delete Trip
              </button>
          ) : (
              <button 
                  onClick={() => setConfirmModal({ isOpen: true, type: 'leave' })}
                  className="w-full py-4 rounded-3xl border-2 border-orange-100 bg-orange-50 text-orange-500 font-bold flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors active:scale-95"
              >
                  <LogOut size={20} /> Leave Trip
              </button>
          )}
      </div>

      <div className="flex justify-center mt-2">
          <div className="bg-gray-100 rounded-full px-4 py-1 text-[10px] text-gray-400 font-mono">
              Trip ID: {trip.id}
          </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-ink/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <Card className="w-full max-w-sm text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${confirmModal.type === 'delete' ? 'bg-red-100 text-red-500' : 'bg-orange-100 text-orange-500'}`}>
                      <AlertTriangle size={32} />
                  </div>
                  <h3 className="font-bold text-xl text-ink mb-2">
                      {confirmModal.type === 'delete' ? 'Delete this trip?' : 'Leave this trip?'}
                  </h3>
                  <p className="text-gray-500 text-sm mb-6">
                      {confirmModal.type === 'delete' 
                        ? 'This action cannot be undone. All schedule data and member lists will be permanently deleted.' 
                        : 'You will lose access to the schedule and bookings. You will need to be re-invited to join again.'
                      }
                  </p>
                  
                  <div className="flex gap-3">
                      <Button 
                        variant="secondary" 
                        onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                        className="flex-1"
                        disabled={actionLoading}
                      >
                          Cancel
                      </Button>
                      <Button 
                        variant="danger"
                        onClick={confirmModal.type === 'delete' ? executeDeleteTrip : executeLeaveTrip}
                        className={`flex-1 ${confirmModal.type === 'leave' ? '!bg-orange-500 !border-orange-500' : ''}`}
                        disabled={actionLoading}
                      >
                          {actionLoading ? 'Processing...' : (confirmModal.type === 'delete' ? 'Delete' : 'Leave')}
                      </Button>
                  </div>
              </Card>
          </div>
      )}

    </div>
  );
};