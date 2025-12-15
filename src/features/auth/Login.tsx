import React, { useState } from 'react';
// FIX: Switched to v8 namespaced API
import { auth, db, firebase } from '../../lib/firebase';
import { Card, Screen } from '../../components/ui/Layout';

export const Login: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <Screen className="flex flex-col justify-center min-h-screen">
      <div className="mb-12 text-center">
        <div className="w-24 h-24 bg-brand rounded-full mx-auto mb-6 flex items-center justify-center shadow-soft border-4 border-white">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>
        <h1 className="text-4xl font-bold text-ink mb-2 tracking-tight">TripBook</h1>
        <p className="text-gray-500 font-medium text-lg">Private Group Planner</p>
      </div>

      <Card className="py-8 px-6">
        {error && <div className="bg-red-50 text-red-500 text-sm font-medium p-3 rounded-xl border border-red-100 text-center mb-6">{error}</div>}

        <p className="text-center text-gray-400 mb-6 text-sm">Sign in to access your trips</p>

        <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white border-2 border-[#E0E5D5] rounded-full py-4 font-bold text-ink flex items-center justify-center gap-3 transition-all active:scale-95 hover:-translate-y-0.5 shadow-soft hover:shadow-soft-hover disabled:opacity-70 disabled:pointer-events-none"
        >
            {loading ? (
                <span>Connecting...</span>
            ) : (
                <>
                <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
                </>
            )}
        </button>
      </Card>
      
      <div className="mt-8 text-center text-xs text-gray-300">
        v1.0.0
      </div>
    </Screen>
  );
};