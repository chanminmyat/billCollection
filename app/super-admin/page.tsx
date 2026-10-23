// Super admin auth is client-side for now (env-based).
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';
import {
  fetchSystemBranding,
  readSystemBranding,
  SYSTEM_BRANDING_STORAGE_KEY,
  SYSTEM_BRANDING_UPDATED_EVENT,
} from '@/lib/system-branding';
import type { SystemBranding } from '@/lib/system-branding';
import { SUPER_ADMIN_ACCESS_TOKEN_KEY } from '@/lib/api-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branding, setBranding] = useState<SystemBranding>(() => readSystemBranding());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncBranding = () => {
      setBranding(readSystemBranding());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SYSTEM_BRANDING_STORAGE_KEY) {
        syncBranding();
      }
    };
    fetchSystemBranding()
      .then(setBranding)
      .catch(() => {
        syncBranding();
      });
    window.addEventListener('storage', onStorage);
    window.addEventListener(SYSTEM_BRANDING_UPDATED_EVENT, syncBranding as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SYSTEM_BRANDING_UPDATED_EVENT, syncBranding as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(SUPER_ADMIN_ACCESS_TOKEN_KEY)) {
        router.replace('/super-admin/dashboard');
      }
    } catch {
      // storage may be blocked; keep login form visible
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/super-admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.accessToken) {
        throw new Error(data?.message ?? 'Invalid super admin credentials.');
      }
      window.localStorage.setItem(SUPER_ADMIN_ACCESS_TOKEN_KEY, data.accessToken);
      window.localStorage.setItem('super_admin_user', data?.user?.username ?? identifier.trim());
      router.replace('/super-admin/dashboard');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#18221f] px-4 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-6 lg:max-w-lg">
            <div className="inline-flex items-center gap-3 rounded-full border border-slate-700 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
              {branding.logoDataUrl ? (
                <img src={branding.logoDataUrl} alt={`${branding.systemName} logo`} className="h-4 w-4 object-contain" />
              ) : (
                <Shield className="h-4 w-4 text-emerald-200" />
              )}
              {branding.systemName}
            </div>
            <h1 className="text-4xl font-semibold leading-tight">
              Secure control for {branding.systemName}.
            </h1>
            <p className="text-sm text-slate-400">
              {branding.systemTagline}
            </p>
          </div>

          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1e2c26] p-8 shadow-xl">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sign In</p>
                <h2 className="text-2xl font-semibold">Super Admin Login</h2>
              </div>
              <div className="space-y-2">
                <Label htmlFor="super-admin-id" className="text-slate-300">
                  Email or Username
                </Label>
                <Input
                  id="super-admin-id"
                  placeholder="superadmin@example.com"
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="super-admin-password" className="text-slate-300">
                  Password
                </Label>
                <Input
                  id="super-admin-password"
                  type="password"
                  placeholder="••••••••"
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error && <p className="text-sm text-rose-400">{error}</p>}
              <Button
                type="submit"
                className="mt-2 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Checking...' : 'Enter Console'}
              </Button>
              <p className="text-xs text-slate-500">
                Credentials are verified securely by the server.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
