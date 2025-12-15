import React, { createContext, useContext, useEffect, useState } from 'react';
// FIX: The User, onAuthStateChanged, and signOut imports are for Firebase v9 modular API.
// Switched to v8 namespaced API to match the likely project setup given the errors.
// FIX: Switched to v8 compat imports to resolve firebase types and methods.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  // FIX: Use firebase.User type for v8.
  user: firebase.User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // FIX: Use firebase.User type for v8.
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // FIX: Use auth.onAuthStateChanged method for v8.
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    // FIX: Use auth.signOut method for v8.
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};