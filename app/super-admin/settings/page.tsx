import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SuperAdminSettingsPage() {
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
            <Input id="systemName" placeholder="Bill Pro" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemTagline">Tagline</Label>
            <Input id="systemTagline" placeholder="Billing Management Platform" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="logoUpload">System Logo</Label>
            <Input id="logoUpload" type="file" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Color</Label>
            <Input id="primaryColor" placeholder="#1D4ED8" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryColor">Secondary Color</Label>
            <Input id="secondaryColor" placeholder="#0F172A" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="adminWelcome">Admin Welcome Copy</Label>
            <Input id="adminWelcome" placeholder="Welcome to the admin dashboard..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collectorNote">Collector Notice</Label>
            <Input id="collectorNote" placeholder="Reminder message for collectors" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerBanner">Customer Banner</Label>
            <Input id="customerBanner" placeholder="Announcement for customers" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerText">Footer Text</Label>
            <Input id="footerText" placeholder="© 2025 Bill Pro" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="bg-slate-900 text-white hover:bg-slate-800">Save Settings</Button>
      </div>
    </div>
  );
}
