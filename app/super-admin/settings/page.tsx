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
import {
  DEFAULT_SYSTEM_BRANDING,
  fetchSystemBranding,
  readSystemBranding,
  resetSystemBrandingRemote,
  resetSystemBranding,
  saveSystemBranding,
  writeSystemBranding,
} from '@/lib/system-branding';

export default function SuperAdminSettingsPage() {
  const { toast } = useToast();
  const [systemName, setSystemName] = useState('');
  const [systemTagline, setSystemTagline] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [receiptCompanyName, setReceiptCompanyName] = useState('');
  const [receiptAddress, setReceiptAddress] = useState('');
  const [receiptPhone, setReceiptPhone] = useState('');
  const [receiptEmail, setReceiptEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
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
    const branding = readSystemBranding();
    setSystemName(branding.systemName);
    setSystemTagline(branding.systemTagline);
    setLogoDataUrl(branding.logoDataUrl);
    setPrimaryColor(branding.primaryColor);
    setSecondaryColor(branding.secondaryColor);
    setReceiptCompanyName(branding.receiptCompanyName);
    setReceiptAddress(branding.receiptAddress);
    setReceiptPhone(branding.receiptPhone);
    setReceiptEmail(branding.receiptEmail);
    setFooterText(branding.footerText);
    setFixedStartDay(String(windowConfig.startDay));
    setFixedDueDay(String(windowConfig.dueDay));

    fetchSystemBranding()
      .then((remoteBranding) => {
        setSystemName(remoteBranding.systemName);
        setSystemTagline(remoteBranding.systemTagline);
        setLogoDataUrl(remoteBranding.logoDataUrl);
        setPrimaryColor(remoteBranding.primaryColor);
        setSecondaryColor(remoteBranding.secondaryColor);
        setReceiptCompanyName(remoteBranding.receiptCompanyName);
        setReceiptAddress(remoteBranding.receiptAddress);
        setReceiptPhone(remoteBranding.receiptPhone);
        setReceiptEmail(remoteBranding.receiptEmail);
        setFooterText(remoteBranding.footerText);
      })
      .catch(() => {
        // Keep cached/local defaults when the backend is unavailable.
      });
  }, []);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid logo file',
        description: 'Please upload an image file.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    if (file.size > 1024 * 1024) {
      toast({
        title: 'Logo is too large',
        description: 'Please upload an image under 1 MB.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const applyBrandingToForm = (branding: typeof DEFAULT_SYSTEM_BRANDING) => {
    setSystemName(branding.systemName);
    setSystemTagline(branding.systemTagline);
    setLogoDataUrl(branding.logoDataUrl);
    setPrimaryColor(branding.primaryColor);
    setSecondaryColor(branding.secondaryColor);
    setReceiptCompanyName(branding.receiptCompanyName);
    setReceiptAddress(branding.receiptAddress);
    setReceiptPhone(branding.receiptPhone);
    setReceiptEmail(branding.receiptEmail);
    setFooterText(branding.footerText);
  };

  const handleSaveSettings = async () => {
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

    setIsSaving(true);
    try {
      const saved = saveFixedBillingWindow({
        startDay: nextStartDay,
        dueDay: nextDueDay
      });
      const savedBranding = await saveSystemBranding({
        systemName,
        systemTagline,
        logoDataUrl,
        primaryColor,
        secondaryColor,
        receiptCompanyName,
        receiptAddress,
        receiptPhone,
        receiptEmail,
        footerText,
      });

      applyBrandingToForm(savedBranding);
      setFixedStartDay(String(saved.startDay));
      setFixedDueDay(String(saved.dueDay));

      toast({
        title: 'Settings saved',
        description: 'Branding and billing defaults updated.'
      });
    } catch (error) {
      const cachedBranding = writeSystemBranding({
        systemName,
        systemTagline,
        logoDataUrl,
        primaryColor,
        secondaryColor,
        receiptCompanyName,
        receiptAddress,
        receiptPhone,
        receiptEmail,
        footerText,
      });
      applyBrandingToForm(cachedBranding);
      toast({
        title: 'Backend settings not saved',
        description: error instanceof Error ? error.message : 'Saved only in this browser.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetBranding = async () => {
    setIsSaving(true);
    try {
      const defaults = await resetSystemBrandingRemote();
      applyBrandingToForm(defaults);
      toast({
        title: 'Branding reset',
        description: 'System branding restored to default values.',
      });
    } catch {
      const defaults = resetSystemBranding();
      applyBrandingToForm(defaults);
      toast({
        title: 'Branding reset locally',
        description: 'Backend was unavailable, so only this browser was reset.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
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
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="System logo preview" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs font-semibold text-slate-400">
                    {systemName.trim().charAt(0) || DEFAULT_SYSTEM_BRANDING.systemName.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input id="logoUpload" type="file" accept="image/*" onChange={handleLogoChange} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setLogoDataUrl(null)}>
                    Remove Logo
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleResetBranding} disabled={isSaving}>
                    Reset Branding
                  </Button>
                </div>
              </div>
            </div>
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
          <CardTitle>Receipt Company Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="receiptCompanyName">Company Name</Label>
            <Input
              id="receiptCompanyName"
              placeholder="Company name shown on receipt"
              value={receiptCompanyName}
              onChange={(event) => setReceiptCompanyName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receiptPhone">Phone</Label>
            <Input
              id="receiptPhone"
              placeholder="09..."
              value={receiptPhone}
              onChange={(event) => setReceiptPhone(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="receiptAddress">Address</Label>
            <Input
              id="receiptAddress"
              placeholder="Company address"
              value={receiptAddress}
              onChange={(event) => setReceiptAddress(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receiptEmail">Email</Label>
            <Input
              id="receiptEmail"
              placeholder="billing@example.com"
              value={receiptEmail}
              onChange={(event) => setReceiptEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerTextReceipt">Footer Text</Label>
            <Input
              id="footerTextReceipt"
              placeholder="Thank you for your payment"
              value={footerText}
              onChange={(event) => setFooterText(event.target.value)}
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
