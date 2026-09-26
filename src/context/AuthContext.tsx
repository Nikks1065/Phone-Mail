import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types.ts';
import { api } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithUsername: (username: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string, displayName?: string) => Promise<void>;
  loginWithPassword: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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
    } catch {
      api.setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithUsername = async (username: string, password: string) => {
    const res = await api.login(username, password);
    setUser(res.user);
  };

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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithUsername,
        loginWithOtp,
        loginWithPassword,
        logout,
        refreshUser
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
