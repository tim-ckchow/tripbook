import React, { useEffect, useState } from 'react';
// FIX: Switched to v8 compat style imports
import { db, firebase } from '../../lib/firebase';
import { Trip, TripMember } from '../../types';
import { Card, Button, Input } from '../../components/ui/Layout';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, Plus, LogOut, Trash2, AlertTriangle, UserMinus } from 'lucide-react';
import { TripActivityLog } from '../log/LogTab';
import { NoticeBoardCard } from '../shared/NoticeBoardCard';
import { MemberList } from './components/MemberList';

interface MembersTabProps {
  trip: Trip;
  onTripExit: () => void;
}

export const MembersTab: React.FC<MembersTabProps> = ({ trip, onTripExit }) => {
  const { user } = useAuth();
  
  const [members, setMembers] = useState<TripMember[]>([]);
  // We use trip.allowedEmails from props which is kept fresh by App.tsx listener
  
  const [newEmail, setNewEmail] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  
  // Action State
  const [actionLoading, setActionLoading] = useState(false);
  
  // Expanded Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{ 
      isOpen: boolean; 
      type: 'leave' | 'delete' | 'remove_member';
      targetMember?: { email: string; uid?: string; name?: string };
  }>({ isOpen: false, type: 'leave' });

  const isOwner = user?.uid === trip.ownerUid;

  useEffect(() => {
    // Listen to the Members Collection (Profile data for joined users)
    const unsubMembers = db.collection(`trips/${trip.id}/members`)
      .onSnapshot(snapshot => {
        const membersData = snapshot.docs.map(doc => doc.data() as TripMember);
        setMembers(membersData);
      });

    return () => unsubMembers();
  }, [trip.id]);

  // --- LOGGING HELPER ---
  const logActivity = async (action: 'create' | 'update' | 'delete', title: string, details: string) => {
    try {
        await db.collection(`trips/${trip.id}/logs`).add({
            tripId: trip.id,
            timestamp: new Date().toISOString(),
            category: 'member',
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
      
      logActivity('create', 'New Member', `Invited: ${newEmail}`);
      
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
          // CRITICAL SEQUENCE for Rules Compliance:
          // 1. Remove email from allowlist first.
          await db.collection('trips').doc(trip.id).update({
             allowedEmails: firebase.firestore.FieldValue.arrayRemove(user.email)
          });

          // 2. Delete member doc.
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
  
  const executeRemoveMember = async () => {
      if (!confirmModal.targetMember) return;
      
      setActionLoading(true);
      try {
          const { email, uid, name } = confirmModal.targetMember;

          // 1. Remove from allowedEmails
          await db.collection('trips').doc(trip.id).update({
             allowedEmails: firebase.firestore.FieldValue.arrayRemove(email)
          });

          // 2. If they have joined (have a UID/Doc), delete their member doc
          if (uid) {
              await db.collection(`trips/${trip.id}/members`).doc(uid).delete();
          }

          logActivity('delete', name || email, `Removed from trip by owner`);

          setConfirmModal({ ...confirmModal, isOpen: false });
      } catch (err) {
          console.error("Error removing member:", err);
          alert("Failed to remove member.");
      } finally {
          setActionLoading(false);
      }
  };

  const executeDeleteTrip = async () => {
      setActionLoading(true);
      try {
          await db.collection('trips').doc(trip.id).delete();
          onTripExit();
      } catch (err) {
          console.error("Error deleting trip:", err);
          alert("Failed to delete trip.");
          setActionLoading(false);
          setConfirmModal({ ...confirmModal, isOpen: false });
      }
  };
  
  const getModalContent = () => {
      switch (confirmModal.type) {
          case 'delete':
              return {
                  icon: <AlertTriangle size={32} />,
                  color: 'text-red-500',
                  bg: 'bg-red-100',
                  title: 'Delete this trip?',
                  desc: 'This action cannot be undone. All schedule data and member lists will be permanently deleted.',
                  action: 'Delete',
                  actionFn: executeDeleteTrip,
                  variant: 'danger' as const
              };
          case 'remove_member':
              return {
                  icon: <UserMinus size={32} />,
                  color: 'text-orange-500',
                  bg: 'bg-orange-100',
                  title: `Remove ${confirmModal.targetMember?.name || 'member'}?`,
                  desc: 'They will be removed from the trip and lose access immediately.',
                  action: 'Remove',
                  actionFn: executeRemoveMember,
                  variant: 'danger' as const
              };
          case 'leave':
          default:
              return {
                  icon: <LogOut size={32} />,
                  color: 'text-orange-500',
                  bg: 'bg-orange-100',
                  title: 'Leave this trip?',
                  desc: 'You will lose access to the schedule and bookings. You will need to be re-invited to join again.',
                  action: 'Leave',
                  actionFn: executeLeaveTrip,
                  variant: 'danger' as const 
              };
      }
  };
  
  const modalContent = getModalContent();

  return (
    <div className="flex flex-col gap-6 pt-4 pb-32">
      
      {/* --- NOTICE BOARD --- */}
      <NoticeBoardCard trip={trip} />

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

      {/* MEMBER LIST COMPONENT */}
      <MemberList 
        trip={trip} 
        members={members} 
        onRemoveMember={(email, uid, name) => setConfirmModal({ 
            isOpen: true, 
            type: 'remove_member',
            targetMember: { email, uid, name }
        })} 
      />

      {/* ACTIVITY LOG */}
      <TripActivityLog trip={trip} />
      
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

      {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-ink/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <Card className="w-full max-w-sm text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${modalContent.bg} ${modalContent.color}`}>
                      {modalContent.icon}
                  </div>
                  <h3 className="font-bold text-xl text-ink mb-2">
                      {modalContent.title}
                  </h3>
                  <p className="text-gray-500 text-sm mb-6">
                      {modalContent.desc}
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
                        variant={modalContent.variant}
                        onClick={modalContent.actionFn}
                        className="flex-1"
                        disabled={actionLoading}
                      >
                          {actionLoading ? 'Processing...' : modalContent.action}
                      </Button>
                  </div>
              </Card>
          </div>
      )}

    </div>
  );
};