/**
 * Authentication Context Provider
 * Manages session state and Supabase auth integration
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthContextValue, UserProfile } from './types';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const signInWithProvider = async (provider: string): Promise<void> => {
    // TODO: Implement RED phase
  };

  const signOut = async (): Promise<void> => {
    // TODO: Implement RED phase
  };

  const refreshProfile = async (): Promise<void> => {
    // TODO: Implement RED phase
  };

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading,
    signInWithProvider,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
