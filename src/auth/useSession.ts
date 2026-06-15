/**
 * Authentication session guard hook
 * Provides derived values (isAuthenticated, isOnboarded) and loading guard
 */

import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export function useSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSession must be used within AuthProvider');
  }

  const { session, user, profile, loading, signInWithProvider, signOut, refreshProfile } = context;

  const isAuthenticated = session !== null && user !== null;
  const isOnboarded = profile !== null && Boolean(profile.nickname);

  return {
    session,
    user,
    profile,
    loading,
    isAuthenticated,
    isOnboarded,
    signInWithProvider,
    signOut,
    refreshProfile,
  };
}
