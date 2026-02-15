'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3, 
  LogOut, 
  Menu, 
  ChevronDown,
  ChevronLeft,
  Building2,
  UserCheck,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.innerWidth >= 1024) return false;
    const saved = window.localStorage.getItem('sidebarOpen');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.innerWidth >= 1024;
  });
  const [customersMenuOpen, setCustomersMenuOpen] = useState(false);
  const [collectorsMenuOpen, setCollectorsMenuOpen] = useState(false);
  const [hoveredMenu, setHoveredMenu] = useState<'customers' | 'collectors' | null>(null);
  const pathname = usePathname();

  if (!user) return null;

  const getNavItems = () => {
    switch (user.role) {
      case 'admin':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
          {
            icon: Users,
            label: 'Customers',
            children: [
              { label: 'New Customer', href: '/admin/customers/new-customer' },
              { label: 'Customer List', href: '/admin/customers/customer-list' },
            ],
          },
          {
            icon: UserCheck,
            label: 'Collectors',
            children: [
              { label: 'New Collector', href: '/admin/collectors/new-collector' },
              { label: 'Collector List', href: '/admin/collectors/collector-list' },
            ],
          },
          { icon: FileText, label: 'Billing', href: '/admin/billing' },
          { icon: BarChart3, label: 'Reports', href: '/admin/reports' },
        ];
      case 'collector':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', href: '/collector' },
          { icon: UserCheck, label: 'Collections', href: '/collector/collections' },
          { icon: BarChart3, label: 'Performance', href: '/collector/performance' },
        ];
      case 'customer':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', href: '/customer' },
          { icon: FileText, label: 'Bills', href: '/customer/bills' },
          { icon: DollarSign, label: 'Payments', href: '/customer/payments' },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const isCustomersRoute = pathname.startsWith('/admin/customers');
  const isCollectorsRoute = pathname.startsWith('/admin/collectors');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateSidebar = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };
    updateSidebar();
    window.addEventListener('resize', updateSidebar);
    return () => {
      window.removeEventListener('resize', updateSidebar);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sidebarOpen', String(sidebarOpen));
  }, [sidebarOpen]);

  const closeSidebarOnMobile = () => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleSidebarMouseEnter = () => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  };

  const handleSidebarMouseLeave = () => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:w-16 lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            {sidebarOpen && <h1 className="text-xl font-bold text-gray-800">Bill Pro</h1>}
          </div>
          {sidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Link
          href="/profile"
          className={`block p-4 hover:bg-gray-50 ${
            pathname === '/profile' ? 'bg-blue-50 border-r-2 border-blue-700' : ''
          }`}
        >
          <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'}`}>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">
                {user.name.charAt(0)}
              </span>
            </div>
            {sidebarOpen && (
              <div>
                <p className="font-medium text-gray-800">{user.name}</p>
                <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                <span className="mt-1 inline-flex items-center text-xs font-medium text-blue-600">
                  Edit profile
                </span>
              </div>
            )}
          </div>
        </Link>

        <nav className="mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.children) {
              const isCollectorsMenu = item.label === 'Collectors';
              const menuKey = isCollectorsMenu ? 'collectors' : 'customers';
              const isMenuOpen =
                (isCollectorsMenu ? collectorsMenuOpen : customersMenuOpen) || hoveredMenu === menuKey;
              const isMenuRoute = isCollectorsMenu ? isCollectorsRoute : isCustomersRoute;
              const toggleMenu = () => {
                if (isCollectorsMenu) {
                  setCollectorsMenuOpen((prev) => !prev);
                } else {
                  setCustomersMenuOpen((prev) => !prev);
                }
              };
              return (
                <div
                  key={item.label}
                  className="relative px-2"
                  onMouseEnter={() => {
                    setHoveredMenu(menuKey);
                    if (isCollectorsMenu) {
                      setCollectorsMenuOpen(true);
                    } else {
                      setCustomersMenuOpen(true);
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredMenu(null);
                    if (isCollectorsMenu) {
                      setCollectorsMenuOpen(false);
                    } else {
                      setCustomersMenuOpen(false);
                    }
                  }}
                >
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-md px-2 py-3 text-sm font-medium transition-colors ${
                      isMenuRoute
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={toggleMenu}
                  >
                    <span className="flex items-center space-x-3">
                      <Icon className="h-5 w-5" />
                      {sidebarOpen && <span>{item.label}</span>}
                    </span>
                    {sidebarOpen && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>
                  {isMenuOpen && (
                    <div
                      className={
                        sidebarOpen
                          ? 'ml-9 mt-1 space-y-1'
                          : 'absolute left-full top-0 z-50 ml-2 w-52 rounded-md border border-slate-200 bg-white py-2 shadow-lg'
                      }
                    >
                      {item.children.map((child) => {
                        const isChildActive = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`block rounded-md px-3 py-2 ${sidebarOpen ? 'text-xs' : 'text-sm'} font-medium transition-colors ${
                              isChildActive
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                            onClick={closeSidebarOnMobile}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center ${sidebarOpen ? 'space-x-3 px-4' : 'justify-center px-0'} py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                onClick={closeSidebarOnMobile}
              >
                <Icon className="h-5 w-5" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <Button
            variant="ghost"
            onClick={logout}
            className={`w-full text-gray-600 hover:text-gray-900 ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            }`}
          >
            <LogOut className="h-5 w-5 mr-3" />
            {sidebarOpen && 'Logout'}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className={sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}>
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
