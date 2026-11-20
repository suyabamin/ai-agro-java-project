import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, isFirebaseClientConfigured } from '../services/firebase';
import { onAuthStateChanged, signOut as fbSignOut, sendEmailVerification, type User } from 'firebase/auth';
import { userService } from '../services/userService';
import type { UserProfile } from '../types/api';

export type PerspectiveMode = 'owner' | 'farmer';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  profileUninitialized: boolean;
  perspective: PerspectiveMode;
  error: string | null;
  setPerspective: (mode: PerspectiveMode) => void;
  refreshProfile: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  mockLogin: (role?: 'owner' | 'farmer') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileUninitialized, setProfileUninitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [perspective, setPerspectiveState] = useState<PerspectiveMode>(() => {
    const saved = localStorage.getItem('agroai_perspective');
    return saved === 'farmer' ? 'farmer' : 'owner';
  });

  const setPerspective = (mode: PerspectiveMode) => {
    setPerspectiveState(mode);
    localStorage.setItem('agroai_perspective', mode);
  };

  const loadBackendProfile = async (fbUser: User) => {
    try {
      const resp = await userService.getMe();
      if (resp.data) {
        setUser({
          ...resp.data,
          emailVerified: fbUser.emailVerified,
          name: resp.data.fullName || fbUser.displayName,
        });
        setProfileUninitialized(false);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 404) {
        // Case where Firebase Auth exists but Firestore profile not initialized yet
        setProfileUninitialized(true);
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          fullName: fbUser.displayName,
          name: fbUser.displayName,
          emailVerified: fbUser.emailVerified,
          profileVersion: 0,
        });
      } else if (axiosErr.response?.status === 403) {
        setError(axiosErr.response.data?.message || 'Access denied');
        setUser(null);
      } else {
        // Fallback to basic Firebase user info if backend is temporarily unreachable
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          fullName: fbUser.displayName,
          name: fbUser.displayName,
          emailVerified: fbUser.emailVerified,
        });
      }
    }
  };

  useEffect(() => {
    // 1. If Firebase is configured, listen to onAuthStateChanged
    if (isFirebaseClientConfigured && auth) {
      const unsubscribe = onAuthStateChanged(
        auth,
        async (fbUser: User | null) => {
          if (fbUser) {
            await loadBackendProfile(fbUser);
          } else {
            setUser(null);
            setProfileUninitialized(false);
          }
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    }

    // Mock sessions are permitted only in Vite development mode.
    const savedUser = import.meta.env.DEV ? localStorage.getItem('agroai_mock_user') : null;
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
      } catch {
        localStorage.removeItem('agroai_mock_user');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('agroai:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('agroai:unauthorized', handleUnauthorized);
  }, []);

  const refreshProfile = async () => {
    if (auth?.currentUser) {
      try {
        await auth.currentUser.getIdToken(true); // Force token refresh to load safeUid claim
      } catch (e) {
        console.warn('Token claim refresh error:', e);
      }
      await loadBackendProfile(auth.currentUser);
    }
  };

  const sendVerificationEmail = async () => {
    if (auth?.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const logout = async () => {
    if (auth) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        console.warn('Firebase signout error:', err);
      }
    }
    localStorage.removeItem('agroai_mock_user');
    localStorage.removeItem('agroai_mock_token');
    setUser(null);
    setProfileUninitialized(false);
    setError(null);
  };

  const mockLogin = (role: 'owner' | 'farmer' = 'owner') => {
    if (!import.meta.env.DEV) {
      setUser(null);
      setProfileUninitialized(false);
      return;
    }
    const mockUser: UserProfile = {
      uid: `mock-${role}-001`,
      email: `${role}@agroai.org`,
      fullName: role === 'owner' ? 'Karim Farm Owner' : 'Rahim Farmer',
      name: role === 'owner' ? 'Karim Farm Owner' : 'Rahim Farmer',
      role,
      activeRoles: role === 'owner' ? ['FARM_OWNER', 'GENERAL_USER'] : ['FARMER', 'GENERAL_USER'],
      profileVersion: 1,
      emailVerified: true,
      preferredLanguage: 'en',
      accountStatus: 'ACTIVE',
    };
    localStorage.setItem('agroai_mock_user', JSON.stringify(mockUser));
    localStorage.setItem('agroai_mock_token', `mock.jwt.token.${role}`);
    setUser(mockUser);
    setProfileUninitialized(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        profileUninitialized,
        perspective,
        error,
        setPerspective,
        refreshProfile,
        sendVerificationEmail,
        logout,
        mockLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
