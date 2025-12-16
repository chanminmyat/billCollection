'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [visibility, setVisibility] = useState({
    newPassword: false,
    confirmPassword: false,
  });

  useEffect(() => {
    if (!token) {
      setStatusMessage({ type: 'error', message: 'Reset token missing. Please restart the recovery flow.' });
    }
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatusMessage(null);

    if (!token) {
      setStatusMessage({ type: 'error', message: 'Invalid reset token.' });
      return;
    }

    if (!formData.newPassword || !formData.confirmPassword) {
      setStatusMessage({ type: 'error', message: 'Please fill in both password fields.' });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setStatusMessage({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'}/auth/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            newPassword: formData.newPassword,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.message ?? 'Unable to reset password.';
        throw new Error(message);
      }

      setStatusMessage({ type: 'success', message: 'Password updated. Redirecting to sign in...' });
      setTimeout(() => router.push('/'), 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reset password.';
      setStatusMessage({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-800">Reset Password</CardTitle>
          <p className="text-gray-600">Enter your new password below.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={visibility.newPassword ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(event) => setFormData({ ...formData, newPassword: event.target.value })}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setVisibility((prev) => ({ ...prev, newPassword: !prev.newPassword }))
                  }
                  className="absolute inset-y-0 right-2 text-gray-500 hover:text-gray-800"
                  aria-label={visibility.newPassword ? 'Hide password' : 'Show password'}
                >
                  {visibility.newPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={visibility.confirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setVisibility((prev) => ({ ...prev, confirmPassword: !prev.confirmPassword }))
                  }
                  className="absolute inset-y-0 right-2 text-gray-500 hover:text-gray-800"
                  aria-label={visibility.confirmPassword ? 'Hide password' : 'Show password'}
                >
                  {visibility.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {statusMessage && (
              <div
                className={`text-sm rounded px-3 py-2 ${
                  statusMessage.type === 'error'
                    ? 'text-red-600 bg-red-50 border border-red-100'
                    : 'text-green-600 bg-green-50 border border-green-100'
                }`}
              >
                {statusMessage.message}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
