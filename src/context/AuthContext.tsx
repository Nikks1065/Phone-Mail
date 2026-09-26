import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Alias } from '../types.ts';
import { api } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithOtp: (phone: string, otp: string, displayName?: string) => Promise<void>;
  loginWithPassword: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  switchDemoUser: (phone: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await api.getMe();
      setUser(userData);
    } catch (err) {
      console.warn('[AUTH] Token verification failed:', err);
      api.setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithOtp = async (phone: string, otp: string, displayName?: string) => {
    const res = await api.verifyOtp(phone, otp, displayName);
    setUser(res.user);
  };

  const loginWithPassword = async (phone: string, password: string) => {
    const res = await api.passwordLogin(phone, password);
    setUser(res.user);
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  const switchDemoUser = async (phone: string) => {
    setLoading(true);
    try {
      // Prefer password fallback for seeded demo accounts (no OTP exposure required)
      try {
        await loginWithPassword(phone, 'Password123!');
        return;
      } catch {
        // Fall through to OTP when password is not set
      }
      const otpRes = await api.requestOtp(phone, 'login');
      if (!otpRes.demoCode) {
        throw new Error('Demo OTP unavailable. Start the server in development/demo mode.');
      }
      await loginWithOtp(phone, otpRes.demoCode);
    } catch (err: unknown) {
      console.error('[AUTH] Demo switch error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithOtp,
        loginWithPassword,
        logout,
        refreshUser,
        switchDemoUser
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
