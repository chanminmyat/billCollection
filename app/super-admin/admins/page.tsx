'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, EyeOff, Search, ShieldCheck, UserPlus } from 'lucide-react';

type AdminStatus = 'active' | 'inactive';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  role: string;
  status: AdminStatus;
  createdAt?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export default function SuperAdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<AdminStatus>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredAdmins = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return admins;

    return admins.filter((admin) => {
      const values = [admin.id, admin.name, admin.email, admin.username ?? '', admin.status];
      return values.some((value) => value.toLowerCase().includes(query));
    });
  }, [admins, search]);

  const fetchAdmins = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admins`);

      const data = await response.json().catch(() => []);
      if (!response.ok) {
        const message = data?.message ?? 'Failed to load admins';
        throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
      }

      setAdmins(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load admins');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        admin: {
          name,
          email,
          username: username.trim() || undefined,
          phone: phone.trim() || undefined,
          password,
          status,
        },
      };

      const response = await fetch(`${API_BASE_URL}/auth/admins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.message ?? 'Failed to create admin account';
        throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
      }

      setSuccess(`Admin account created for ${data?.email ?? email}.`);
      setName('');
      setEmail('');
      setUsername('');
      setPhone('');
      setPassword('');
      setStatus('active');
      await fetchAdmins();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create admin account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Manage Admins</h2>
          <p className="text-sm text-slate-500">Create and control administrative access.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateAdmin}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required />
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
            <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username (optional)" />
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone (optional)" />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                minLength={6}
                required
                className="pr-10"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as AdminStatus)}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
            <div className="md:col-span-2 flex items-center gap-3">
              <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800" disabled={isSubmitting || isLoading}>
                <UserPlus className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Creating...' : 'Add Admin'}
              </Button>
              {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search admins..."
              className="pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Security</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>Loading admins...</TableCell>
                </TableRow>
              ) : filteredAdmins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>No admin users found.</TableCell>
                </TableRow>
              ) : (
                filteredAdmins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.id}</TableCell>
                    <TableCell>{admin.name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>{admin.username || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={admin.status === 'active' ? 'default' : 'secondary'}>{admin.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <ShieldCheck className="h-4 w-4 text-slate-500" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
