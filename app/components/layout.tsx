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
  DollarSign,
  Activity,
  Globe
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { formatDisplayDate } from '@/lib/date-format';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { readUiLanguage, UI_LANGUAGE_STORAGE_KEY, UI_LANGUAGE_UPDATED_EVENT, UiLanguage, writeUiLanguage } from '@/lib/ui-language';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.innerWidth < 1024) return false;
    const saved = window.localStorage.getItem('sidebarOpen');
    if (saved !== null) {
      return saved === 'true';
    }
    return false;
  });
  const [isDesktop, setIsDesktop] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('en');
  const [customersMenuOpen, setCustomersMenuOpen] = useState(false);
  const [collectorsMenuOpen, setCollectorsMenuOpen] = useState(false);
  const [billingMenuOpen, setBillingMenuOpen] = useState(false);
  const [paymentConfigMenuOpen, setPaymentConfigMenuOpen] = useState(false);
  const [hoveredMenu, setHoveredMenu] = useState<
    'customers' | 'collectors' | 'billing' | 'paymentConfig' | null
  >(null);
  const [collectorViewHash, setCollectorViewHash] = useState<string>('dashboard');
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const role = user?.role;
  const isCollectorBurmese = role === 'collector' && uiLanguage === 'mm';

  const collectorLabel = (english: string, burmese: string) => (isCollectorBurmese ? burmese : english);

  const getNavItems = () => {
    switch (role) {
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
          {
            icon: FileText,
            label: 'Billing',
            children: [
              { label: 'Invoice List', href: '/admin/billing' },
              { label: 'Create Invoice', href: '/admin/billing/create-invoice' },
              { label: 'Rule Config', href: '/admin/billing?tab=rule-config' },
              { label: 'Create Receipt', href: '/admin/billing/receipt/create' },
              { label: 'Receipt List', href: '/admin/billing/receipt/list' },
            ],
          },
          {
            icon: DollarSign,
            label: 'Payment Config',
            children: [
              { label: 'Create Payment Account', href: '/admin/billing/payment-config/create' },
              { label: 'Payment Account List', href: '/admin/billing/payment-config/list' },
            ],
          },
          { icon: Activity, label: 'Activity Log', href: '/admin/activity-log' },
          { icon: BarChart3, label: 'Reports', href: '/admin/reports' },
        ];
      case 'collector':
        return [
          { icon: LayoutDashboard, label: collectorLabel('Dashboard', 'ဒက်ရှ်ဘုတ်'), href: '/collector#dashboard' },
          { icon: Users, label: collectorLabel('Assigned Customers', 'တာဝန်ပေးထားသော ဖောက်သည်များ'), href: '/collector#assigned_customers' },
          { icon: FileText, label: collectorLabel('Assigned Bills', 'တာဝန်ပေးထားသော ဘီလ်များ'), href: '/collector#assigned_bills' },
          { icon: UserCheck, label: collectorLabel('Collected Bills', 'ကောက်ခံပြီး ဘီလ်များ'), href: '/collector#collected_bills' },
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
  const isPaymentConfigRoute = pathname.startsWith('/admin/billing/payment-config');
  const isBillingRoute = pathname.startsWith('/admin/billing') && !isPaymentConfigRoute;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateSidebar = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (!desktop) {
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
    if (role !== 'collector') {
      setUiLanguage('en');
      return;
    }
    setUiLanguage(readUiLanguage(user?.collectorProfile?.language));
  }, [role, user?.collectorProfile?.language]);

  useEffect(() => {
    if (typeof window === 'undefined' || role !== 'collector') return;
    const syncCollectorHash = () => {
      const hashValue = window.location.hash.replace('#', '').trim();
      setCollectorViewHash(hashValue || 'dashboard');
    };
    syncCollectorHash();
    window.addEventListener('hashchange', syncCollectorHash);
    return () => {
      window.removeEventListener('hashchange', syncCollectorHash);
    };
  }, [role, pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || role !== 'collector') return;

    const syncLanguage = () => {
      setUiLanguage(readUiLanguage(user?.collectorProfile?.language));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === UI_LANGUAGE_STORAGE_KEY) {
        syncLanguage();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(UI_LANGUAGE_UPDATED_EVENT, syncLanguage as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(UI_LANGUAGE_UPDATED_EVENT, syncLanguage as EventListener);
    };
  }, [role, user?.collectorProfile?.language]);

  const handleChangeLanguage = (language: UiLanguage) => {
    setUiLanguage(language);
    writeUiLanguage(language);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 1024) {
      window.localStorage.setItem('sidebarOpen', String(sidebarOpen));
    }
  }, [sidebarOpen]);

  const closeSidebarOnMobile = () => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleSidebarMouseEnter = () => {
    if (typeof window === 'undefined') return;
    if (isDesktop) {
      setSidebarOpen(true);
    }
  };

  const handleSidebarMouseLeave = () => {
    if (typeof window === 'undefined') return;
    if (isDesktop) {
      setSidebarOpen(false);
    }
  };

  if (isLoading || !user) {
    return <div className="min-h-screen bg-gray-50" />;
  }

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
                <p className="text-sm text-gray-500 capitalize">
                  {isCollectorBurmese ? 'ကောက်ခံသူ' : user.role}
                </p>
                <span className="mt-1 inline-flex items-center text-xs font-medium text-blue-600">
                  {collectorLabel('Edit profile', 'ပရိုဖိုင် ပြင်ရန်')}
                </span>
              </div>
            )}
          </div>
        </Link>

        <nav className="mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.children) {
              const menuKey =
                item.label === 'Collectors'
                  ? 'collectors'
                  : item.label === 'Billing'
                    ? 'billing'
                    : item.label === 'Payment Config'
                      ? 'paymentConfig'
                    : 'customers';
              const isMenuOpen =
                (menuKey === 'collectors'
                  ? collectorsMenuOpen
                  : menuKey === 'billing'
                    ? billingMenuOpen
                    : menuKey === 'paymentConfig'
                      ? paymentConfigMenuOpen
                    : customersMenuOpen) || hoveredMenu === menuKey;
              const isMenuRoute =
                menuKey === 'collectors'
                  ? isCollectorsRoute
                  : menuKey === 'billing'
                    ? isBillingRoute
                    : menuKey === 'paymentConfig'
                      ? isPaymentConfigRoute
                    : isCustomersRoute;
              const toggleMenu = () => {
                if (menuKey === 'collectors') {
                  setCollectorsMenuOpen((prev) => !prev);
                } else if (menuKey === 'billing') {
                  setBillingMenuOpen((prev) => !prev);
                } else if (menuKey === 'paymentConfig') {
                  setPaymentConfigMenuOpen((prev) => !prev);
                } else {
                  setCustomersMenuOpen((prev) => !prev);
                }
              };
              return (
                <div
                  key={item.label}
                  className="relative px-2"
                  onMouseEnter={() => {
                    if (!isDesktop) return;
                    setHoveredMenu(menuKey);
                    if (menuKey === 'collectors') {
                      setCollectorsMenuOpen(true);
                    } else if (menuKey === 'billing') {
                      setBillingMenuOpen(true);
                    } else if (menuKey === 'paymentConfig') {
                      setPaymentConfigMenuOpen(true);
                    } else {
                      setCustomersMenuOpen(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isDesktop) return;
                    setHoveredMenu(null);
                    if (menuKey === 'collectors') {
                      setCollectorsMenuOpen(false);
                    } else if (menuKey === 'billing') {
                      setBillingMenuOpen(false);
                    } else if (menuKey === 'paymentConfig') {
                      setPaymentConfigMenuOpen(false);
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
                        const [childPath, childQuery] = child.href.split('?');
                        const tabQuery = childQuery?.startsWith('tab=') ? childQuery.slice(4) : null;
                        const isChildActive =
                          pathname === childPath &&
                          (tabQuery ? searchParams.get('tab') === tabQuery : true);
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

            let isActive = pathname === item.href;
            const isCollectorViewLink = role === 'collector' && item.href.startsWith('/collector#');
            const collectorTargetView = isCollectorViewLink ? item.href.split('#')[1] || 'dashboard' : null;
            if (role === 'collector' && item.href.startsWith('/collector')) {
              const hrefView = item.href.split('#')[1] || 'dashboard';
              const currentView = collectorViewHash || searchParams.get('view') || 'dashboard';
              isActive = pathname === '/collector' && currentView === hrefView;
            }
            if (isCollectorViewLink && collectorTargetView) {
              return (
                <button
                  key={item.href}
                  type="button"
                  className={`flex w-full items-center ${sidebarOpen ? 'space-x-3 px-4' : 'justify-center px-0'} py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => {
                    setCollectorViewHash(collectorTargetView);
                    if (typeof window !== 'undefined') {
                      const { pathname: currentPath, search } = window.location;
                      const nextUrl = `${currentPath}${search}#${collectorTargetView}`;
                      window.history.pushState(null, '', nextUrl);
                      window.dispatchEvent(new HashChangeEvent('hashchange'));
                    }
                    closeSidebarOnMobile();
                  }}
                >
                  <Icon className="h-5 w-5" />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            }
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
            {sidebarOpen && collectorLabel('Logout', 'ထွက်မည်')}
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
                {formatDisplayDate(new Date())}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {user.role === 'collector' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                      <Globe className="h-4 w-4 mr-2" />
                      {isCollectorBurmese ? 'မြန်မာ' : 'English'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleChangeLanguage('en')}>
                      English
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleChangeLanguage('mm')}>
                      မြန်မာ
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {collectorLabel('Logout', 'ထွက်မည်')}
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
