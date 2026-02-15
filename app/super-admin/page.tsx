// Super admin auth is client-side for now (env-based).
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const superAdminUser = process.env.NEXT_PUBLIC_SUPER_ADMIN_USERNAME ?? '';
  const superAdminPass = process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD ?? '';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const authed = localStorage.getItem('super_admin_authed') === 'true';
    if (authed) {
      router.replace('/super-admin/dashboard');
    }
  }, [router]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!superAdminUser || !superAdminPass) {
      setError('Super admin credentials are not configured.');
      setIsSubmitting(false);
      return;
    }

    if (identifier.trim() !== superAdminUser || password !== superAdminPass) {
      setError('Invalid super admin credentials.');
      setIsSubmitting(false);
      return;
    }

    localStorage.setItem('super_admin_authed', 'true');
    localStorage.setItem('super_admin_user', identifier.trim());
    router.replace('/super-admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-6 lg:max-w-lg">
            <div className="inline-flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
              <Shield className="h-4 w-4 text-amber-300" />
              Super Admin Console
            </div>
            <h1 className="text-4xl font-semibold leading-tight">
              Secure control for admins, packages, and content.
            </h1>
            <p className="text-sm text-slate-400">
              This area is restricted to the system owner. Manage platform admins, WiFi packages,
              system branding, and content flows for every role.
            </p>
          </div>

          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl">
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
                  className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500"
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
                  className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error && <p className="text-sm text-rose-400">{error}</p>}
              <Button
                type="submit"
                className="mt-2 w-full bg-amber-400 text-slate-900 hover:bg-amber-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Checking...' : 'Enter Console'}
              </Button>
              <p className="text-xs text-slate-500">
                Uses environment-based credentials for now.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
