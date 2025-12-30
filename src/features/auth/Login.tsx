import React, { useState, useEffect } from 'react';
// FIX: Switched to v8 namespaced API
import { auth, db, firebase } from '../../lib/firebase';
import { Card, Screen, Input, Button } from '../../components/ui/Layout';
import { X, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';

interface PatchNote {
  id: string;
  version: string;
  tag?: string;
  order: number;
  sections: {
    title: string;
    items: string[];
  }[];
}

export const Login: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Patch Notes State
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState(false);
  
  // Email/Pass State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // Fetch patch notes when modal opens
  useEffect(() => {
    if (showPatchNotes && notes.length === 0) {
        setLoadingNotes(true);
        setNotesError(false);
        // Assuming collection is 'patch_notes' ordered by 'order' descending
        const unsub = db.collection('patch_notes')
            .orderBy('order', 'desc')
            .onSnapshot((snapshot) => {
                const fetchedNotes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as PatchNote[];
                setNotes(fetchedNotes);
                setLoadingNotes(false);
                setNotesError(false);
            }, (err) => {
                console.warn("Failed to load patch notes", err.message);
                setLoadingNotes(false);
                setNotesError(true);
            });
        return () => unsub();
    }
  }, [showPatchNotes]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      // Use popup for better UX in SPA
      const result = await auth.signInWithPopup(provider);

      if (result.user) {
        // Check if user doc exists, if not create it
        const userRef = db.collection('users').doc(result.user.uid);
        const doc = await userRef.get();
        
        if (!doc.exists) {
          await userRef.set({
            email: result.user.email?.toLowerCase(), // Ensure lowercase for consistency
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Google login failed");
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
        setError("Please enter email and password");
        return;
    }

    setLoading(true);
    setError('');

    try {
        let result;
        if (isSignUp) {
            result = await auth.createUserWithEmailAndPassword(email, password);
        } else {
            result = await auth.signInWithEmailAndPassword(email, password);
        }

        if (result.user) {
             const userRef = db.collection('users').doc(result.user.uid);
             const doc = await userRef.get();
             
             if (!doc.exists) {
                 await userRef.set({
                    email: result.user.email?.toLowerCase(),
                    displayName: email.split('@')[0], 
                    photoURL: null,
                    createdAt: new Date().toISOString(),
                 });
             }
        }
    } catch (err: any) {
        console.error(err);
        setError(err.message || "Authentication failed");
        setLoading(false);
    }
  };

  const renderNoteItem = (text: any) => {
      // FIX: Ensure text is a string before calling .split()
      if (typeof text !== 'string') {
          return String(text || '');
      }
      // Helper to bold text before a colon (e.g. "Feature: Description")
      const parts = text.split(':');
      if (parts.length > 1) {
          return (
              <span>
                  <span className="font-bold text-ink">{parts[0]}:</span>
                  {parts.slice(1).join(':')}
              </span>
          );
      }
      return text;
  };

  return (
    <Screen className="flex flex-col justify-center min-h-screen">
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-brand rounded-full mx-auto mb-4 flex items-center justify-center shadow-soft border-4 border-white">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>
        <h1 className="text-3xl font-bold text-ink mb-1 tracking-tight">TripBook</h1>
        <p className="text-gray-400 font-medium text-sm">Private Group Planner</p>
      </div>

      <Card className="py-6 px-6">
        {error && <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-xl border border-red-100 text-center mb-4">{error}</div>}

        <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white border-2 border-[#E0E5D5] rounded-2xl py-3 font-bold text-ink flex items-center justify-center gap-3 transition-all active:scale-95 hover:-translate-y-0.5 shadow-sm hover:shadow-md disabled:opacity-70 disabled:pointer-events-none mb-6"
        >
            {loading ? (
                <span className="text-sm">Connecting...</span>
            ) : (
                <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-sm">Continue with Google</span>
                </>
            )}
        </button>

        <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400 font-bold tracking-widest">Or test with</span>
            </div>
        </div>

        <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
            <Input 
                placeholder="Email" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="!text-sm"
            />
            <Input 
                placeholder="Password" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="!text-sm"
            />
            
            <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Login')}
            </Button>

            <button 
                type="button" 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-gray-400 mt-2 font-medium hover:text-brand underline"
            >
                {isSignUp ? "Already have an account? Login" : "Need a test account? Sign Up"}
            </button>
        </form>

      </Card>
      
      <div className="mt-8 text-center flex flex-col items-center gap-3">
        <div className="text-xs text-gray-300">v1.0.1 (Test Mode)</div>
        <button 
            onClick={() => setShowPatchNotes(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E0E5D5] shadow-sm hover:shadow-md transition-all active:scale-95 group"
        >
            <Sparkles size={14} className="text-yellow-400 group-hover:rotate-12 transition-transform" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide group-hover:text-brand">What's New</span>
        </button>
      </div>

      {showPatchNotes && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
              <div 
                  className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
                  onClick={e => e.stopPropagation()}
              >
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/90 backdrop-blur-md sticky top-0 z-10">
                      <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-500">
                              <Sparkles size={16} />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg font-rounded text-ink leading-none">Patch Notes</h3>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Latest Updates</div>
                          </div>
                      </div>
                      <button 
                        onClick={() => setShowPatchNotes(false)} 
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                      >
                          <X size={18} />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto no-scrollbar flex-1">
                      {loadingNotes && (
                          <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                              <RefreshCw className="animate-spin" size={20} />
                              <span className="text-xs font-bold">Loading updates...</span>
                          </div>
                      )}
                      
                      {!loadingNotes && notesError && (
                          <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                               <AlertTriangle size={24} className="mb-2 opacity-50 text-red-400"/>
                               <p className="text-sm font-bold text-red-400">Unable to load notes</p>
                               <p className="text-xs max-w-[200px] mt-1">Check your connection or permissions.</p>
                           </div>
                      )}

                      {!loadingNotes && !notesError && notes.length === 0 && (
                           <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                               <Sparkles size={24} className="mb-2 opacity-50"/>
                               <p className="text-sm font-bold">No updates yet.</p>
                               <p className="text-xs max-w-[200px] mt-1">We'll post new features here soon!</p>
                           </div>
                      )}

                      <div className="space-y-8">
                          {notes.map((note, index) => {
                              // Style specific to the most recent/current note
                              const isFirst = index === 0;
                              const opacityClass = isFirst ? 'opacity-100' : 'opacity-60 hover:opacity-100 transition-opacity';
                              const dotClass = isFirst ? 'bg-brand border-white shadow-sm' : 'bg-gray-200 border-white';
                              
                              return (
                                  <div key={note.id} className={`relative ${opacityClass}`}>
                                      {/* Vertical Line */}
                                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gray-100 rounded-full"></div>
                                      
                                      <div className="pl-6 relative">
                                          {/* Dot */}
                                          <div className={`absolute -left-[5px] top-0 w-3 h-3 rounded-full border-2 ${dotClass}`}></div>
                                          
                                          {/* Version Header */}
                                          <div className="flex items-center gap-2 mb-3">
                                              <span className={`font-black text-xl font-rounded ${isFirst ? 'text-ink' : 'text-gray-400'}`}>
                                                  {note.version}
                                              </span>
                                              {note.tag && (
                                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${isFirst ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-400'}`}>
                                                      {note.tag}
                                                  </span>
                                              )}
                                          </div>
                                          
                                          {/* Sections */}
                                          <div className="space-y-4">
                                              {Array.isArray(note.sections) && note.sections.map((section, sIdx) => (
                                                  <div key={sIdx}>
                                                      <h4 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-2">
                                                          {section.title}
                                                      </h4>
                                                      <ul className="space-y-2">
                                                          {Array.isArray(section.items) && section.items.map((item, iIdx) => (
                                                              <li key={iIdx} className="text-sm text-gray-600 pl-3 border-l-2 border-gray-100">
                                                                  {renderNoteItem(item)}
                                                              </li>
                                                          ))}
                                                      </ul>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
                  
                  <div className="p-4 border-t border-gray-100 bg-gray-50 sticky bottom-0 z-10">
                      <Button onClick={() => setShowPatchNotes(false)} className="w-full">
                          Close
                      </Button>
                  </div>
              </div>
          </div>
      )}
    </Screen>
  );
};