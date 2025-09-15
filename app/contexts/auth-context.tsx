'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'collector' | 'customer';
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, role: 'admin' | 'collector' | 'customer') => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Mock user database
  const mockUsers = {
    admin: { id: '1', username: 'admin', role: 'admin' as const, name: 'System Admin' },
    collector1: { id: '2', username: 'collector1', role: 'collector' as const, name: 'John Collector' },
    customer1: { id: '3', username: 'customer1', role: 'customer' as const, name: 'Jane Customer' },
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('billflow_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user && pathname !== '/') {
        router.push('/');
      } else if (user && pathname === '/') {
        const dashboardPath = user.role === 'admin' ? '/admin' : user.role === 'collector' ? '/collector' : '/customer';
        router.push(dashboardPath);
      }
    }
  }, [user, pathname, router, isLoading]);

  const login = (username: string, role: 'admin' | 'collector' | 'customer') => {
    const userData = mockUsers[username as keyof typeof mockUsers];
    if (userData && userData.role === role) {
      setUser(userData);
      localStorage.setItem('billflow_user', JSON.stringify(userData));
      const dashboardPath = role === 'admin' ? '/admin' : role === 'collector' ? '/collector' : '/customer';
      router.push(dashboardPath);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('billflow_user');
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}