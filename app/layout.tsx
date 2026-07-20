import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from './contexts/auth-context';
import { DataProvider } from './contexts/data-context';
import { Toaster } from '@/components/ui/toaster';
import SystemTitle from './components/system-title';

export const metadata: Metadata = {
  title: 'Bill Pro - Billing Management System',
  description: 'Professional billing and collection management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>
          <DataProvider>
            <SystemTitle />
            {children}
            <Toaster />
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
