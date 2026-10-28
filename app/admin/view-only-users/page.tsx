'use client';

import { FormEvent, useEffect, useState } from 'react';
import Layout from '@/app/components/layout';
import { useAuth } from '@/app/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VIEW_ONLY_MODULES, ViewOnlyModule } from '@/lib/view-only-access';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
type Status = 'active' | 'inactive';
type ViewerAccount = { id: string; name: string; email: string; username?: string | null; phone?: string | null; status: Status; role: string; permissions: ViewOnlyModule[] };

export default function ViewOnlyUsersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<ViewerAccount[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>('active');
  const [permissions, setPermissions] = useState<ViewOnlyModule[]>([]);
  const [editing, setEditing] = useState<ViewerAccount | null>(null);
  const [editPermissions, setEditPermissions] = useState<ViewOnlyModule[]>([]);
  const [editStatus, setEditStatus] = useState<Status>('active');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/view-only-users`, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'Failed to load view-only users.');
      setAccounts(Array.isArray(payload) ? payload : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load view-only users.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.role === 'admin') void fetchAccounts(); }, [user?.role]);

  const toggle = (list: ViewOnlyModule[], setList: (value: ViewOnlyModule[]) => void, module: ViewOnlyModule) => {
    setList(list.includes(module) ? list.filter((item) => item !== module) : [...list, module]);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/view-only-users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ viewer: { name, email, username: username.trim() || undefined, phone: phone.trim() || undefined, password, status, permissions } }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message || 'Failed to create view-only user.');
      setSuccess(`View-only account created for ${payload?.email ?? email}.`);
      setName(''); setEmail(''); setUsername(''); setPhone(''); setPassword(''); setPermissions([]); setStatus('active');
      await fetchAccounts();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed to create view-only user.'); }
    finally { setSaving(false); }
  };

  const openEdit = (account: ViewerAccount) => {
    setEditing(account); setEditPermissions(account.permissions ?? []); setEditStatus(account.status); setError(''); setSuccess('');
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/view-only-users/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ permissions: editPermissions, status: editStatus }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message || 'Failed to update view-only access.');
      setSuccess(`Access updated for ${editing.name}.`); setEditing(null); await fetchAccounts();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed to update view-only access.'); }
    finally { setSaving(false); }
  };

  if (authLoading) return <div className="min-h-screen bg-slate-50" />;
  if (!user || user.role !== 'admin') return <div>Access denied</div>;

  const accessOptions = (selected: ViewOnlyModule[], setSelected: (value: ViewOnlyModule[]) => void) => (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {VIEW_ONLY_MODULES.map((module) => <label key={module.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 p-3 text-sm">
        <input type="checkbox" checked={selected.includes(module.id)} onChange={() => toggle(selected, setSelected, module.id)} />
        {module.label}
      </label>)}
    </div>
  );

  return <Layout>
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">View-only Users</h1><p className="mt-1 text-sm text-slate-500">Create accounts that can only read the modules you assign. API access is read-only and restricted to the selected modules.</p></div>
      <Card><CardHeader><CardTitle>Create View-only Account</CardTitle></CardHeader><CardContent>
        <form className="space-y-4" onSubmit={submitCreate}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required />
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
            <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username (optional)" />
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone (optional)" />
            <div className="relative"><Input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password (min 6 characters)" minLength={6} required className="pr-10" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-2.5 text-slate-500" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
            <select value={status} onChange={(event) => setStatus(event.target.value as Status)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </div>
          <div className="space-y-2"><p className="text-sm font-semibold text-slate-700">Read access</p>{accessOptions(permissions, setPermissions)}<p className="text-xs text-slate-500">Create, edit, status changes, payment and cancellation actions are unavailable to this account.</p></div>
          <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={saving || loading || permissions.length === 0}><UserPlus className="mr-2 h-4 w-4" />{saving ? 'Creating…' : 'Create View-only User'}</Button>{success && <span className="text-sm text-emerald-700">{success}</span>}{error && <span role="alert" className="text-sm text-rose-700">{error}</span>}</div>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Managed Accounts</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Username</TableHead><TableHead>Access</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow> : accounts.length === 0 ? <TableRow><TableCell colSpan={6}>No view-only accounts.</TableCell></TableRow> : accounts.map((account) => <TableRow key={account.id}><TableCell className="font-medium">{account.name}</TableCell><TableCell>{account.email}</TableCell><TableCell>{account.username || '—'}</TableCell><TableCell className="max-w-80 whitespace-normal">{(account.permissions ?? []).map((id) => VIEW_ONLY_MODULES.find((module) => module.id === id)?.label ?? id).join(', ') || 'No modules'}</TableCell><TableCell><Badge variant={account.status === 'active' ? 'default' : 'secondary'}>{account.status}</Badge></TableCell><TableCell><Button variant="outline" size="sm" onClick={() => openEdit(account)}>Edit access</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Edit view-only access</DialogTitle></DialogHeader><form className="space-y-5" onSubmit={submitEdit}><div className="space-y-2"><p className="text-sm font-semibold">Allowed modules for {editing?.name}</p>{accessOptions(editPermissions, setEditPermissions)}</div><select value={editStatus} onChange={(event) => setEditStatus(event.target.value as Status)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<DialogFooter><Button type="submit" disabled={saving || editPermissions.length === 0}>{saving ? 'Saving…' : 'Save Access'}</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  </Layout>;
}
