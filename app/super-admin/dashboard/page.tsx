import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, ArrowUpRight, BadgeCheck, Settings, Users, Wifi } from 'lucide-react';

const metrics = [
  { label: 'Active Admins', value: '12', trend: '+2', icon: Users },
  { label: 'WiFi Packages', value: '9', trend: '+1', icon: Wifi },
  { label: 'Content Items', value: '42', trend: '+4', icon: BadgeCheck },
  { label: 'System Status', value: 'Stable', trend: '99.9%', icon: Activity }
];

const quickLinks = [
  { label: 'Manage Admins', href: '/super-admin/admins', icon: Users },
  { label: 'Update Packages', href: '/super-admin/packages', icon: Wifi },
  { label: 'Content Rules', href: '/super-admin/content', icon: BadgeCheck },
  { label: 'System Branding', href: '/super-admin/settings', icon: Settings }
];

export default function SuperAdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Control Overview</h2>
          <p className="text-sm text-slate-500">Track system health and manage critical resources.</p>
        </div>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          All systems operational
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-500">{item.label}</CardTitle>
                <Icon className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-slate-900">{item.value}</div>
                <div className="text-xs text-emerald-600">{item.trend}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-slate-500" />
                  {link.label}
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent System Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-slate-900">Admin onboarding guidelines updated.</p>
              <p>Content pack v2 applied to collector onboarding screens.</p>
            </div>
            <Button variant="ghost" size="sm">
              View
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-slate-900">Package pricing audit scheduled.</p>
              <p>Next review window: 3 days.</p>
            </div>
            <Button variant="ghost" size="sm">
              Review
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
