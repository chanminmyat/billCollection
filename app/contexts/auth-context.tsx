'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface CollectorProfile {
  id?: string;
  collectorCode?: string;
  address?: string;
  township?: string;
  region?: string;
  route?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CustomerProfile {
  id?: string;
  customerCode?: string;
  accountNumber?: string;
  address?: string;
  phone?: string;
  packageName?: string;
  billingCycle?: string;
  statusDescription?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface User {
  id: string;
  username?: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'collector' | 'customer';
  name: string;
  status?: string;
  collectorProfile?: CollectorProfile | null;
  customerProfile?: CustomerProfile | null;
  createdAt?: string;
  updatedAt?: string;
}

interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  username?: string;
  collectorProfile?: Partial<CollectorProfile> | null;
  customerProfile?: Partial<CustomerProfile> | null;
}

interface AuthContextType {
  user: User | null;
  login: (identifier: string, password: string) => Promise<void>;
  updateProfile: (updates: UpdateProfilePayload) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedUser = localStorage.getItem('billflow_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const isResetRoute = pathname?.startsWith('/reset-password');
      const isSuperAdminRoute = pathname?.startsWith('/super-admin');
      if (!user && pathname !== '/' && !isResetRoute && !isSuperAdminRoute) {
        router.push('/');
      } else if (user && pathname === '/') {
        const dashboardPath = user.role === 'admin' ? '/admin' : user.role === 'collector' ? '/collector' : '/customer';
        router.push(dashboardPath);
      }
    }
  }, [user, pathname, router, isLoading]);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.message ?? 'Invalid credentials';
        throw new Error(message);
      }

      const userData = data?.user;

      if (!userData || !userData.role) {
        throw new Error('Invalid response from server');
      }

      setUser(userData);
      localStorage.setItem('billflow_user', JSON.stringify(userData));

      const dashboardPath =
        userData.role === 'admin'
          ? '/admin'
          : userData.role === 'collector'
            ? '/collector'
            : '/customer';

      router.push(dashboardPath);
    } catch (error) {
      setUser(null);
      localStorage.removeItem('billflow_user');
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unable to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: UpdateProfilePayload) => {
    if (!user) {
      throw new Error('You must be logged in to update your profile.');
    }

    setIsLoading(true);

    try {
      const accountPayload = ['name', 'email', 'phone', 'username'].reduce<Record<string, string>>((acc, key) => {
        const typedKey = key as keyof UpdateProfilePayload;
        const value = updates[typedKey] as string | undefined;
        if (value !== undefined && value !== null) {
          acc[key] = value;
        }
        return acc;
      }, {});

      const body: Record<string, unknown> = {};
      if (Object.keys(accountPayload).length > 0) {
        body.account = accountPayload;
      }

      const collectorProfilePayload =
        user.role === 'collector' && Object.prototype.hasOwnProperty.call(updates, 'collectorProfile')
          ? updates.collectorProfile
          : undefined;
      const customerProfilePayload =
        user.role === 'customer' && Object.prototype.hasOwnProperty.call(updates, 'customerProfile')
          ? updates.customerProfile
          : undefined;

      if (collectorProfilePayload) {
        const { id, createdAt, updatedAt, ...rest } = collectorProfilePayload || {};
        body.collectorProfile = rest;
      }

      if (customerProfilePayload) {
        const { id, createdAt, updatedAt, ...rest } = customerProfilePayload || {};
        body.customerProfile = rest;
      }

      const response = await fetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.message ?? 'Unable to update profile';
        throw new Error(message);
      }

      const accountResponse = data?.account ?? {};
      const collectorResponse = data?.collectorProfile ?? null;
      const customerResponse = data?.customerProfile ?? null;

      const mergedUser: User = {
        ...user,
        name: accountResponse.name ?? updates.name ?? user.name,
        email: accountResponse.email ?? updates.email ?? user.email,
        phone: accountResponse.phone ?? updates.phone ?? user.phone,
        username: accountResponse.username ?? updates.username ?? user.username,
        status: accountResponse.status ?? user.status,
        collectorProfile:
          user.role === 'collector'
            ? {
                ...(user.collectorProfile ?? {}),
                ...(collectorResponse ?? {}),
                ...(updates.collectorProfile ?? {}),
              }
            : user.collectorProfile ?? null,
        customerProfile:
          user.role === 'customer'
            ? {
                ...(user.customerProfile ?? {}),
                ...(customerResponse ?? {}),
                ...(updates.customerProfile ?? {}),
              }
            : user.customerProfile ?? null,
      };

      setUser(mergedUser);
      localStorage.setItem('billflow_user', JSON.stringify(mergedUser));

      return mergedUser;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unable to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user || !user.email) {
      throw new Error('Your profile does not include an email address.');
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: user.email,
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? 'Unable to change password';
        throw new Error(message);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unable to change password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('billflow_user');
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, updateProfile, changePassword, logout, isLoading }}>
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
