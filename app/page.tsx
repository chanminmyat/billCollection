"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "./contexts/auth-context";
import { Building2 } from "lucide-react";

export default function LoginPage() {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    role: "",
  });
  const { login } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (credentials.username && credentials.password && credentials.role) {
      login(
        credentials.username,
        credentials.role as "admin" | "collector" | "customer"
      );
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='flex justify-center mb-4'>
            <Building2 className='h-12 w-12 text-blue-600' />
          </div>
          <CardTitle className='text-2xl font-bold text-gray-800'>
            Bill Pro
          </CardTitle>
          <p className='text-gray-600'>Billing Management System</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='username'>Username</Label>
              <Input
                id='username'
                type='text'
                placeholder='Enter username'
                value={credentials.username}
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                type='password'
                placeholder='Enter password'
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                required
              />
            </div>
            <div className='space-y-2 pb-10'>
              <Label htmlFor='role'>Role</Label>
              <Select
                value={credentials.role}
                onValueChange={(value) =>
                  setCredentials({ ...credentials, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select your role' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='admin'>Admin</SelectItem>
                  <SelectItem value='collector'>Collector</SelectItem>
                  <SelectItem value='customer'>Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type='submit' className='w-full'>
              Sign In
            </Button>
          </form>
          {/* <div className="mt-6 text-sm text-gray-500 text-center">
            <p>Demo credentials:</p>
            <p>Admin: admin/admin123</p>
            <p>Collector: collector1/pass123</p>
            <p>Customer: customer1/pass123</p>
          </div> */}
        </CardContent>
      </Card>
    </div>
  );
}
