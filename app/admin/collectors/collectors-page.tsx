'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, Edit, Trash2, Phone, Mail, MapPin, Users } from 'lucide-react';
import { useData, Collector } from '../../contexts/data-context';
import { useAuth } from '../../contexts/auth-context';
import Layout from '../../components/layout';
import nrcData from '@/lib/nrc-data.json';
import townshipData from '@/lib/township.json';
import { useToast } from '@/hooks/use-toast';
import { appendActivityLog } from '@/lib/activity-log';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const CUSTOMER_BILLING_FEE_CACHE_STORAGE_KEY = 'billpro_customer_billing_fee_cache_v1';

const normalizePhoneCacheKey = (value: string | null | undefined) =>
  String(value || '')
    .replace(/\D/g, '')
    .trim();

const normalizeCollectionServiceValue = (value: unknown): 'yes' | 'no' | null => {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (['yes', 'true', '1', 'enable', 'enabled', 'active', 'on'].includes(normalized)) {
    return 'yes';
  }
  if (['no', 'false', '0', 'disable', 'disabled', 'off'].includes(normalized)) {
    return 'no';
  }
  return null;
};

const toMyanmarPhoneLocal = (value: string | null | undefined) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('959')) return digits.slice(2).slice(0, 11);
  if (digits.startsWith('95')) return digits.slice(2).slice(0, 11);
  if (digits.startsWith('09')) return digits.slice(1).slice(0, 11);
  return digits.slice(0, 11);
};

const readCustomerBillingFeeCache = (): Record<
  string,
  { collectionService?: 'yes' | 'no' }
> => {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(CUSTOMER_BILLING_FEE_CACHE_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const resolveCollectionServiceFromCache = (
  cache: Record<string, { collectionService?: 'yes' | 'no' }>,
  identifiers: { id?: string | null; code?: string | null; phone?: string | null }
) => {
  const normalizedId = String(identifiers.id || '').trim();
  const normalizedCode = String(identifiers.code || '').trim();
  const normalizedPhone = normalizePhoneCacheKey(identifiers.phone);
  const lookupKeys = [
    normalizedId,
    normalizedId ? `id:${normalizedId}` : '',
    normalizedCode,
    normalizedCode ? `code:${normalizedCode}` : '',
    normalizedPhone,
    normalizedPhone ? `phone:${normalizedPhone}` : ''
  ].filter(Boolean);

  for (const key of lookupKeys) {
    const matched = cache[key];
    if (matched?.collectionService) {
      return matched.collectionService;
    }
  }
  return null;
};

type SelectOption = { value: string; label: string };

function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  id
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  id: string;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      onOpenChange={(open) => {
        if (!open) {
          setQuery('');
          return;
        }
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-8"
            autoFocus
            onKeyDown={(event) => event.stopPropagation()}
            onKeyDownCapture={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
            onKeyUpCapture={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-500">No results</div>
        ) : (
          filtered.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

type CollectorsPageProps = {
  openNew?: boolean;
  inlineForm?: boolean;
  listPath?: string;
};

export default function CollectorsPage({
  openNew = false,
  inlineForm = false,
  listPath = '/admin/collectors/collector-list'
}: CollectorsPageProps) {
  const { collectors, customers, bills, addCollector, updateCollector, deleteCollector } = useData();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);
  const [remoteCollectors, setRemoteCollectors] = useState<Collector[]>([]);
  const [collectorUserIdByCollectorId, setCollectorUserIdByCollectorId] = useState<Record<string, string>>({});
  const [hasFetchedCollectors, setHasFetchedCollectors] = useState(false);
  const [collectorsLoading, setCollectorsLoading] = useState(false);
  const [collectorsError, setCollectorsError] = useState('');
  const [isAddingCollector, setIsAddingCollector] = useState(false);
  const [isUpdatingCollectorStatus, setIsUpdatingCollectorStatus] = useState<Record<string, boolean>>({});
  const [isUpdatingCollector, setIsUpdatingCollector] = useState(false);
  const [availableCustomers, setAvailableCustomers] = useState<
    Array<{ id: string; name: string; collectorId?: string }>
  >([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState('');
  const [assignedCustomerIds, setAssignedCustomerIds] = useState<string[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningCollector, setAssigningCollector] = useState<Collector | null>(null);
  const [assignCustomerIds, setAssignCustomerIds] = useState<string[]>([]);
  const [assignQuery, setAssignQuery] = useState('');
  const [assignError, setAssignError] = useState('');
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewCollector, setViewCollector] = useState<Collector | null>(null);
  const [collectorStatus, setCollectorStatus] = useState<'enable' | 'disable' | 'takeoff'>('enable');
  const [nrcState, setNrcState] = useState('');
  const [nrcTownship, setNrcTownship] = useState('');
  const [nrcType, setNrcType] = useState('');
  const [nrcNumber, setNrcNumber] = useState('');
  const [collectorRegion, setCollectorRegion] = useState('');
  const [collectorDistrict, setCollectorDistrict] = useState('');
  const [collectorTownship, setCollectorTownship] = useState('');
  const [collectorCity, setCollectorCity] = useState('');
  const [collectorWard, setCollectorWard] = useState('');
  const [collectorStreet, setCollectorStreet] = useState('');
  const [collectorBuilding, setCollectorBuilding] = useState('');
  const [collectorPostalCode, setCollectorPostalCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newCollector, setNewCollector] = useState({
    name: '',
    phone: '',
    email: '',
    area: ''
  });

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const validateCollectorForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!newCollector.name.trim()) {
      nextErrors.name = 'Enter collector full name.';
    }
    const phoneDigits = newCollector.phone.replace(/\D/g, '');
    if (!phoneDigits) {
      nextErrors.phone = 'Enter phone number.';
    } else if (!/^9\d{6,10}$/.test(phoneDigits)) {
      nextErrors.phone = 'Enter valid Myanmar phone after +95 (start with 9).';
    }
    if (!nrcState || !nrcTownship || !nrcType || !nrcNumber) {
      nextErrors.nrc = 'Complete NRC fields.';
    } else if (nrcNumber.length !== 6) {
      nextErrors.nrc = 'NRC number must be 6 digits.';
    }
    if (newCollector.email.trim()) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCollector.email.trim());
      if (!emailOk) {
        nextErrors.email = 'Enter a valid email address.';
      }
    }
    return nextErrors;
  };

  const logAdminActivity = (
    action: string,
    description: string,
    targetType: string,
    targetId?: string,
    targetName?: string,
    metadata?: Record<string, unknown>
  ) => {
    appendActivityLog({
      module: 'collector',
      action,
      description,
      actorId: user?.id,
      actorName: user?.name,
      actorRole: user?.role,
      targetType,
      targetId,
      targetName,
      metadata
    });
  };

  const collectorsSource = hasFetchedCollectors ? remoteCollectors : [];

  const filteredCollectors = collectorsSource.filter(collector => {
    const matchesSearch = collector.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collector.phone.includes(searchTerm) ||
                         collector.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collector.area.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collector.id.includes(searchTerm);
    return matchesSearch;
  });

  const getCollectorCode = (collector: Collector) =>
    (collector as Collector & { collectorCode?: string }).collectorCode || '';

  const getCollectorAssignmentValue = (collector: Collector) =>
    getCollectorCode(collector) || collector.id;

  const isCustomerAssignedToCollector = (customer: { collectorId?: string }, collector: Collector) => {
    if (!customer.collectorId) return false;
    const collectorCode = getCollectorCode(collector);
    return (
      customer.collectorId === collector.id ||
      (collectorCode && customer.collectorId === collectorCode)
    );
  };

  const filteredAssignCustomers = useMemo(
    () =>
      availableCustomers.filter((customer) =>
        customer.name.toLowerCase().includes(assignQuery.toLowerCase())
      ),
    [availableCustomers, assignQuery]
  );

  const viewAssignedCustomers = useMemo(() => {
    if (!viewCollector) return [];
    const hasRemoteAssignments = availableCustomers.some((customer) => customer.collectorId);
    const source = hasRemoteAssignments ? availableCustomers : customers;
    return source.filter((customer) => isCustomerAssignedToCollector(customer, viewCollector));
  }, [availableCustomers, customers, viewCollector]);

  const updateRemoteCollectorStatus = (id: string, status: 'enable' | 'disable' | 'takeoff') => {
    setRemoteCollectors((prev) =>
      prev.map((collector) =>
        collector.id === id ? { ...collector, status } : collector
      )
    );
  };

  const updateRemoteCollector = (
    id: string,
    updates: Partial<Collector>
  ) => {
    setRemoteCollectors((prev) =>
      prev.map((collector) => (collector.id === id ? { ...collector, ...updates } : collector))
    );
  };

  const handleCollectorStatusChange = async (
    collector: Collector,
    status: 'enable' | 'disable' | 'takeoff'
  ) => {
    if (isUpdatingCollectorStatus[collector.id]) return;
    setIsUpdatingCollectorStatus((prev) => ({ ...prev, [collector.id]: true }));
    updateRemoteCollectorStatus(collector.id, status);

    try {
      const response = await fetch(`${API_BASE_URL}/collectors/${collector.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? 'Failed to update status';
        console.error(message, data);
        throw new Error(message);
      }

      logAdminActivity(
        'collector_status_changed',
        `Collector status changed to ${status}.`,
        'collector',
        collector.id,
        collector.name,
        { status }
      );
    } catch (error) {
      console.error('Failed to update status', error);
    } finally {
      setIsUpdatingCollectorStatus((prev) => ({ ...prev, [collector.id]: false }));
    }
  };

  const townshipOptions = useMemo(() => {
    return nrcData.nrcTownships
      .filter((township) => township.stateCode === nrcState)
      .slice()
      .sort((a, b) => a.name.en.localeCompare(b.name.en));
  }, [nrcState]);
  const typeOptions = nrcData.nrcTypes;
  const stateOptions = nrcData.nrcStates;
  const regionOptions = useMemo(() => Object.keys(townshipData).sort(), []);
  const collectorDistrictOptions = useMemo(() => {
    if (!collectorRegion) return [];
    return Object.keys(townshipData[collectorRegion as keyof typeof townshipData]).sort();
  }, [collectorRegion]);
  const collectorTownshipOptions = useMemo(() => {
    if (!collectorRegion || !collectorDistrict) return [];
    const districts =
      townshipData[collectorRegion as keyof typeof townshipData] as Record<string, string[]>;
    const list = districts?.[collectorDistrict] ?? [];
    return [...list].sort();
  }, [collectorRegion, collectorDistrict]);

  const nrcStateOptions = useMemo<SelectOption[]>(
    () =>
      stateOptions.map((state) => ({
        value: state.number.en,
        label: `${state.number.en} - ${state.name.en}`
      })),
    [stateOptions]
  );
  const nrcTypeOptions = useMemo<SelectOption[]>(
    () => typeOptions.map((type) => ({ value: type.name.en, label: type.name.en })),
    [typeOptions]
  );
  const nrcTownshipOptions = useMemo<SelectOption[]>(
    () =>
      townshipOptions.map((option) => ({
        value: option.short.en,
        label: `${option.short.en} - ${option.name.en}`
      })),
    [townshipOptions]
  );
  const collectorRegionSelectOptions = useMemo<SelectOption[]>(
    () => regionOptions.map((region) => ({ value: region, label: region })),
    [regionOptions]
  );
  const collectorDistrictSelectOptions = useMemo<SelectOption[]>(
    () => collectorDistrictOptions.map((district) => ({ value: district, label: district })),
    [collectorDistrictOptions]
  );
  const collectorTownshipSelectOptions = useMemo<SelectOption[]>(
    () => collectorTownshipOptions.map((township) => ({ value: township, label: township })),
    [collectorTownshipOptions]
  );
  const collectorStatusOptions = [
    { value: 'enable', label: 'Enable' },
    { value: 'disable', label: 'Disable' },
    { value: 'takeoff', label: 'Take off' }
  ];

  const formatAddress = (address: {
    building: string;
    street: string;
    ward: string;
    city: string;
    township: string;
    district: string;
    region: string;
    postalCode: string;
  }) => {
    const parts = [
      address.building,
      address.street,
      address.ward,
      address.city,
      address.township,
      address.district,
      address.region
    ].filter((part) => part && part.trim().length > 0);
    const base = parts.join(', ');
    if (!address.postalCode) {
      return base;
    }
    return base ? `${base}, ${address.postalCode}` : address.postalCode;
  };

  const formatNrc = (state: string, township: string, type: string, number: string) => {
    if (!state || !township || !type || !number) return '';
    return `${state}/${township}(${type})${number}`;
  };

  const parseNrc = (value?: string | null) => {
    if (!value) return { state: '', township: '', type: '', number: '' };
    const raw = String(value).trim();
    const canonicalMatch = raw.match(/^([^/]+?)\s*\/\s*([^(]+?)\s*\(\s*([^)]+?)\s*\)\s*([A-Za-z0-9]+)$/);
    if (canonicalMatch) {
      return {
        state: canonicalMatch[1]?.trim() ?? '',
        township: canonicalMatch[2]?.trim() ?? '',
        type: canonicalMatch[3]?.trim() ?? '',
        number: canonicalMatch[4]?.trim() ?? ''
      };
    }

    const compact = raw.replace(/\s+/g, '');
    const compactCanonicalMatch = compact.match(/^([^/]+?)\/([^(]+?)\(([^)]+?)\)([A-Za-z0-9]+)$/);
    if (compactCanonicalMatch) {
      return {
        state: compactCanonicalMatch[1] ?? '',
        township: compactCanonicalMatch[2] ?? '',
        type: compactCanonicalMatch[3] ?? '',
        number: compactCanonicalMatch[4] ?? ''
      };
    }

    const legacyMatch = compact.match(/^([^/]+?)\/(.+?)([A-Za-z])(\d{6})$/);
    if (legacyMatch) {
      return {
        state: legacyMatch[1] ?? '',
        township: legacyMatch[2] ?? '',
        type: legacyMatch[3] ?? '',
        number: legacyMatch[4] ?? ''
      };
    }

    const match = raw.match(/^(.+?)\/(.+?)\((.+?)\)(.+)$/);
    if (!match) return { state: '', township: '', type: '', number: '' };
    return {
      state: match[1] ?? '',
      township: match[2] ?? '',
      type: match[3] ?? '',
      number: match[4] ?? ''
    };
  };

  const resolveNrcOptionValue = (value: string, options: SelectOption[]) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return '';
    const matched = options.find((option) => option.value.trim().toLowerCase() === normalized);
    return matched?.value ?? '';
  };

  const parseAddressParts = (value?: string | null) => {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return {
        building: '',
        street: '',
        ward: '',
        city: '',
        township: '',
        district: '',
        region: '',
        postalCode: ''
      };
    }

    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    const postalCode = parts.length > 0 && /^\d{4,6}$/.test(parts[parts.length - 1])
      ? parts.pop() ?? ''
      : '';

    return {
      building: parts[0] ?? '',
      street: parts[1] ?? '',
      ward: parts[2] ?? '',
      city: parts[3] ?? '',
      township: parts[4] ?? '',
      district: parts[5] ?? '',
      region: parts[6] ?? '',
      postalCode
    };
  };

  const firstNonEmpty = (...values: Array<string | null | undefined>) => {
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return '';
  };

  const inferRegionDistrictTownshipFromAddress = (addressRaw?: string | null) => {
    const text = String(addressRaw ?? '').toLowerCase();
    if (!text) {
      return { region: '', district: '', township: '' };
    }

    const regionEntries = Object.entries(
      townshipData as Record<string, Record<string, string[]>>
    );

    for (const [regionName, districtMap] of regionEntries) {
      const districtEntries = Object.entries(districtMap ?? {});
      for (const [districtName, townshipList] of districtEntries) {
        for (const townshipName of townshipList ?? []) {
          const township = String(townshipName ?? '').trim();
          if (!township) continue;
          if (text.includes(township.toLowerCase())) {
            return {
              region: regionName,
              district: districtName,
              township
            };
          }
        }
      }
    }

    return { region: '', district: '', township: '' };
  };

  useEffect(() => {
    if (inlineForm) return;
    let isMounted = true;

    const fetchCollectors = async () => {
      setHasFetchedCollectors(false);
      setCollectorsLoading(true);
      setCollectorsError('');
      try {
        const response = await fetch(`${API_BASE_URL}/collectors`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.message ?? 'Failed to load collectors';
          throw new Error(message);
        }

        const data = await response.json().catch(() => ([]));
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.collectors)
          ? data.collectors
          : Array.isArray(data?.data)
          ? data.data
          : [];

        const userIdMap: Record<string, string> = {};
        const normalized = list.map((item: any, index: number) => {
          const collectorId = String(item?.id ?? item?.user?.id ?? index + 1);
          const linkedUserId = String(item?.user?.id ?? '').trim();
          if (collectorId && linkedUserId) {
            userIdMap[collectorId] = linkedUserId;
          }
          return {
            id: collectorId,
            collectorCode: item?.collectorCode ?? item?.user?.username ?? '',
            name: item?.user?.name ?? 'Unknown',
            phone: item?.user?.phone ?? '',
            email: item?.user?.email ?? '',
            area:
              item?.area ??
              item?.township ??
              item?.collectorProfile?.area ??
              item?.collectorProfile?.township ??
              item?.profile?.area ??
              item?.profile?.township ??
              '',
            status: item?.status ?? item?.user?.status ?? 'enable',
            nrc:
              item?.nrc ??
              item?.collectorProfile?.nrc ??
              item?.profile?.nrc ??
              item?.user?.collectorProfile?.nrc ??
              '',
            address:
              item?.address ??
              item?.collectorProfile?.address ??
              item?.profile?.address ??
              item?.user?.collectorProfile?.address ??
              '',
            addressDetails: {
              region:
                item?.region ??
                item?.collectorProfile?.region ??
                item?.profile?.region ??
                item?.user?.collectorProfile?.region ??
                '',
              district:
                item?.district ??
                item?.collectorProfile?.district ??
                item?.profile?.district ??
                item?.user?.collectorProfile?.district ??
                '',
              township:
                item?.township ??
                item?.collectorProfile?.township ??
                item?.profile?.township ??
                item?.user?.collectorProfile?.township ??
                '',
              city:
                item?.city ??
                item?.collectorProfile?.city ??
                item?.profile?.city ??
                item?.user?.collectorProfile?.city ??
                '',
              ward:
                item?.ward ??
                item?.collectorProfile?.ward ??
                item?.profile?.ward ??
                item?.user?.collectorProfile?.ward ??
                '',
              street:
                item?.street ??
                item?.collectorProfile?.street ??
                item?.profile?.street ??
                item?.user?.collectorProfile?.street ??
                '',
              building:
                item?.building ??
                item?.collectorProfile?.building ??
                item?.profile?.building ??
                item?.user?.collectorProfile?.building ??
                '',
              postalCode:
                item?.postalCode ??
                item?.collectorProfile?.postalCode ??
                item?.profile?.postalCode ??
                item?.user?.collectorProfile?.postalCode ??
                ''
            }
          };
        }) as Collector[];

        if (isMounted) {
          setRemoteCollectors(normalized);
          setCollectorUserIdByCollectorId(userIdMap);
          setHasFetchedCollectors(true);
        }
      } catch (error) {
        if (isMounted) {
          setCollectorsError(error instanceof Error ? error.message : 'Failed to load collectors');
          setRemoteCollectors([]);
          setCollectorUserIdByCollectorId({});
          setHasFetchedCollectors(true);
        }
      } finally {
        if (isMounted) {
          setCollectorsLoading(false);
        }
      }
    };

    fetchCollectors();

    return () => {
      isMounted = false;
    };
  }, [inlineForm]);

  useEffect(() => {
    if (inlineForm) return;
    let isMounted = true;

    const fetchCustomers = async () => {
      setCustomersLoading(true);
      setCustomersError('');
      try {
        const response = await fetch(`${API_BASE_URL}/customers`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.message ?? 'Failed to load customers';
          throw new Error(message);
        }

        const data = await response.json().catch(() => ([]));
        const list = Array.isArray(data) ? data : Array.isArray(data?.customers) ? data.customers : [];
        const billingFeeCache = readCustomerBillingFeeCache();
        const normalized = list
          .map((item: any, index: number) => {
            const id = String(item?.id ?? index + 1);
            const collectorIdRaw =
              item?.collectorCode ?? item?.collectorId ?? item?.collector?.id ?? '';
            const collectorId = collectorIdRaw ? String(collectorIdRaw) : '';
            const customerCode = String(item?.customerCode ?? '');
            const primaryPhone =
              item?.primaryPhone ??
              item?.contactInformation?.primaryPhone ??
              item?.phone ??
              '';
            const explicitCollectionService = normalizeCollectionServiceValue(
              item?.collectionService ??
                item?.collectionServiceEnabled ??
                item?.billingInformation?.collectionService ??
                item?.customer?.collectionService ??
                item?.customer?.collectionServiceEnabled
            );
            const cachedCollectionService = resolveCollectionServiceFromCache(billingFeeCache, {
              id,
              code: customerCode,
              phone: primaryPhone
            });
            const collectionService = explicitCollectionService ?? cachedCollectionService ?? 'yes';
            return {
              id,
              name:
                item?.personalName ||
                item?.companyName ||
                item?.name ||
                'Unknown',
              collectorId,
              collectionService
            };
          })
          .filter((item: { collectionService: 'yes' | 'no' }) => item.collectionService !== 'no')
          .map((item: { id: string; name: string; collectorId?: string }) => ({
            id: item.id,
            name: item.name,
            collectorId: item.collectorId
          }));

        if (isMounted) {
          setAvailableCustomers(normalized);
        }
      } catch (error) {
        if (isMounted) {
          setCustomersError(error instanceof Error ? error.message : 'Failed to load customers');
          setAvailableCustomers([]);
        }
      } finally {
        if (isMounted) {
          setCustomersLoading(false);
        }
      }
    };

    fetchCustomers();

    return () => {
      isMounted = false;
    };
  }, [inlineForm]);

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  const handleAddCollector = async () => {
    if (isAddingCollector) return;
    const validationErrors = validateCollectorForm();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      toast({
        title: 'Required fields missing',
        description: Object.values(validationErrors)[0] ?? 'Please fill required fields.',
        variant: 'destructive'
      });
      return;
    }
    setIsAddingCollector(true);

    const nrcValue = formatNrc(nrcState, nrcTownship, nrcType, nrcNumber);
    const addressValue = formatAddress({
      building: collectorBuilding,
      street: collectorStreet,
      ward: collectorWard,
      city: collectorCity,
      township: collectorTownship,
      district: collectorDistrict,
      region: collectorRegion,
      postalCode: collectorPostalCode
    });

    const enteredEmail = newCollector.email.trim();
    const fallbackGeneratedEmail = `collector-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@billpro.local`;
    const emailForCreate = enteredEmail || fallbackGeneratedEmail;

    const payload = {
      collector: {
        name: newCollector.name,
        phone: newCollector.phone,
        email: emailForCreate,
        area: collectorTownship || collectorDistrict || newCollector.area,
        status: collectorStatus,
        nrc: nrcValue,
        address: addressValue
      }
    };

    console.log('Add collector payload:', JSON.stringify(payload, null, 2));

    let createdCollectorId: string | undefined;
    let createdCollectorCode: string | undefined;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/collectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.message ?? 'Failed to create collector';
        toast({
          title: 'Create collector failed',
          description: String(message),
          variant: 'destructive'
        });
        setIsAddingCollector(false);
        return;
      }

      const directId = data?.id ?? data?.collectorId;
      createdCollectorId =
        (directId ? String(directId) : undefined) ||
        (data?.collector?.id ? String(data.collector.id) : undefined);
      createdCollectorCode =
        (data?.collectorProfile?.collectorCode
          ? String(data.collectorProfile.collectorCode)
          : undefined) ||
        (data?.collector?.collectorCode ? String(data.collector.collectorCode) : undefined) ||
        (data?.collectorCode ? String(data.collectorCode) : undefined) ||
        (data?.username ? String(data.username) : undefined) ||
        (data?.user?.username ? String(data.user.username) : undefined);

      const assignmentValue = createdCollectorCode || createdCollectorId;
      const selectedCustomerIds = Array.from(new Set(assignedCustomerIds.filter(Boolean)));
      if (assignmentValue && selectedCustomerIds.length > 0) {
        await Promise.all(
          selectedCustomerIds.map((customerId) =>
            updateCustomerCollector(customerId, assignmentValue)
          )
        );
        setAvailableCustomers((prev) =>
          prev.map((customer) =>
            selectedCustomerIds.includes(customer.id)
              ? { ...customer, collectorId: assignmentValue }
              : customer
          )
        );
      }
    } catch (error) {
      toast({
        title: 'Network error',
        description: error instanceof Error ? error.message : 'Failed to create collector',
        variant: 'destructive'
      });
      setIsAddingCollector(false);
      return;
    }

    addCollector({
      ...newCollector,
      area: collectorTownship || collectorDistrict || newCollector.area,
      status: collectorStatus,
      nrc: nrcValue,
      address: addressValue,
      addressDetails: {
        region: collectorRegion,
        district: collectorDistrict,
        township: collectorTownship,
        city: collectorCity,
        ward: collectorWard,
        street: collectorStreet,
        building: collectorBuilding,
        postalCode: collectorPostalCode
      }
    });
    logAdminActivity(
      'collector_created',
      'New collector created.',
      'collector',
      createdCollectorId,
      newCollector.name,
      {
        status: collectorStatus,
        area: collectorTownship || collectorDistrict || newCollector.area
      }
    );
    setNewCollector({
      name: '',
      phone: '',
      email: '',
      area: ''
    });
    setCollectorStatus('enable');
    setNrcState('');
    setNrcTownship('');
    setNrcType('');
    setNrcNumber('');
    setCollectorRegion('');
    setCollectorDistrict('');
    setCollectorTownship('');
    setCollectorCity('');
    setCollectorWard('');
    setCollectorStreet('');
    setCollectorBuilding('');
    setCollectorPostalCode('');
    setErrors({});
    setAssignedCustomerIds([]);
    setCustomerQuery('');
    toast({
      title: 'Collector added',
      description: 'Redirecting to collector list...',
      duration: 3000
    });

    setTimeout(() => {
      router.replace(listPath);
    }, 3000);

    setIsAddingCollector(false);
  };

  const handleEditCollector = (collector: Collector) => {
    const parsedNrc = parseNrc(collector.nrc);
    const parsedAddress = parseAddressParts(collector.address);
    const inferredByAddress = inferRegionDistrictTownshipFromAddress(collector.address);
    const resolvedRegion = firstNonEmpty(
      collector.addressDetails?.region,
      parsedAddress.region,
      inferredByAddress.region
    );
    const resolvedDistrict = firstNonEmpty(
      collector.addressDetails?.district,
      parsedAddress.district,
      inferredByAddress.district
    );
    const districtOptions = resolvedRegion
      ? Object.keys(
          townshipData[resolvedRegion as keyof typeof townshipData] ??
            ({} as Record<string, string[]>)
        ).sort()
      : [];
    const resolvedTownshipOptions =
      resolvedRegion && resolvedDistrict
        ? ((
            townshipData[resolvedRegion as keyof typeof townshipData] as Record<string, string[]>
          )?.[resolvedDistrict] ?? [])
        : [];
    const fallbackTownshipCandidate = firstNonEmpty(
      collector.addressDetails?.township,
      parsedAddress.township,
      collector.area,
      inferredByAddress.township
    );
    const resolvedNrcState = resolveNrcOptionValue(parsedNrc.state, nrcStateOptions);
    const resolvedNrcType = resolveNrcOptionValue(parsedNrc.type, nrcTypeOptions);
    const resolvedNrcTownship = resolveNrcOptionValue(
      parsedNrc.township,
      nrcData.nrcTownships
        .filter((township) => township.stateCode === resolvedNrcState)
        .slice()
        .sort((a, b) => a.name.en.localeCompare(b.name.en))
        .map((option) => ({
          value: option.short.en,
          label: `${option.short.en} - ${option.name.en}`
        }))
    );
    setEditingCollector(collector);
    setNewCollector({
      name: collector.name,
      phone: toMyanmarPhoneLocal(collector.phone),
      email: collector.email,
      area: collector.area
    });
    setErrors({});
    setCollectorStatus(collector.status ?? 'enable');
    setNrcState(resolvedNrcState);
    setNrcTownship(resolvedNrcTownship);
    setNrcType(resolvedNrcType);
    setNrcNumber(parsedNrc.number);
    setCollectorRegion(
      resolvedRegion && collectorRegionSelectOptions.some((option) => option.value === resolvedRegion)
        ? resolvedRegion
        : ''
    );
    setCollectorDistrict(
      resolvedDistrict && districtOptions.includes(resolvedDistrict) ? resolvedDistrict : ''
    );
    setCollectorTownship(
      fallbackTownshipCandidate &&
        resolvedTownshipOptions.includes(fallbackTownshipCandidate)
        ? fallbackTownshipCandidate
        : ''
    );
    setCollectorCity(firstNonEmpty(collector.addressDetails?.city, parsedAddress.city));
    setCollectorWard(firstNonEmpty(collector.addressDetails?.ward, parsedAddress.ward));
    setCollectorStreet(
      firstNonEmpty(
        collector.addressDetails?.street,
        parsedAddress.street,
        collector.address ? collector.address : ''
      )
    );
    setCollectorBuilding(firstNonEmpty(collector.addressDetails?.building, parsedAddress.building));
    setCollectorPostalCode(firstNonEmpty(collector.addressDetails?.postalCode, parsedAddress.postalCode));
    const assignmentSource =
      availableCustomers.length > 0
        ? availableCustomers
        : customers.map((customer) => ({
            id: customer.id,
            name: customer.name,
            collectorId: customer.collectorId
          }));
    const preselectedCustomerIds = assignmentSource
      .filter((customer) => isCustomerAssignedToCollector(customer, collector))
      .map((customer) => customer.id);
    setAssignedCustomerIds(Array.from(new Set(preselectedCustomerIds)));
    setCustomerQuery('');
  };

  const handleUpdateCollector = async () => {
    if (editingCollector) {
      if (isUpdatingCollector) return;
      const validationErrors = validateCollectorForm();
      setErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        toast({
          title: 'Required fields missing',
          description: Object.values(validationErrors)[0] ?? 'Please fill required fields.',
          variant: 'destructive'
        });
        return;
      }
      setIsUpdatingCollector(true);

      const nrcValue = formatNrc(nrcState, nrcTownship, nrcType, nrcNumber);
      const addressValue = formatAddress({
        building: collectorBuilding,
        street: collectorStreet,
        ward: collectorWard,
        city: collectorCity,
        township: collectorTownship,
        district: collectorDistrict,
        region: collectorRegion,
        postalCode: collectorPostalCode
      });

      const payload = {
        name: newCollector.name,
        phone: newCollector.phone,
        ...(newCollector.email.trim() ? { email: newCollector.email.trim() } : {}),
        area: collectorTownship || collectorDistrict || newCollector.area,
        status: collectorStatus,
        nrc: nrcValue,
        address: addressValue
      };
      const linkedUserId = String(collectorUserIdByCollectorId[editingCollector.id] ?? '').trim();
      const linkedAccountPayload: Record<string, string> = {
        phone: newCollector.phone.trim()
      };
      if (newCollector.email.trim()) {
        linkedAccountPayload.email = newCollector.email.trim();
      }

      try {
        const response = await fetch(`${API_BASE_URL}/collectors/${editingCollector.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.message ?? 'Failed to update collector';
          toast({
            title: 'Update collector failed',
            description: String(message),
            variant: 'destructive'
          });
          setIsUpdatingCollector(false);
          return;
        }

        if (linkedUserId && Object.keys(linkedAccountPayload).length > 0) {
          const userResponse = await fetch(`${API_BASE_URL}/users/${linkedUserId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              account: linkedAccountPayload
            })
          });
          if (!userResponse.ok) {
            const userData = await userResponse.json().catch(() => null);
            const message = Array.isArray(userData?.message)
              ? userData.message.join(', ')
              : userData?.message ?? userData?.error ?? 'Failed to update linked login account';
            toast({
              title: 'Login account update warning',
              description: String(message),
              variant: 'destructive'
            });
          }
        }

        const assignmentValue = getCollectorAssignmentValue(editingCollector);
        const currentAssigned = availableCustomers
          .filter((customer) => isCustomerAssignedToCollector(customer, editingCollector))
          .map((customer) => customer.id);
        const targetAssigned = Array.from(new Set(assignedCustomerIds.filter(Boolean)));
        const toAssign = targetAssigned.filter((id) => !currentAssigned.includes(id));
        const toUnassign = currentAssigned.filter((id) => !targetAssigned.includes(id));

        if (assignmentValue && (toAssign.length > 0 || toUnassign.length > 0)) {
          await Promise.all([
            ...toAssign.map((id) => updateCustomerCollector(id, assignmentValue)),
            ...toUnassign.map((id) => updateCustomerCollector(id, null))
          ]);

          setAvailableCustomers((prev) =>
            prev.map((customer) => {
              if (toAssign.includes(customer.id)) {
                return { ...customer, collectorId: assignmentValue };
              }
              if (toUnassign.includes(customer.id)) {
                return { ...customer, collectorId: '' };
              }
              return customer;
            })
          );
        }
      } catch (error) {
        toast({
          title: 'Network error',
          description: error instanceof Error ? error.message : 'Failed to update collector',
          variant: 'destructive'
        });
        setIsUpdatingCollector(false);
        return;
      }

      updateCollector(editingCollector.id, {
        ...newCollector,
        area: collectorTownship || collectorDistrict || newCollector.area,
        status: collectorStatus,
        nrc: nrcValue,
        address: addressValue,
        addressDetails: {
          region: collectorRegion,
          district: collectorDistrict,
          township: collectorTownship,
          city: collectorCity,
          ward: collectorWard,
          street: collectorStreet,
          building: collectorBuilding,
          postalCode: collectorPostalCode
        }
      });
      updateRemoteCollector(editingCollector.id, {
        name: newCollector.name,
        phone: newCollector.phone,
        email: newCollector.email,
        area: collectorTownship || collectorDistrict || newCollector.area,
        status: collectorStatus,
        nrc: nrcValue,
        address: addressValue,
        addressDetails: {
          region: collectorRegion,
          district: collectorDistrict,
          township: collectorTownship,
          city: collectorCity,
          ward: collectorWard,
          street: collectorStreet,
          building: collectorBuilding,
          postalCode: collectorPostalCode
        }
      });
      logAdminActivity(
        'collector_updated',
        'Collector profile updated.',
        'collector',
        editingCollector.id,
        newCollector.name,
        {
          status: collectorStatus,
          area: collectorTownship || collectorDistrict || newCollector.area,
          assignedCustomerCount: assignedCustomerIds.length
        }
      );
      setEditingCollector(null);
      setNewCollector({
        name: '',
        phone: '',
        email: '',
        area: ''
      });
      setCollectorStatus('enable');
      setNrcState('');
      setNrcTownship('');
      setNrcType('');
      setNrcNumber('');
      setCollectorRegion('');
      setCollectorDistrict('');
      setCollectorTownship('');
      setCollectorCity('');
      setCollectorWard('');
      setCollectorStreet('');
      setCollectorBuilding('');
      setCollectorPostalCode('');
      setErrors({});
      setAssignedCustomerIds([]);
      setCustomerQuery('');

      toast({
        title: 'Collector updated',
        description: 'Redirecting to collector list...',
        duration: 3000
      });

      setTimeout(() => {
        router.replace(listPath);
      }, 3000);

      setIsUpdatingCollector(false);
    }
  };

  const getCollectorStats = (collector: Collector) => {
    const hasRemoteAssignments = availableCustomers.some((customer) => customer.collectorId);
    const assignedCustomers = hasRemoteAssignments
      ? availableCustomers.filter((customer) => isCustomerAssignedToCollector(customer, collector))
      : customers.filter((customer) => isCustomerAssignedToCollector(customer, collector));
    const collectorBills = bills.filter((bill) => bill.collectorId === collector.id);
    const paidBills = collectorBills.filter(b => b.status === 'paid');
    const totalCollected = paidBills.reduce((sum, b) => sum + b.amount, 0);
    const collectionRate = collectorBills.length > 0 ? (paidBills.length / collectorBills.length * 100) : 0;

    return {
      assignedCustomers: assignedCustomers.length,
      totalCollected,
      collectionRate,
      totalBills: collectorBills.length
    };
  };

  const openAssignDialog = (collector: Collector) => {
    const currentAssigned = availableCustomers
      .filter((customer) => isCustomerAssignedToCollector(customer, collector))
      .map((customer) => customer.id);
    setAssigningCollector(collector);
    setAssignCustomerIds(currentAssigned);
    setAssignQuery('');
    setAssignError('');
    setAssignDialogOpen(true);
  };

  const openViewDialog = (collector: Collector) => {
    setViewCollector(collector);
    setViewDialogOpen(true);
  };

  const updateCustomerCollector = async (customerId: string, collectorCode: string | null) => {
    const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ collectorCode })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = data?.message ?? 'Failed to assign customers';
      throw new Error(message);
    }
  };

  const handleSaveAssignments = async () => {
    if (!assigningCollector) return;
    setIsSavingAssignments(true);
    setAssignError('');

    const collectorId = getCollectorAssignmentValue(assigningCollector);
    const currentAssigned = availableCustomers
      .filter((customer) => isCustomerAssignedToCollector(customer, assigningCollector))
      .map((customer) => customer.id);

    const toAssign = assignCustomerIds.filter((id) => !currentAssigned.includes(id));
    const toUnassign = currentAssigned.filter((id) => !assignCustomerIds.includes(id));

    if (toAssign.length === 0 && toUnassign.length === 0) {
      setIsSavingAssignments(false);
      setAssignDialogOpen(false);
      return;
    }

    try {
      await Promise.all([
        ...toAssign.map((id) => updateCustomerCollector(id, collectorId)),
        ...toUnassign.map((id) => updateCustomerCollector(id, null))
      ]);

      setAvailableCustomers((prev) =>
        prev.map((customer) => {
          if (toAssign.includes(customer.id)) {
            return { ...customer, collectorId };
          }
          if (toUnassign.includes(customer.id)) {
            return { ...customer, collectorId: '' };
          }
          return customer;
        })
      );

      toast({
        title: 'Assignments updated',
        description: 'Collector assignments have been saved.'
      });
      logAdminActivity(
        'collector_assignments_updated',
        'Collector customer assignments updated.',
        'collector',
        assigningCollector.id,
        assigningCollector.name,
        {
          assignedCount: toAssign.length,
          unassignedCount: toUnassign.length
        }
      );

      setAssignDialogOpen(false);
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : 'Failed to assign customers.');
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const formContent = (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-sky-50 px-6 py-4">
        <h3 className="text-lg font-semibold text-slate-900">Collector Information</h3>
      </div>
      <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="collector-name" className="text-sm font-medium text-slate-700">
            Full Name <span className="text-rose-600">*</span>
          </Label>
          <Input
            id="collector-name"
            value={newCollector.name}
            onChange={(e) => {
              setNewCollector({ ...newCollector, name: e.target.value });
              if (e.target.value.trim()) clearFieldError('name');
            }}
            placeholder="Enter collector's full name"
          />
          {errors.name && <p className="text-xs text-rose-600">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="collector-status" className="text-sm font-medium text-slate-700">
            Collector Status <span className="text-rose-600">*</span>
          </Label>
          <Select value={collectorStatus} onValueChange={(value) => setCollectorStatus(value as 'enable' | 'disable' | 'takeoff')}>
            <SelectTrigger id="collector-status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {collectorStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="collector-email" className="text-sm font-medium text-slate-700">
            Email Address
          </Label>
          <Input
            id="collector-email"
            type="email"
            value={newCollector.email}
            onChange={(e) => {
              setNewCollector({ ...newCollector, email: e.target.value });
              clearFieldError('email');
            }}
            placeholder="collector@billflow.com"
          />
          {errors.email && <p className="text-xs text-rose-600">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="collector-phone" className="text-sm font-medium text-slate-700">
            Phone Number <span className="text-rose-600">*</span>
          </Label>
          <div className="flex gap-2">
            <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
              +95
            </div>
            <Input
              id="collector-phone"
              value={newCollector.phone}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                setNewCollector({ ...newCollector, phone: digitsOnly });
                clearFieldError('phone');
              }}
              placeholder="9 123 456 789"
              inputMode="numeric"
            />
          </div>
          {errors.phone && <p className="text-xs text-rose-600">{errors.phone}</p>}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-sm font-medium text-slate-700">
            NRC <span className="text-rose-600">*</span>
          </Label>
          <div className="grid gap-3 md:grid-cols-4 rounded-lg border border-slate-200 bg-slate-100 p-4">
            <SearchableSelect
              id="collector-nrc-state"
              value={nrcState}
              onValueChange={(value) => {
                setNrcState(value);
                setNrcTownship('');
                clearFieldError('nrc');
              }}
              options={nrcStateOptions}
              placeholder="State"
            />
            <SearchableSelect
              id="collector-nrc-township"
              value={nrcTownship}
              onValueChange={(value) => {
                setNrcTownship(value);
                clearFieldError('nrc');
              }}
              options={nrcTownshipOptions}
              placeholder="Township"
            />
            <SearchableSelect
              id="collector-nrc-type"
              value={nrcType}
              onValueChange={(value) => {
                setNrcType(value);
                clearFieldError('nrc');
              }}
              options={nrcTypeOptions}
              placeholder="Type"
            />
            <Input
              id="collector-nrc-number"
              value={nrcNumber}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                setNrcNumber(digitsOnly);
                clearFieldError('nrc');
              }}
              placeholder="123456"
              inputMode="numeric"
            />
          </div>
          {errors.nrc && <p className="text-xs text-rose-600">{errors.nrc}</p>}
        </div>
      </div>
      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-amber-400 pl-3">
          Assign Customers
        </h4>
        <div className="space-y-3">
          <Input
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            placeholder="Search customers..."
          />
          {customersError && (
            <p className="text-xs text-rose-600">{customersError}</p>
          )}
          {customersLoading ? (
            <p className="text-xs text-slate-500">Loading customers...</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
              {availableCustomers
                .filter((customer) =>
                  customer.name.toLowerCase().includes(customerQuery.toLowerCase())
                )
                .map((customer) => {
                  const checked = assignedCustomerIds.includes(customer.id);
                  return (
                    <label
                      key={customer.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm text-slate-700"
                    >
                      <span>{customer.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setAssignedCustomerIds((prev) => [...prev, customer.id]);
                          } else {
                            setAssignedCustomerIds((prev) => prev.filter((id) => id !== customer.id));
                          }
                        }}
                      />
                    </label>
                  );
                })}
              {availableCustomers.length === 0 && (
                <p className="text-xs text-slate-500">No customers available.</p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-violet-400 pl-3">
          Address Information
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="collector-region" className="text-sm font-medium text-slate-700">
              Region <span className="text-rose-600">*</span>
            </Label>
            <SearchableSelect
              id="collector-region"
              value={collectorRegion}
              onValueChange={(value) => {
                setCollectorRegion(value);
                setCollectorDistrict('');
                setCollectorTownship('');
              }}
              options={collectorRegionSelectOptions}
              placeholder="Select region"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collector-district" className="text-sm font-medium text-slate-700">
              District <span className="text-rose-600">*</span>
            </Label>
            <SearchableSelect
              id="collector-district"
              value={collectorDistrict}
              onValueChange={(value) => {
                setCollectorDistrict(value);
                setCollectorTownship('');
              }}
              options={collectorDistrictSelectOptions}
              placeholder="Select district"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collector-township" className="text-sm font-medium text-slate-700">
              Township <span className="text-rose-600">*</span>
            </Label>
            <SearchableSelect
              id="collector-township"
              value={collectorTownship}
              onValueChange={setCollectorTownship}
              options={collectorTownshipSelectOptions}
              placeholder="Select township"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collector-city" className="text-sm font-medium text-slate-700">
              City
            </Label>
            <Input
              id="collector-city"
              value={collectorCity}
              onChange={(e) => setCollectorCity(e.target.value)}
              placeholder="City"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collector-ward" className="text-sm font-medium text-slate-700">
              Ward <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="collector-ward"
              value={collectorWard}
              onChange={(e) => setCollectorWard(e.target.value)}
              placeholder="Ward"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collector-street" className="text-sm font-medium text-slate-700">
              Street
            </Label>
            <Input
              id="collector-street"
              value={collectorStreet}
              onChange={(e) => setCollectorStreet(e.target.value)}
              placeholder="Street"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collector-building" className="text-sm font-medium text-slate-700">
              Building / Unit
            </Label>
            <Input
              id="collector-building"
              value={collectorBuilding}
              onChange={(e) => setCollectorBuilding(e.target.value)}
              placeholder="Building / Unit"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collector-postal" className="text-sm font-medium text-slate-700">
              Postal Code
            </Label>
            <Input
              id="collector-postal"
              value={collectorPostalCode}
              onChange={(e) => setCollectorPostalCode(e.target.value)}
              placeholder="Postal code"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-sm font-medium text-slate-700">Full Address</Label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {formatAddress({
                building: collectorBuilding,
                street: collectorStreet,
                ward: collectorWard,
                city: collectorCity,
                township: collectorTownship,
                district: collectorDistrict,
                region: collectorRegion,
                postalCode: collectorPostalCode
              }) || '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {openNew ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">New Collector</h1>
              <p className="text-gray-600">Create a new collector profile</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Collector Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {formContent}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => router.replace(listPath)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCollector} disabled={isAddingCollector}>
                    {isAddingCollector ? 'Adding...' : 'Add Collector'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Collector Management</h1>
              <p className="text-gray-600">Manage your collection team</p>
            </div>
          </div>
        )}

        {!inlineForm && editingCollector && (
          <Card>
            <CardHeader>
              <CardTitle>Update Collector</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {formContent}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingCollector(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateCollector} disabled={isUpdatingCollector}>
                  {isUpdatingCollector ? 'Updating...' : 'Update Collector'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!inlineForm && !editingCollector && !openNew && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Collectors</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{collectorsSource.length}</div>
                  <p className="text-xs text-muted-foreground">Active collection team</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Customers/Collector</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {collectorsSource.length > 0 ? Math.round(customers.length / collectorsSource.length) : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Customer distribution</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {collectorsSource.length > 0 ? collectorsSource[0].name.split(' ')[0] : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">Highest collection rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Areas Covered</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Set(collectorsSource.map(c => c.area)).size}
                  </div>
                  <p className="text-xs text-muted-foreground">Geographic coverage</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, phone, email, area, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Collectors ({filteredCollectors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {collectorsLoading && (
                  <div className="mb-4 text-sm text-slate-500">Loading collectors...</div>
                )}
                {collectorsError && (
                  <div className="mb-4 text-sm text-rose-600">{collectorsError}</div>
                )}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Collector</TableHead>
                        <TableHead>Contact Info</TableHead>
                        <TableHead>Assigned Area</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Customers</TableHead>
                        <TableHead>Total Collected</TableHead>
                        <TableHead>Collection Rate</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCollectors.map((collector) => {
                        const stats = getCollectorStats(collector);
                        return (
                          <TableRow key={collector.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{collector.name}</div>
                                <button
                                  type="button"
                                  className="text-sm text-blue-600 hover:underline"
                                  onClick={() => openViewDialog(collector)}
                                >
                                  ID:{' '}
                                  {(collector as Collector & { collectorCode?: string }).collectorCode ||
                                    collector.id}
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center text-sm">
                                  <Phone className="h-3 w-3 mr-1" />
                                  {collector.phone}
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {collector.email}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                                {collector.area}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const statusValue = (collector.status ?? 'enable') as 'enable' | 'disable' | 'takeoff';
                                const statusClass =
                                  statusValue === 'enable'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : statusValue === 'disable'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200';
                                return (
                                  <Select
                                    value={statusValue}
                                    onValueChange={(value) =>
                                      handleCollectorStatusChange(
                                        collector,
                                        value as 'enable' | 'disable' | 'takeoff'
                                      )
                                    }
                                    disabled={isUpdatingCollectorStatus[collector.id]}
                                  >
                                    <SelectTrigger className={`h-8 w-32 ${statusClass}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {collectorStatusOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Users className="h-3 w-3 text-gray-400" />
                                <span>{stats.assignedCustomers}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="mt-2 h-7 px-2 text-xs"
                                onClick={() => openAssignDialog(collector)}
                                disabled={customersLoading}
                              >
                                Assign
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="mt-1 h-7 px-2 text-xs"
                                onClick={() => openViewDialog(collector)}
                                disabled={customersLoading}
                              >
                                View
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">${stats.totalCollected.toFixed(2)}</div>
                              <div className="text-sm text-gray-500">{stats.totalBills} bills</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="text-sm font-medium">
                                  {stats.collectionRate.toFixed(1)}%
                                </div>
                                <Badge
                                  variant={
                                    stats.collectionRate >= 80 ? 'default' :
                                    stats.collectionRate >= 60 ? 'secondary' :
                                    'destructive'
                                  }
                                >
                                  {stats.collectionRate >= 80 ? 'Excellent' :
                                   stats.collectionRate >= 60 ? 'Good' :
                                   'Needs Improvement'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditCollector(collector)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-4 md:hidden">
                  {filteredCollectors.map((collector) => {
                    const stats = getCollectorStats(collector);
                    const statusValue = (collector.status ?? 'enable') as 'enable' | 'disable' | 'takeoff';
                    const statusClass =
                      statusValue === 'enable'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : statusValue === 'disable'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200';
                    return (
                      <Card key={collector.id}>
                        <CardContent className="space-y-3 pt-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <button
                                type="button"
                                className="text-sm text-blue-600 hover:underline"
                                onClick={() => openViewDialog(collector)}
                              >
                                {(collector as Collector & { collectorCode?: string }).collectorCode ||
                                  collector.id}
                              </button>
                              <p className="text-base font-semibold text-slate-900">{collector.name}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleEditCollector(collector)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="space-y-2 text-sm text-slate-700">
                            <div className="flex items-center">
                              <Phone className="mr-2 h-4 w-4 text-slate-400" />
                              {collector.phone}
                            </div>
                            <div className="flex items-center">
                              <Mail className="mr-2 h-4 w-4 text-slate-400" />
                              {collector.email}
                            </div>
                            <div className="flex items-start">
                              <MapPin className="mr-2 mt-0.5 h-4 w-4 text-slate-400" />
                              <span>{collector.area}</span>
                            </div>
                          </div>

                          <div className="grid gap-3">
                            <div>
                              <Label className="text-xs text-slate-500">Status</Label>
                              <Select
                                value={statusValue}
                                onValueChange={(value) =>
                                  handleCollectorStatusChange(
                                    collector,
                                    value as 'enable' | 'disable' | 'takeoff'
                                  )
                                }
                                disabled={isUpdatingCollectorStatus[collector.id]}
                              >
                                <SelectTrigger className={`h-9 w-full ${statusClass}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {collectorStatusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                              <span className="rounded-full bg-slate-100 px-3 py-1">
                                Customers: {stats.assignedCustomers}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1">
                                {stats.collectionRate.toFixed(1)}%
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-3 text-xs"
                                onClick={() => openAssignDialog(collector)}
                                disabled={customersLoading}
                              >
                                Assign
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-3 text-xs"
                                onClick={() => openViewDialog(collector)}
                                disabled={customersLoading}
                              >
                                View
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Dialog
              open={assignDialogOpen}
              onOpenChange={(open) => {
                setAssignDialogOpen(open);
                if (!open) {
                  setAssigningCollector(null);
                  setAssignCustomerIds([]);
                  setAssignError('');
                }
              }}
            >
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>
                    Assign Customers{assigningCollector ? ` • ${assigningCollector.name}` : ''}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    value={assignQuery}
                    onChange={(e) => setAssignQuery(e.target.value)}
                    placeholder="Search customers..."
                  />
                  {assignError && (
                    <p className="text-xs text-rose-600">{assignError}</p>
                  )}
                  {customersLoading ? (
                    <p className="text-xs text-slate-500">Loading customers...</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                      {filteredAssignCustomers.map((customer) => {
                        const checked = assignCustomerIds.includes(customer.id);
                        return (
                          <label
                            key={customer.id}
                            className="flex items-center justify-between gap-3 py-2 text-sm text-slate-700"
                          >
                            <span>{customer.name}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setAssignCustomerIds((prev) => [...prev, customer.id]);
                                } else {
                                  setAssignCustomerIds((prev) =>
                                    prev.filter((id) => id !== customer.id)
                                  );
                                }
                              }}
                            />
                          </label>
                        );
                      })}
                      {filteredAssignCustomers.length === 0 && (
                        <p className="text-xs text-slate-500">
                          {availableCustomers.length === 0
                            ? 'No customers available.'
                            : 'No customers match your search.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAssignDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveAssignments} disabled={isSavingAssignments}>
                    {isSavingAssignments ? 'Saving...' : 'Save Assignments'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={viewDialogOpen}
              onOpenChange={(open) => {
                setViewDialogOpen(open);
                if (!open) {
                  setViewCollector(null);
                }
              }}
            >
              <DialogContent className="inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-4 sm:rounded-none sm:p-6">
                <div className="mx-auto w-full max-w-5xl space-y-4">
                  <DialogHeader>
                    <DialogTitle>
                      Collector Details{viewCollector ? ` • ${viewCollector.name}` : ''}
                    </DialogTitle>
                  </DialogHeader>
                  {viewCollector && (
                    <div className="space-y-4">
                    <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-500">Collector Code</p>
                        <p className="font-semibold text-slate-900">
                          {(viewCollector as Collector & { collectorCode?: string }).collectorCode ||
                            viewCollector.id}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Status</p>
                        <p className="font-semibold text-slate-900 capitalize">{viewCollector.status || 'enable'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Area</p>
                        <p className="font-semibold text-slate-900">{viewCollector.area || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Assigned Customers</p>
                        <p className="font-semibold text-slate-900">{viewAssignedCustomers.length}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 p-4">
                        <p className="mb-3 text-sm font-semibold text-slate-900">Contact</p>
                        <div className="space-y-2 text-sm text-slate-700">
                          <p><span className="text-slate-500">Name:</span> {viewCollector.name || '—'}</p>
                          <p><span className="text-slate-500">Phone:</span> {viewCollector.phone || '—'}</p>
                          <p><span className="text-slate-500">Email:</span> {viewCollector.email || '—'}</p>
                          <p><span className="text-slate-500">NRC:</span> {viewCollector.nrc || '—'}</p>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-4">
                        <p className="mb-3 text-sm font-semibold text-slate-900">Address</p>
                        <div className="space-y-2 text-sm text-slate-700">
                          <p><span className="text-slate-500">Full:</span> {viewCollector.address || '—'}</p>
                          <p><span className="text-slate-500">Region:</span> {viewCollector.addressDetails?.region || '—'}</p>
                          <p><span className="text-slate-500">District:</span> {viewCollector.addressDetails?.district || '—'}</p>
                          <p><span className="text-slate-500">Township:</span> {viewCollector.addressDetails?.township || '—'}</p>
                          <p><span className="text-slate-500">City:</span> {viewCollector.addressDetails?.city || '—'}</p>
                          <p><span className="text-slate-500">Ward:</span> {viewCollector.addressDetails?.ward || '—'}</p>
                          <p><span className="text-slate-500">Street:</span> {viewCollector.addressDetails?.street || '—'}</p>
                          <p><span className="text-slate-500">Building:</span> {viewCollector.addressDetails?.building || '—'}</p>
                          <p><span className="text-slate-500">Postal Code:</span> {viewCollector.addressDetails?.postalCode || '—'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="mb-3 text-sm font-semibold text-slate-900">Assigned Customers</p>
                      <div className="max-h-52 overflow-y-auto rounded-md border border-slate-100 bg-slate-50 p-3">
                        {customersLoading ? (
                          <p className="text-xs text-slate-500">Loading customers...</p>
                        ) : viewAssignedCustomers.length === 0 ? (
                          <p className="text-xs text-slate-500">No customers assigned.</p>
                        ) : (
                          viewAssignedCustomers.map((customer) => (
                            <div
                              key={customer.id}
                              className="flex items-center justify-between py-2 text-sm text-slate-700"
                            >
                              <span>{customer.name}</span>
                              {customer.collectorId && (
                                <span className="text-xs text-slate-400">{customer.collectorId}</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setViewDialogOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {collectors.map((collector) => {
                    const stats = getCollectorStats(collector);
                    return (
                      <div key={collector.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{collector.name}</h3>
                          <Badge
                            variant={
                              stats.collectionRate >= 80 ? 'default' :
                              stats.collectionRate >= 60 ? 'secondary' :
                              'destructive'
                            }
                          >
                            {stats.collectionRate.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Area:</span>
                            <span>{collector.area}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Customers:</span>
                            <span>{stats.assignedCustomers}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Collected:</span>
                            <span className="font-medium">${stats.totalCollected.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
