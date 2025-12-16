'use client';

import { FormEvent, useEffect, useState } from 'react';
import Layout from '../components/layout';
import { useAuth } from '../contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff } from 'lucide-react';

type CollectorProfileFormState = {
  collectorCode: string;
  address: string;
  township: string;
  region: string;
  route: string;
  notes: string;
};

type CustomerProfileFormState = {
  accountNumber: string;
  address: string;
};

type ProfileFormState = {
  name: string;
  email: string;
  phone: string;
  username: string;
  collectorProfile: CollectorProfileFormState;
  customerProfile: CustomerProfileFormState;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyCollectorProfile: CollectorProfileFormState = {
  collectorCode: '',
  address: '',
  township: '',
  region: '',
  route: '',
  notes: '',
};

const emptyCustomerProfile: CustomerProfileFormState = {
  accountNumber: '',
  address: '',
};

export default function ProfilePage() {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const [formData, setFormData] = useState<ProfileFormState>({
    name: '',
    email: '',
    phone: '',
    username: '',
    collectorProfile: emptyCollectorProfile,
    customerProfile: emptyCustomerProfile,
  });
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        username: user.username ?? '',
        collectorProfile: {
          ...emptyCollectorProfile,
          ...(user.collectorProfile ?? {}),
        },
        customerProfile: {
          ...emptyCustomerProfile,
          ...(user.customerProfile ?? {}),
        },
      });
    }
  }, [user]);

  const handleInputChange = (field: keyof ProfileFormState, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCollectorChange = (field: keyof CollectorProfileFormState, value: string) => {
    setFormData((prev) => ({
      ...prev,
      collectorProfile: {
        ...prev.collectorProfile,
        [field]: value,
      },
    }));
  };

  const handleCustomerChange = (field: keyof CustomerProfileFormState, value: string) => {
    setFormData((prev) => ({
      ...prev,
      customerProfile: {
        ...prev.customerProfile,
        [field]: value,
      },
    }));
  };

  const handlePasswordFieldChange = (field: keyof PasswordFormState, value: string) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const togglePasswordVisibility = (field: keyof typeof passwordVisibility) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    setStatusMessage(null);
    setIsSaving(true);

    try {
      const payload: Parameters<typeof updateProfile>[0] = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        username: formData.username,
      };

      if (user.role === 'collector') {
        payload.collectorProfile = formData.collectorProfile;
      } else if (user.role === 'customer') {
        payload.customerProfile = formData.customerProfile;
      }

      const updatedUser = await updateProfile(payload);

      setFormData({
        name: updatedUser.name ?? '',
        email: updatedUser.email ?? '',
        phone: updatedUser.phone ?? '',
        username: updatedUser.username ?? '',
        collectorProfile: {
          ...emptyCollectorProfile,
          ...(updatedUser.collectorProfile ?? {}),
        },
        customerProfile: {
          ...emptyCustomerProfile,
          ...(updatedUser.customerProfile ?? {}),
        },
      });

      setStatusMessage({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update your profile. Please try again.';
      setStatusMessage({ type: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Please fill in all password fields.' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    if (!user?.email) {
      setPasswordStatus({ type: 'error', message: 'Your profile does not include an email address.' });
      return;
    }

    setIsPasswordSaving(true);

    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordStatus({ type: 'success', message: 'Password updated successfully. Logging you out...' });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => logout(), 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change your password. Please try again.';
      setPasswordStatus({ type: 'error', message });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
            <p className="text-gray-600">Update your personal information and contact details.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(event) => handleInputChange('name', event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(event) => handleInputChange('username', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => handleInputChange('email', event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(event) => handleInputChange('phone', event.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {user.role === 'collector' && (
            <Card>
              <CardHeader>
                <CardTitle>Collector Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collectorCode">Collector Code</Label>
                    <Input
                      id="collectorCode"
                      value={formData.collectorProfile.collectorCode}
                      onChange={(event) => handleCollectorChange('collectorCode', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      value={formData.collectorProfile.region}
                      onChange={(event) => handleCollectorChange('region', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="township">Township</Label>
                    <Input
                      id="township"
                      value={formData.collectorProfile.township}
                      onChange={(event) => handleCollectorChange('township', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="route">Route</Label>
                    <Input
                      id="route"
                      value={formData.collectorProfile.route}
                      onChange={(event) => handleCollectorChange('route', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.collectorProfile.address}
                      onChange={(event) => handleCollectorChange('address', event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.collectorProfile.notes}
                    onChange={(event) => handleCollectorChange('notes', event.target.value)}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {user.role === 'customer' && (
            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={formData.customerProfile.accountNumber}
                      onChange={(event) => handleCustomerChange('accountNumber', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="customerAddress">Address</Label>
                    <Textarea
                      id="customerAddress"
                      value={formData.customerProfile.address}
                      onChange={(event) => handleCustomerChange('address', event.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {statusMessage && (
              <Alert variant={statusMessage.type === 'error' ? 'destructive' : 'default'}>
                <AlertDescription>{statusMessage.message}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>

        <form className="space-y-4" onSubmit={handlePasswordSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Update Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={passwordVisibility.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(event) => handlePasswordFieldChange('currentPassword', event.target.value)}
                      className="pr-10"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="absolute inset-y-0 right-2 text-gray-500 hover:text-gray-900"
                      aria-label={passwordVisibility.current ? 'Hide current password' : 'Show current password'}
                    >
                      {passwordVisibility.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={passwordVisibility.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(event) => handlePasswordFieldChange('newPassword', event.target.value)}
                      className="pr-10"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('new')}
                      className="absolute inset-y-0 right-2 text-gray-500 hover:text-gray-900"
                      aria-label={passwordVisibility.new ? 'Hide new password' : 'Show new password'}
                    >
                      {passwordVisibility.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={passwordVisibility.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(event) => handlePasswordFieldChange('confirmPassword', event.target.value)}
                      className="pr-10"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirm')}
                      className="absolute inset-y-0 right-2 text-gray-500 hover:text-gray-900"
                      aria-label={passwordVisibility.confirm ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {passwordVisibility.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {passwordStatus && (
            <Alert variant={passwordStatus.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{passwordStatus.message}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isPasswordSaving}>
            {isPasswordSaving ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </div>
    </Layout>
  );
}
