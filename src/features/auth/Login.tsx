import React, { useState } from 'react';
// FIX: Switched to v8 namespaced API
import { auth, db } from '../../lib/firebase';
import { Button, Input, Card, Screen } from '../../components/ui/Layout';
import { Mail } from 'lucide-react';

export const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await auth.signInWithEmailAndPassword(email, password);
      } else {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        
        await db.collection('users').doc(cred.user!.uid).set({
          email: cred.user!.email,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen className="flex flex-col justify-center min-h-screen">
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-brand rounded-full mx-auto mb-4 flex items-center justify-center shadow-soft border-4 border-white">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>
        <h1 className="text-3xl font-bold text-ink mb-2 tracking-tight">TripBook</h1>
        <p className="text-gray-500 font-medium">Private Group Planner</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input 
            label="Email" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value.toLowerCase())} 
            required 
            placeholder="hello@example.com"
          />
          <Input 
            label="Password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            placeholder="••••••••"
          />
          
          {error && <div className="bg-red-50 text-red-500 text-sm font-medium p-3 rounded-xl border border-red-100 text-center">{error}</div>}
          
          <Button type="submit" disabled={loading} variant="secondary" className="mt-2 !bg-ink !text-white !border-ink">
            {loading ? 'Thinking...' : (isLogin ? <><Mail size={18}/> Log In</> : 'Create Account')}
          </Button>
        </form>
      </Card>

      <div className="mt-8 text-center">
        <button 
          onClick={() => setIsLogin(!isLogin)}
          className="text-gray-500 font-bold hover:text-brand transition-colors text-sm"
        >
          {isLogin ? "New here? Create an account" : "Have an account? Log In"}
        </button>
      </div>
    </Screen>
  );
};