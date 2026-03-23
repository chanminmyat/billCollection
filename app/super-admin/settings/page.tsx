'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_FIXED_BILLING_WINDOW,
  getFixedBillingWindow,
  saveFixedBillingWindow
} from '@/lib/billing-config';

export default function SuperAdminSettingsPage() {
  const { toast } = useToast();
  const [systemName, setSystemName] = useState('');
  const [systemTagline, setSystemTagline] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [adminWelcome, setAdminWelcome] = useState('');
  const [collectorNotice, setCollectorNotice] = useState('');
  const [customerBanner, setCustomerBanner] = useState('');
  const [footerText, setFooterText] = useState('');
  const [fixedStartDay, setFixedStartDay] = useState<string>(
    String(DEFAULT_FIXED_BILLING_WINDOW.startDay)
  );
  const [fixedDueDay, setFixedDueDay] = useState<string>(
    String(DEFAULT_FIXED_BILLING_WINDOW.dueDay)
  );

  useEffect(() => {
    const windowConfig = getFixedBillingWindow();
    setFixedStartDay(String(windowConfig.startDay));
    setFixedDueDay(String(windowConfig.dueDay));
  }, []);

  const handleSaveSettings = () => {
    const nextStartDay = Number.parseInt(fixedStartDay || '', 10);
    const nextDueDay = Number.parseInt(fixedDueDay || '', 10);

    if (!Number.isFinite(nextStartDay) || nextStartDay < 1 || nextStartDay > 31) {
      toast({
        title: 'Invalid fixed start day',
        description: 'Fixed start day must be between 1 and 31.',
        variant: 'destructive'
      });
      return;
    }

    if (!Number.isFinite(nextDueDay) || nextDueDay < 1 || nextDueDay > 31) {
      toast({
        title: 'Invalid fixed due day',
        description: 'Fixed due day must be between 1 and 31.',
        variant: 'destructive'
      });
      return;
    }

    if (nextDueDay < nextStartDay) {
      toast({
        title: 'Invalid fixed window',
        description: 'Due day must be on or after fixed start day.',
        variant: 'destructive'
      });
      return;
    }

    const saved = saveFixedBillingWindow({
      startDay: nextStartDay,
      dueDay: nextDueDay
    });

    setFixedStartDay(String(saved.startDay));
    setFixedDueDay(String(saved.dueDay));

    toast({
      title: 'Settings saved',
      description: `Fixed billing window updated to ${saved.startDay} - ${saved.dueDay}.`
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">System Settings</h2>
        <p className="text-sm text-slate-500">Update branding and platform configuration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="systemName">System Name</Label>
            <Input
              id="systemName"
              placeholder="Bill Pro"
              value={systemName}
              onChange={(event) => setSystemName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemTagline">Tagline</Label>
            <Input
              id="systemTagline"
              placeholder="Billing Management Platform"
              value={systemTagline}
              onChange={(event) => setSystemTagline(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="logoUpload">System Logo</Label>
            <Input id="logoUpload" type="file" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Color</Label>
            <Input
              id="primaryColor"
              placeholder="#1D4ED8"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryColor">Secondary Color</Label>
            <Input
              id="secondaryColor"
              placeholder="#0F172A"
              value={secondaryColor}
              onChange={(event) => setSecondaryColor(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fixedStartDay">Fixed Mode Start Day</Label>
            <Input
              id="fixedStartDay"
              value={fixedStartDay}
              onChange={(event) =>
                setFixedStartDay(event.target.value.replace(/\D/g, '').slice(0, 2))
              }
              placeholder="1"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fixedDueDay">Fixed Mode Due Day</Label>
            <Input
              id="fixedDueDay"
              value={fixedDueDay}
              onChange={(event) =>
                setFixedDueDay(event.target.value.replace(/\D/g, '').slice(0, 2))
              }
              placeholder="15"
              inputMode="numeric"
            />
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">
            Current fixed window: day {fixedStartDay || '-'} to day {fixedDueDay || '-'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing Rule Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            `+ fees` and `- fees` have been moved to <span className="font-medium">Super Admin → Billing Rules</span>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="adminWelcome">Admin Welcome Copy</Label>
            <Input
              id="adminWelcome"
              placeholder="Welcome to the admin dashboard..."
              value={adminWelcome}
              onChange={(event) => setAdminWelcome(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collectorNote">Collector Notice</Label>
            <Input
              id="collectorNote"
              placeholder="Reminder message for collectors"
              value={collectorNotice}
              onChange={(event) => setCollectorNotice(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerBanner">Customer Banner</Label>
            <Input
              id="customerBanner"
              placeholder="Announcement for customers"
              value={customerBanner}
              onChange={(event) => setCustomerBanner(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerText">Footer Text</Label>
            <Input
              id="footerText"
              placeholder="© 2025 Bill Pro"
              value={footerText}
              onChange={(event) => setFooterText(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={handleSaveSettings}>
          Save Settings
        </Button>
      </div>
    </div>
  );
}
