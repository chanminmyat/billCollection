'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BadgeCheck,
  LayoutDashboard,
  Lock,
  Menu,
  Settings,
  Shield,
  Users,
  Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/super-admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/super-admin/admins', label: 'Manage Admins', icon: Users },
  { href: '/super-admin/packages', label: 'WiFi Packages', icon: Wifi },
  { href: '/super-admin/content', label: 'Content Control', icon: BadgeCheck },
  { href: '/super-admin/settings', label: 'System Settings', icon: Settings }
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/super-admin';
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const title = useMemo(() => {
    if (pathname.startsWith('/super-admin/admins')) return 'Manage Admins';
    if (pathname.startsWith('/super-admin/packages')) return 'WiFi Packages';
    if (pathname.startsWith('/super-admin/content')) return 'Content Control';
    if (pathname.startsWith('/super-admin/settings')) return 'System Settings';
    return 'Overview';
  }, [pathname]);

  if (isLogin) {
    return <div className="min-h-screen bg-slate-950 text-slate-900">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-slate-950 text-white shadow-xl transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
              <Shield className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Super Admin</p>
              <p className="text-lg font-semibold">Control Room</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="text-slate-300 hover:text-white"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-4 py-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Navigation</p>
          <nav className="mt-4 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-slate-800 px-4 py-4">
          <Link
            href="/super-admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white"
          >
            <Lock className="h-4 w-4" />
            Sign out
          </Link>
        </div>
      </div>

      <div className={sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}>
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="text-slate-600"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Console</p>
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
            <Activity className="h-4 w-4 text-emerald-500" />
            System healthy
          </div>
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
