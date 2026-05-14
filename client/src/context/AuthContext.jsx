import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // After email confirmation redirect, send user to correct dashboard
      if (event === 'SIGNED_IN' && session?.user) {
        const role = session.user.user_metadata?.role;
        const path = window.location.pathname;
        if (path === '/' || path === '') {
          window.location.href = role === 'veterinarian' ? '/vet' : '/dashboard';
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function register({ email, password, fullName, role, qrToken, ownerId }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role, qr_token: qrToken ?? null, owner_id: ownerId ?? null } },
    });
    if (error) throw error;
    return data;
  }

  async function login({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function refreshUser() {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    return session?.user ?? null;
  }

  const role = user?.user_metadata?.role ?? null;
  const fullName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const qrToken = user?.user_metadata?.qr_token ?? null;
  const ownerId = user?.user_metadata?.owner_id ?? null;

  return (
    <AuthContext.Provider value={{ user, role, fullName, qrToken, ownerId, loading, register, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
