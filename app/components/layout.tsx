'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Building2,
  UserCheck,
  Banknote,
  Activity,
  Eye,
  Globe,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { formatDisplayDate } from '@/lib/date-format';
import { VIEW_ONLY_MODULES } from '@/lib/view-only-access';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  readUiLanguage,
  UI_LANGUAGE_STORAGE_KEY,
  UI_LANGUAGE_UPDATED_EVENT,
  UiLanguage,
  writeUiLanguage,
} from '@/lib/ui-language';
import {
  COLLECTOR_DASHBOARD_COPY_UPDATED_AT_STORAGE_KEY,
  COLLECTOR_DASHBOARD_COPY_UPDATED_EVENT,
  DEFAULT_COLLECTOR_DASHBOARD_COPY,
  normalizeCollectorDashboardCopy,
} from '@/lib/collector-dashboard-copy';
import {
  fetchSystemBranding,
  readSystemBranding,
  SYSTEM_BRANDING_STORAGE_KEY,
  SYSTEM_BRANDING_UPDATED_EVENT,
} from '@/lib/system-branding';
import type { SystemBranding } from '@/lib/system-branding';

interface LayoutProps {
  children: React.ReactNode;
}

function NavHint({ label, enabled, children }: { label: string; enabled: boolean; children: React.ReactElement }) {
  if (!enabled) return children;
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="right" sideOffset={12}>{label}</TooltipContent></Tooltip>;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpenState] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const desktopPreference = useRef(true);
  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    if (isDesktop) {
      desktopPreference.current = open;
      try { localStorage.setItem('billflow_sidebar_expanded', String(open)); } catch { /* Storage may be unavailable. */ }
    }
  }, [isDesktop]);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('en');
  const [customersMenuOpen, setCustomersMenuOpen] = useState<boolean | null>(
    null,
  );
  const [collectorsMenuOpen, setCollectorsMenuOpen] = useState<boolean | null>(
    null,
  );
  const [billingMenuOpen, setBillingMenuOpen] = useState<boolean | null>(null);
  const [paymentConfigMenuOpen, setPaymentConfigMenuOpen] = useState<
    boolean | null
  >(null);
  const [collectorViewHash, setCollectorViewHash] =
    useState<string>('dashboard');
  const [collectorDashboardCopy, setCollectorDashboardCopy] = useState(() => ({
    en: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.en },
    mm: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.mm },
  }));
  const [branding, setBranding] = useState<SystemBranding>(() =>
    readSystemBranding(),
  );
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const role = user?.role;
  const isCollectorBurmese = role === 'collector' && uiLanguage === 'mm';

  const collectorLabel = (english: string, burmese: string) =>
    isCollectorBurmese ? burmese : english;
  const collectorCopy = isCollectorBurmese
    ? collectorDashboardCopy.mm
    : collectorDashboardCopy.en;

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
              {
                label: 'Customer List',
                href: '/admin/customers/customer-list',
              },
            ],
          },
          {
            icon: UserCheck,
            label: 'Collectors',
            children: [
              {
                label: 'New Collector',
                href: '/admin/collectors/new-collector',
              },
              {
                label: 'Collector List',
                href: '/admin/collectors/collector-list',
              },
            ],
          },
          {
            icon: FileText,
            label: 'Billing',
            children: [
              { label: 'Invoice List', href: '/admin/billing' },
              {
                label: 'Create Invoice',
                href: '/admin/billing/create-invoice',
              },
              { label: 'Rule Config', href: '/admin/billing?tab=rule-config' },
              {
                label: 'Create Receipt',
                href: '/admin/billing/receipt/create',
              },
              { label: 'Receipt List', href: '/admin/billing/receipt/list' },
            ],
          },
          {
            icon: Banknote,
            label: 'Payment Config',
            children: [
              {
                label: 'Create Payment Account',
                href: '/admin/billing/payment-config/create',
              },
              {
                label: 'Payment Account List',
                href: '/admin/billing/payment-config/list',
              },
            ],
          },
          {
            icon: Activity,
            label: 'Activity Log',
            href: '/admin/activity-log',
          },
          { icon: BarChart3, label: 'Reports', href: '/admin/reports' },
          { icon: Eye, label: 'View-only Users', href: '/admin/view-only-users' },
        ];
      case 'collector':
        return [
          {
            icon: LayoutDashboard,
            label:
              collectorCopy.dashboardTitle ||
              collectorLabel('Dashboard', 'ဒက်ရှ်ဘုတ်'),
            href: '/collector#dashboard',
          },
          {
            icon: Users,
            label:
              collectorCopy.assignedCustomers ||
              collectorLabel(
                'Assigned Customers',
                'တာဝန်ပေးထားသော ဖောက်သည်များ',
              ),
            href: '/collector#assigned_customers',
          },
          {
            icon: FileText,
            label:
              collectorCopy.assignedBillsLabel ||
              collectorLabel('Assigned Bills', 'တာဝန်ပေးထားသော ဘီလ်များ'),
            href: '/collector#assigned_bills',
          },
          {
            icon: UserCheck,
            label:
              collectorCopy.collectedBillsLabel ||
              collectorLabel('Collected Bills', 'ကောက်ခံပြီး ဘီလ်များ'),
            href: '/collector#collected_bills',
          },
        ];
      case 'customer':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', href: '/customer' },
          { icon: FileText, label: 'Bills', href: '/customer/bills' },
          { icon: Banknote, label: 'Payments', href: '/customer/payments' },
        ];
      case 'viewer':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
          ...VIEW_ONLY_MODULES.filter((module) => user?.permissions?.includes(module.id)).map((module) => ({
            icon: module.id === 'reports' ? BarChart3 : module.id === 'payment_config' ? Banknote : module.id === 'customers' || module.id === 'collectors' ? Users : FileText,
            label: module.label,
            href: module.href,
          })),
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const isCustomersRoute = pathname.startsWith('/admin/customers');
  const isCollectorsRoute = pathname.startsWith('/admin/collectors');
  const isPaymentConfigRoute = pathname.startsWith(
    '/admin/billing/payment-config',
  );
  const isBillingRoute =
    pathname.startsWith('/admin/billing') && !isPaymentConfigRoute;

  useEffect(() => {
    setCustomersMenuOpen(null);
    setCollectorsMenuOpen(null);
    setBillingMenuOpen(null);
    setPaymentConfigMenuOpen(null);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    try { desktopPreference.current = localStorage.getItem('billflow_sidebar_expanded') !== 'false'; } catch { /* Use expanded navigation by default. */ }
    const updateSidebar = () => {
      setIsDesktop(desktop.matches);
      setSidebarOpenState(desktop.matches && desktopPreference.current);
    };
    updateSidebar();
    desktop.addEventListener('change', updateSidebar);
    return () => desktop.removeEventListener('change', updateSidebar);
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
    window.addEventListener(
      UI_LANGUAGE_UPDATED_EVENT,
      syncLanguage as EventListener,
    );
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(
        UI_LANGUAGE_UPDATED_EVENT,
        syncLanguage as EventListener,
      );
    };
  }, [role, user?.collectorProfile?.language]);

  useEffect(() => {
    if (typeof window === 'undefined' || role !== 'collector') return;

    let active = true;
    const loadCollectorCopy = async () => {
      try {
        const response = await fetch(
          '/api/reference-data/collector-dashboard-copy',
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          },
        );
        const data = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok) return;
        setCollectorDashboardCopy(normalizeCollectorDashboardCopy(data?.copy));
      } catch {
        // keep defaults
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === COLLECTOR_DASHBOARD_COPY_UPDATED_AT_STORAGE_KEY) {
        void loadCollectorCopy();
      }
    };

    const onUpdated = () => {
      void loadCollectorCopy();
    };

    void loadCollectorCopy();
    window.addEventListener('storage', onStorage);
    window.addEventListener(
      COLLECTOR_DASHBOARD_COPY_UPDATED_EVENT,
      onUpdated as EventListener,
    );
    return () => {
      active = false;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(
        COLLECTOR_DASHBOARD_COPY_UPDATED_EVENT,
        onUpdated as EventListener,
      );
    };
  }, [role]);

  const handleChangeLanguage = (language: UiLanguage) => {
    setUiLanguage(language);
    writeUiLanguage(language);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncBranding = () => {
      setBranding(readSystemBranding());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SYSTEM_BRANDING_STORAGE_KEY) {
        syncBranding();
      }
    };
    fetchSystemBranding()
      .then(setBranding)
      .catch(() => {
        syncBranding();
      });
    window.addEventListener('storage', onStorage);
    window.addEventListener(
      SYSTEM_BRANDING_UPDATED_EVENT,
      syncBranding as EventListener,
    );
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(
        SYSTEM_BRANDING_UPDATED_EVENT,
        syncBranding as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (!sidebarOpen || isDesktop) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !sidebarRef.current?.contains(target) &&
        !sidebarToggleRef.current?.contains(target)
      ) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [sidebarOpen, isDesktop, isLoading, setSidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen || isDesktop) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex="0"]';
    sidebar?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSidebarOpen(false);
      }
      if (event.key === 'Tab') {
        const elements =
          sidebar?.querySelectorAll<HTMLElement>(focusableSelector);
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const content = contentRef.current;
    const toggle = sidebarToggleRef.current;
    content?.setAttribute('inert', '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      content?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
      else toggle?.focus();
    };
  }, [sidebarOpen, isDesktop, isLoading, setSidebarOpen]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebarOpen && !isDesktop) sidebar?.setAttribute('inert', '');
    else sidebar?.removeAttribute('inert');
  }, [sidebarOpen, isDesktop, isLoading, setSidebarOpen]);

  const closeSidebarOnMobile = () => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  if (isLoading || !user) {
    return <div className="min-h-screen bg-background" />;
  }

  const activeSection =
    pathname === '/profile'
      ? 'Profile'
      : navItems.find((item) =>
          item.children?.some((child) => pathname === child.href.split('?')[0]),
        )?.label ||
        navItems.find((item) => item.href?.split('#')[0] === pathname)?.label ||
        'Workspace';
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase();

  return (
    <TooltipProvider delayDuration={150}>
    <div className="app-shell">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-lg bg-card px-4 py-3 text-sm text-primary shadow-lg focus:not-sr-only"
      >
        Skip to content
      </a>
      {sidebarOpen && (
        <div
          className="app-mobile-overlay fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        ref={sidebarRef}
        id="workspace-sidebar"
        role={!isDesktop && sidebarOpen ? "dialog" : undefined}
        aria-modal={!isDesktop && sidebarOpen ? true : undefined}
        aria-label="Main navigation"
        aria-hidden={!sidebarOpen && !isDesktop}
        className={`app-sidebar ${sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:w-[76px] lg:translate-x-0'}`}
      >
        <div
          className={`flex h-[76px] shrink-0 items-center border-b border-neutral-200 ${sidebarOpen ? 'justify-between px-5' : 'justify-center px-3'}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {branding.logoDataUrl ? (
              <img
                src={branding.logoDataUrl}
                alt={`${branding.systemName} logo`}
                className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary ring-1 ring-neutral-200">
                <Building2 className="h-5 w-5" />
              </div>
            )}
            {sidebarOpen && (
              <span className="truncate text-lg font-semibold tracking-tight text-neutral-900">
                {branding.systemName}
              </span>
            )}
          </div>
          {sidebarOpen && !isDesktop && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label={isDesktop ? "Collapse sidebar" : "Close navigation"}
              aria-controls="workspace-sidebar"
              aria-expanded={true}
              title={isDesktop ? "Collapse navigation" : "Close navigation"}
              className="ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-primary/10 hover:text-primary"
            >
              {isDesktop ? <PanelLeftClose className="h-5 w-5" /> : <X className="h-5 w-5" />}
            </button>
          )}
        </div>
        <div
          className={`pt-7 pb-3 text-[10px] font-semibold uppercase tracking-[0.17em] text-neutral-500 ${sidebarOpen ? 'px-7' : 'px-2 text-center'}`}
        >
          {sidebarOpen ? 'Workspace' : 'Menu'}
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-5">
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
                menuKey === 'collectors'
                  ? collectorsMenuOpen
                  : menuKey === 'billing'
                    ? billingMenuOpen
                    : menuKey === 'paymentConfig'
                      ? paymentConfigMenuOpen
                      : customersMenuOpen;
              const isMenuRoute =
                menuKey === 'collectors'
                  ? isCollectorsRoute
                  : menuKey === 'billing'
                    ? isBillingRoute
                    : menuKey === 'paymentConfig'
                      ? isPaymentConfigRoute
                      : isCustomersRoute;
              const isMenuExpanded = isMenuOpen ?? isMenuRoute;
              const toggleMenu = () => {
                if (!sidebarOpen) setSidebarOpen(true);
                const next = !sidebarOpen || !isMenuExpanded;
                if (menuKey === 'collectors') setCollectorsMenuOpen(next);
                else if (menuKey === 'billing') setBillingMenuOpen(next);
                else if (menuKey === 'paymentConfig')
                  setPaymentConfigMenuOpen(next);
                else setCustomersMenuOpen(next);
              };
              return (
                <div key={item.label}>
                  <NavHint label={item.label} enabled={!sidebarOpen && isDesktop}>
                  <button
                    type="button"
                    className={`app-nav-item ${!sidebarOpen ? 'justify-center px-0' : ''}`}
                    data-active={isMenuRoute}
                    onClick={toggleMenu}
                    aria-label={item.label}
                    title={!sidebarOpen ? item.label : undefined}
                    aria-expanded={sidebarOpen && isMenuExpanded}
                    aria-controls={`nav-${menuKey}`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${isMenuExpanded ? 'rotate-180' : ''}`}
                        />
                      </>
                    )}
                  </button>
                  </NavHint>
                  {sidebarOpen && isMenuExpanded && (
                    <div
                      id={`nav-${menuKey}`}
                      className="mb-2 ml-[21px] mt-1 space-y-0.5 border-l border-neutral-300 pl-3"
                    >
                      {item.children.map((child) => {
                        const [childPath, childQuery] = child.href.split('?');
                        const tabQuery = childQuery?.startsWith('tab=')
                          ? childQuery.slice(4)
                          : null;
                        const activeTab = searchParams.get('tab');
                        const isChildActive =
                          pathname === childPath &&
                          (tabQuery ? activeTab === tabQuery : !activeTab);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="app-nav-child"
                            aria-current={isChildActive ? 'page' : undefined}
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
            const isCollectorViewLink =
              role === 'collector' && item.href.startsWith('/collector#');
            const collectorTargetView = isCollectorViewLink
              ? item.href.split('#')[1] || 'dashboard'
              : null;
            if (isCollectorViewLink)
              isActive =
                pathname === '/collector' &&
                (collectorViewHash ||
                  searchParams.get('view') ||
                  'dashboard') === collectorTargetView;
            const classes = `app-nav-item ${!sidebarOpen ? 'justify-center px-0' : ''}`;
            if (isCollectorViewLink && collectorTargetView) {
              return (
                <NavHint key={item.href} label={item.label} enabled={!sidebarOpen && isDesktop}>
                <button
                  key={item.href}
                  type="button"
                  className={classes}
                  data-active={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  title={!sidebarOpen ? item.label : undefined}
                  onClick={() => {
                    setCollectorViewHash(collectorTargetView);
                    const { pathname: currentPath, search } = window.location;
                    window.history.pushState(
                      null,
                      '',
                      `${currentPath}${search}#${collectorTargetView}`,
                    );
                    window.dispatchEvent(new HashChangeEvent('hashchange'));
                    closeSidebarOnMobile();
                  }}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
                </NavHint>
              );
            }
            return (
              <NavHint key={item.href} label={item.label} enabled={!sidebarOpen && isDesktop}>
              <Link
                key={item.href}
                href={item.href}
                className={classes}
                data-active={isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                title={!sidebarOpen ? item.label : undefined}
                onClick={closeSidebarOnMobile}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
              </NavHint>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-neutral-200 p-3">
          {isDesktop && <NavHint label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} enabled={!sidebarOpen}>
            <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className={`app-nav-item mb-2 ${!sidebarOpen ? 'justify-center px-0' : ''}`} aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={sidebarOpen} aria-controls="workspace-sidebar">
              {sidebarOpen ? <PanelLeftClose className="h-[18px] w-[18px]" /> : <PanelLeftOpen className="h-[18px] w-[18px]" />}
              {sidebarOpen && <span>Collapse sidebar</span>}
            </button>
          </NavHint>}
          <Link
            href="/profile"
            className={`app-nav-item ${sidebarOpen ? 'px-2' : 'justify-center px-0'}`}
            data-active={pathname === '/profile'}
            title="Edit profile"
            onClick={closeSidebarOnMobile}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-800">
              {initials}
            </span>
            {sidebarOpen && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-neutral-900">
                    {user.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] capitalize text-neutral-500">
                    {isCollectorBurmese ? 'ကောက်ခံသူ' : user.role}
                  </span>
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </Link>
          <button
            type="button"
            onClick={logout}
            aria-label={
              collectorCopy.logoutLabel || collectorLabel('Logout', 'ထွက်မည်')
            }
            title={!sidebarOpen ? 'Logout' : undefined}
            className={`app-nav-item mt-1 ${sidebarOpen ? 'px-3' : 'justify-center px-0'}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {sidebarOpen && (
              <span>
                {collectorCopy.logoutLabel ||
                  collectorLabel('Logout', 'ထွက်မည်')}
              </span>
            )}
          </button>
        </div>
      </aside>
      <div
        ref={contentRef}
        className={`app-content min-w-0 transition-[margin] duration-200 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-[76px]'}`}
      >
        <header className="app-topbar flex h-[76px] items-center justify-between gap-3 border-b bg-card px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <NavHint label={sidebarOpen ? "Collapse sidebar" : "Open navigation"} enabled={isDesktop}>
              <Button
                ref={sidebarToggleRef}
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? "Collapse sidebar" : "Open navigation"}
                aria-controls="workspace-sidebar"
                aria-expanded={sidebarOpen}
                className="h-11 w-11 shrink-0"
              >
                {isDesktop ? (sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />) : <Menu className="h-5 w-5" />}
              </Button>
            </NavHint>
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <span className="hidden text-muted-foreground sm:inline">
                Workspace
              </span>
              <ChevronRight className="hidden h-3 w-3 text-muted-foreground/60 sm:block" />
              <span className="truncate font-medium text-foreground">
                {activeSection}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{formatDisplayDate(new Date())}</span>
            </div>
            {user.role === 'collector' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Globe className="h-4 w-4" />
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
            <Link
              href="/profile"
              aria-label="View profile"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-800 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-200"
            >
              {initials}
            </Link>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="app-main">
          {children}
        </main>
      </div>
    </div>
    </TooltipProvider>
  );
}
