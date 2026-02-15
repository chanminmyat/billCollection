'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Edit, Trash2, Phone, MapPin } from 'lucide-react';
import { useData, Customer } from '../../contexts/data-context';
import { useAuth } from '../../contexts/auth-context';
import Layout from '../../components/layout';
import { useRouter } from 'next/navigation';
import nrcData from '@/lib/nrc-data.json';
import townshipData from '@/lib/township.json';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type SelectOption = { value: string; label: string };
type PlanOption = {
  id: string;
  planCode: string;
  planName: string;
  bandwidthPlan?: string | null;
  monthlyFee?: number | string;
  currency?: string;
  isActive?: boolean;
};

function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  disabled = false
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  id: string;
  disabled?: boolean;
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
      disabled={disabled}
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
      <SelectContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="p-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-8"
            autoFocus
            disabled={disabled}
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

type CustomersPageProps = {
  openNew?: boolean;
  inlineForm?: boolean;
  listPath?: string;
};

export default function CustomersPage({
  openNew = false,
  inlineForm = false,
  listPath = '/admin/customers/customer-list'
}: CustomersPageProps) {
  const { customers, collectors, addCustomer, updateCustomer, deleteCustomer } = useData();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [remoteCustomers, setRemoteCustomers] = useState<Customer[]>([]);
  const [hasFetchedCustomers, setHasFetchedCustomers] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState('');
  const [remoteCollectors, setRemoteCollectors] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [hasFetchedCollectors, setHasFetchedCollectors] = useState(false);
  const [collectorsLoading, setCollectorsLoading] = useState(false);
  const [collectorsError, setCollectorsError] = useState('');
  const [customerTypeById, setCustomerTypeById] = useState<Record<string, 'individual' | 'business'>>({});
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'individual' | 'business'>('all');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<Record<string, boolean>>({});
  const [isAssigningCollector, setIsAssigningCollector] = useState<Record<string, boolean>>({});
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [customerType, setCustomerType] = useState<'individual' | 'business'>('individual');
  const [userStatus, setUserStatus] = useState<'enable' | 'disable' | 'takeoff'>('enable');
  const [nrcState, setNrcState] = useState('');
  const [nrcTownship, setNrcTownship] = useState('');
  const [nrcType, setNrcType] = useState('');
  const [nrcNumber, setNrcNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessRegNo, setBusinessRegNo] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNrcState, setContactNrcState] = useState('');
  const [contactNrcTownship, setContactNrcTownship] = useState('');
  const [contactNrcType, setContactNrcType] = useState('');
  const [contactNrcNumber, setContactNrcNumber] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [installationRegion, setInstallationRegion] = useState('');
  const [installationDistrict, setInstallationDistrict] = useState('');
  const [installationTownship, setInstallationTownship] = useState('');
  const [installationCity, setInstallationCity] = useState('');
  const [installationWard, setInstallationWard] = useState('');
  const [installationPostalCode, setInstallationPostalCode] = useState('');
  const [installationStreet, setInstallationStreet] = useState('');
  const [installationBuilding, setInstallationBuilding] = useState('');
  const [installationMapLink, setInstallationMapLink] = useState('');
  const [billingSameAsInstallation, setBillingSameAsInstallation] = useState<'yes' | 'no'>('yes');
  const [billingRegion, setBillingRegion] = useState('');
  const [billingDistrict, setBillingDistrict] = useState('');
  const [billingTownship, setBillingTownship] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingWard, setBillingWard] = useState('');
  const [billingPostalCode, setBillingPostalCode] = useState('');
  const [billingStreet, setBillingStreet] = useState('');
  const [billingBuilding, setBillingBuilding] = useState('');
  const [billingMapLink, setBillingMapLink] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [packageName, setPackageName] = useState('');
  const [bandwidthPlan, setBandwidthPlan] = useState('');
  const [serviceStartDate, setServiceStartDate] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [ipType, setIpType] = useState('');
  const [staticIpAddress, setStaticIpAddress] = useState('');
  const [routerId, setRouterId] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [onuSerial, setOnuSerial] = useState('');
  const [vlanPort, setVlanPort] = useState('');
  const [networkZone, setNetworkZone] = useState('');
  const [billingCycle, setBillingCycle] = useState('');
  const [customBillingMonths, setCustomBillingMonths] = useState('');
  const [billingDay, setBillingDay] = useState('');
  const [installationFee, setInstallationFee] = useState('');
  const [additionalFees, setAdditionalFees] = useState('');
  const [discountApplied, setDiscountApplied] = useState<'yes' | 'no'>('no');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPeriod, setDiscountPeriod] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newCustomer, setNewCustomer] = useState<{
    name: string;
    phone: string;
    address: string;
    package: string;
    monthlyFee: number;
    status: 'active' | 'inactive';
    collectorId: string;
    joinDate: string;
  }>({
    name: '',
    phone: '',
    address: '',
    package: '',
    monthlyFee: 0,
    status: 'active',
    collectorId: '',
    joinDate: new Date().toISOString().split('T')[0]
  });

  const townshipOptions = useMemo(() => {
    return nrcData.nrcTownships
      .filter((township) => township.stateCode === nrcState)
      .slice()
      .sort((a, b) => a.name.en.localeCompare(b.name.en));
  }, [nrcState]);
  const contactTownshipOptions = useMemo(() => {
    return nrcData.nrcTownships
      .filter((township) => township.stateCode === contactNrcState)
      .slice()
      .sort((a, b) => a.name.en.localeCompare(b.name.en));
  }, [contactNrcState]);
  const typeOptions = nrcData.nrcTypes;
  const stateOptions = nrcData.nrcStates;
  const regionOptions = useMemo(() => Object.keys(townshipData).sort(), []);
  const installationDistrictOptions = useMemo(() => {
    if (!installationRegion) return [];
    return Object.keys(townshipData[installationRegion as keyof typeof townshipData]).sort();
  }, [installationRegion]);
  const installationTownshipOptions = useMemo(() => {
    if (!installationRegion || !installationDistrict) return [];
    const districts =
      townshipData[installationRegion as keyof typeof townshipData] as Record<string, string[]>;
    const list = districts?.[installationDistrict] ?? [];
    return [...list].sort();
  }, [installationRegion, installationDistrict]);
  const billingDistrictOptions = useMemo(() => {
    if (!billingRegion) return [];
    return Object.keys(townshipData[billingRegion as keyof typeof townshipData]).sort();
  }, [billingRegion]);
  const billingTownshipOptions = useMemo(() => {
    if (!billingRegion || !billingDistrict) return [];
    const districts =
      townshipData[billingRegion as keyof typeof townshipData] as Record<string, string[]>;
    const list = districts?.[billingDistrict] ?? [];
    return [...list].sort();
  }, [billingRegion, billingDistrict]);
  const activePlans = useMemo(
    () => plans.filter((plan) => plan.isActive !== false),
    [plans]
  );
  const serviceTypeOptions = ['Fiber', 'DSL', 'Wireless'];
  const ipTypeOptions = ['Static', 'Dynamic'];
  const billingCycleOptions = ['Monthly', 'Quarterly', 'Bi-yearly', 'Yearly', 'Custom'];
  const userStatusOptions = [
    { value: 'enable', label: 'Enable' },
    { value: 'disable', label: 'Disable' },
    { value: 'takeoff', label: 'Take off' }
  ];

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
  const contactNrcTownshipSelectOptions = useMemo<SelectOption[]>(
    () =>
      contactTownshipOptions.map((option) => ({
        value: option.short.en,
        label: `${option.short.en} - ${option.name.en}`
      })),
    [contactTownshipOptions]
  );
  const regionSelectOptions = useMemo<SelectOption[]>(
    () => regionOptions.map((region) => ({ value: region, label: region })),
    [regionOptions]
  );
  const installationDistrictSelectOptions = useMemo<SelectOption[]>(
    () => installationDistrictOptions.map((district) => ({ value: district, label: district })),
    [installationDistrictOptions]
  );
  const installationTownshipSelectOptions = useMemo<SelectOption[]>(
    () => installationTownshipOptions.map((township) => ({ value: township, label: township })),
    [installationTownshipOptions]
  );
  const billingDistrictSelectOptions = useMemo<SelectOption[]>(
    () => billingDistrictOptions.map((district) => ({ value: district, label: district })),
    [billingDistrictOptions]
  );
  const billingTownshipSelectOptions = useMemo<SelectOption[]>(
    () => billingTownshipOptions.map((township) => ({ value: township, label: township })),
    [billingTownshipOptions]
  );
  const serviceTypeSelectOptions = useMemo<SelectOption[]>(
    () => serviceTypeOptions.map((option) => ({ value: option, label: option })),
    [serviceTypeOptions]
  );
  const serviceIdSelectOptions = useMemo<SelectOption[]>(
    () =>
      activePlans.map((plan) => ({
        value: plan.planCode,
        label: `${plan.planCode} • ${plan.planName}`
      })),
    [activePlans]
  );
  const packagePlanSelectOptions = useMemo<SelectOption[]>(
    () =>
      activePlans.map((plan) => ({
        value: plan.planCode,
        label: `${plan.planName} (${plan.planCode})`
      })),
    [activePlans]
  );
  const bandwidthSelectOptions = useMemo<SelectOption[]>(
    () => {
      const list = activePlans
        .map((plan) => plan.bandwidthPlan)
        .filter((value): value is string => Boolean(value));
      const unique = Array.from(new Set(list));
      return unique.map((option) => ({ value: option, label: option }));
    },
    [activePlans]
  );
  const ipTypeSelectOptions = useMemo<SelectOption[]>(
    () => ipTypeOptions.map((option) => ({ value: option, label: option })),
    [ipTypeOptions]
  );
  const billingCycleSelectOptions = useMemo<SelectOption[]>(
    () => billingCycleOptions.map((option) => ({ value: option, label: option })),
    [billingCycleOptions]
  );
  const userStatusSelectOptions = useMemo<SelectOption[]>(
    () => userStatusOptions,
    []
  );
  const collectorSelectOptions = useMemo<SelectOption[]>(
    () =>
      remoteCollectors.map((collector) => ({
        value: collector.code || collector.id,
        label: collector.code ? `${collector.name} (${collector.code})` : collector.name
      })),
    [remoteCollectors]
  );
  const collectorSelectOptionsWithUnassigned = useMemo<SelectOption[]>(
    () => [{ value: 'unassigned', label: 'Unassigned' }, ...collectorSelectOptions],
    [collectorSelectOptions]
  );
  const selectedPlan = useMemo(
    () => activePlans.find((plan) => plan.planCode === selectedPlanCode),
    [activePlans, selectedPlanCode]
  );

  const monthlyFee =
    selectedPlan?.monthlyFee !== undefined && selectedPlan?.monthlyFee !== null
      ? String(selectedPlan.monthlyFee)
      : '';

  useEffect(() => {
    if (billingCycle !== 'Custom') {
      setCustomBillingMonths('');
    }
  }, [billingCycle]);

  useEffect(() => {
    const baseDate = serviceStartDate || installationDate;
    if (!baseDate || !billingCycle) {
      setBillingDay('');
      return;
    }
    const date = new Date(baseDate);
    if (Number.isNaN(date.getTime())) {
      setBillingDay('');
      return;
    }
    const day = date.getDate().toString().padStart(2, '0');
    setBillingDay(day);
  }, [billingCycle, installationDate, serviceStartDate]);

  const formatAddress = (address: {
    building: string;
    street: string;
    ward: string;
    city: string;
    township: string;
    district: string;
    region: string;
    postalCode?: string;
  }) => {
    const base = [
      address.building,
      address.street,
      address.ward,
      address.city,
      address.township,
      address.district,
      address.region
    ]
      .filter((value) => value.trim())
      .join(', ');
    if (!address.postalCode?.trim()) {
      return base;
    }
    return base ? `${base}, ${address.postalCode}` : address.postalCode;
  };

  const normalizeStatus = (status: 'enable' | 'disable' | 'takeoff') =>
    status === 'enable' ? 'active' : 'inactive';

  const toSelectStatus = (status: 'active' | 'inactive' | 'enable' | 'disable' | 'takeoff') => {
    if (status === 'enable') return 'enable';
    if (status === 'takeoff') return 'takeoff';
    return status === 'active' ? 'enable' : 'disable';
  };

  const updateRemoteCustomerStatus = (id: string, status: 'enable' | 'disable' | 'takeoff') => {
    setRemoteCustomers((prev) =>
      prev.map((customer) =>
        customer.id === id ? { ...customer, status: normalizeStatus(status) } : customer
      )
    );
  };

  const updateRemoteCustomerCollector = (id: string, collectorId: string) => {
    setRemoteCustomers((prev) =>
      prev.map((customer) =>
        customer.id === id ? { ...customer, collectorId } : customer
      )
    );
  };

  const customersSource = hasFetchedCustomers ? remoteCustomers : [];

  const filteredCustomers = customersSource.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.phone.includes(searchTerm) ||
                         customer.id.includes(searchTerm);
    const matchesStatus = selectedStatus === 'all' || customer.status === selectedStatus;
    const typeValue = customerTypeById[customer.id];
    const matchesType =
      customerTypeFilter === 'all' ? true : typeValue === customerTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleStatusChange = async (id: string, status: 'enable' | 'disable' | 'takeoff') => {
    if (isUpdatingStatus[id]) return;
    setIsUpdatingStatus((prev) => ({ ...prev, [id]: true }));
    updateRemoteCustomerStatus(id, status);

    try {
      const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
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
      }
    } catch (error) {
      console.error('Failed to update status', error);
    } finally {
      setIsUpdatingStatus((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleAssignCollector = async (customerId: string, collectorCode: string) => {
    if (isAssigningCollector[customerId]) return;
    setIsAssigningCollector((prev) => ({ ...prev, [customerId]: true }));
    const normalizedCollectorCode = collectorCode === 'unassigned' ? '' : collectorCode;
    updateRemoteCustomerCollector(customerId, normalizedCollectorCode);

    try {
      const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ collectorCode: normalizedCollectorCode || null })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? 'Failed to assign collector';
        console.error(message, data);
      }
    } catch (error) {
      console.error('Failed to assign collector', error);
    } finally {
      setIsAssigningCollector((prev) => ({ ...prev, [customerId]: false }));
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchCustomers = async () => {
      setHasFetchedCustomers(false);
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

        const data = await response.json().catch(() => ({}));
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.customers)
          ? data.customers
          : Array.isArray(data?.data)
          ? data.data
          : [];

        const typesMap: Record<string, 'individual' | 'business'> = {};
        const normalized = list.map((item: any, index: number) => {
          const rawType = String(item?.customerType ?? '').toLowerCase();
          const customerTypeValue: 'individual' | 'business' =
            rawType === 'business' ? 'business' : 'individual';
          const name =
            item?.personalName ||
            item?.companyName ||
            item?.name ||
            'Unknown';
          const phone =
            item?.primaryPhone ||
            item?.contactInformation?.primaryPhone ||
            item?.phone ||
            '';
          const address =
            item?.installationAddress ||
            item?.addressInformation?.installation ||
            item?.address ||
            '';
          const packageNameValue =
            item?.subscription?.plan?.planCode ||
            item?.services?.packageName ||
            item?.package ||
            item?.services?.serviceId ||
            '';
          const monthlyFeeValue =
            item?.subscription?.plan?.monthlyFee ??
            item?.billingInformation?.monthlySubscriptionFee ??
            item?.monthlyFee ??
            0;
          const statusValue =
            item?.status
              ? normalizeStatus(item.status)
              : item?.userStatus
              ? normalizeStatus(item.userStatus)
              : item?.status === 'inactive'
              ? 'inactive'
              : 'active';

          const id = String(item?.id ?? item?._id ?? index + 1);
          const collectorIdRaw =
            item?.collectorCode ?? item?.collectorId ?? item?.collector?.id ?? '';
          const collectorId = collectorIdRaw ? String(collectorIdRaw) : '';
          typesMap[id] = customerTypeValue;

          return {
            id,
            code: String(item?.customerCode ?? ''),
            name,
            phone,
            address,
            package: packageNameValue,
            monthlyFee: Number(monthlyFeeValue) || 0,
            status: statusValue,
            collectorId,
            joinDate: item?.createdAt ?? new Date().toISOString().split('T')[0]
          } as Customer & { code?: string };
        });

        if (isMounted) {
          setRemoteCustomers(normalized);
          setCustomerTypeById(typesMap);
          setHasFetchedCustomers(true);
        }
      } catch (error) {
        if (isMounted) {
          setCustomersError(error instanceof Error ? error.message : 'Failed to load customers');
          setRemoteCustomers([]);
          setCustomerTypeById({});
          setHasFetchedCustomers(true);
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
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchPlans = async () => {
      setPlansLoading(true);
      setPlansError('');
      try {
        const response = await fetch(`${API_BASE_URL}/plans`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.message ?? 'Failed to load plans';
          throw new Error(message);
        }

        const data = await response.json().catch(() => ([]));
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.plans)
          ? data.plans
          : [];

        const normalized = list.map((item: any, index: number) => ({
          id: String(item?.id ?? index + 1),
          planCode: String(item?.planCode ?? ''),
          planName: String(item?.planName ?? ''),
          bandwidthPlan: item?.bandwidthPlan ?? null,
          monthlyFee: item?.monthlyFee ?? 0,
          currency: item?.currency ?? 'MMK',
          isActive: item?.isActive ?? true
        })) as PlanOption[];

        if (isMounted) {
          setPlans(normalized);
        }
      } catch (error) {
        if (isMounted) {
          setPlansError(error instanceof Error ? error.message : 'Failed to load plans');
          setPlans([]);
        }
      } finally {
        if (isMounted) {
          setPlansLoading(false);
        }
      }
    };

    fetchPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
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
        const list = Array.isArray(data) ? data : Array.isArray(data?.collectors) ? data.collectors : [];
        const normalized = list.map((item: any, index: number) => ({
          id: String(item?.id ?? index + 1),
          name: item?.user?.name ?? 'Unknown',
          code: item?.collectorCode ?? item?.user?.username ?? ''
        }));

        if (isMounted) {
          setRemoteCollectors(normalized);
          setHasFetchedCollectors(true);
        }
      } catch (error) {
        if (isMounted) {
          setCollectorsError(error instanceof Error ? error.message : 'Failed to load collectors');
          setRemoteCollectors([]);
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
  }, []);

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  const handleAddCustomer = async () => {
    const nextErrors: Record<string, string> = {};
    if (!customerType) {
      nextErrors.customerType = 'Select customer type.';
    }
    if (!userStatus) {
      nextErrors.userStatus = 'Select status.';
    }
    if (customerType === 'individual') {
      if (!newCustomer.name.trim()) {
        nextErrors.individualName = 'Customer name is required.';
      }
      if (!nrcState) {
        nextErrors.nrcState = 'Select NRC state.';
      }
      if (!nrcTownship) {
        nextErrors.nrcTownship = 'Select NRC township.';
      }
      if (!nrcType) {
        nextErrors.nrcType = 'Select NRC type.';
      }
      if (nrcNumber.trim().length !== 6) {
        nextErrors.nrcNumber = 'Enter 6-digit NRC number.';
      }
    }
    if (customerType === 'business') {
      if (!companyName.trim()) {
        nextErrors.companyName = 'Company name is required.';
      }
      if (!businessRegNo.trim()) {
        nextErrors.businessRegNo = 'Registration number is required.';
      }
      if (!taxId.trim()) {
        nextErrors.taxId = 'Tax ID is required.';
      }
      if (!contactPerson.trim()) {
        nextErrors.contactPerson = 'Contact person is required.';
      }
      if (!contactNrcState) {
        nextErrors.contactNrcState = 'Select NRC state.';
      }
      if (!contactNrcTownship) {
        nextErrors.contactNrcTownship = 'Select NRC township.';
      }
      if (!contactNrcType) {
        nextErrors.contactNrcType = 'Select NRC type.';
      }
      if (contactNrcNumber.trim().length !== 6) {
        nextErrors.contactNrcNumber = 'Enter 6-digit NRC number.';
      }
    }
    if (primaryPhone.trim().length < 6 || primaryPhone.trim().length > 11) {
      nextErrors.primaryPhone = 'Enter 6-11 digits.';
    }
    if (!installationRegion) {
      nextErrors.installationRegion = 'Select region.';
    }
    if (!installationDistrict) {
      nextErrors.installationDistrict = 'Select district.';
    }
    if (!installationTownship) {
      nextErrors.installationTownship = 'Select township.';
    }
    if (!installationWard.trim()) {
      nextErrors.installationWard = 'Ward is required.';
    }
    if (billingSameAsInstallation === 'no') {
      if (!billingRegion) {
        nextErrors.billingRegion = 'Select region.';
      }
      if (!billingDistrict) {
        nextErrors.billingDistrict = 'Select district.';
      }
      if (!billingTownship) {
        nextErrors.billingTownship = 'Select township.';
      }
      if (!billingWard.trim()) {
        nextErrors.billingWard = 'Ward is required.';
      }
    }
    if (!packageName) {
      nextErrors.packageName = 'Select package plan.';
    }
    if (!bandwidthPlan) {
      nextErrors.bandwidthPlan = 'Select bandwidth.';
    }
    if (!selectedPlanCode) {
      nextErrors.packageName = 'Select package plan.';
    }
    if (!serviceStartDate) {
      nextErrors.serviceStartDate = 'Select service start date.';
    }
    if (!contractStartDate) {
      nextErrors.contractStartDate = 'Select contract start date.';
    }
    if (!contractEndDate) {
      nextErrors.contractEndDate = 'Select contract end date.';
    }
    if (!installationDate) {
      nextErrors.installationDate = 'Select installation date.';
    }
    if (!billingCycle) {
      nextErrors.billingCycle = 'Select billing cycle.';
    }
    if (billingCycle === 'Custom' && !customBillingMonths) {
      nextErrors.customBillingMonths = 'Enter custom cycle.';
    }
    if (!billingDay) {
      nextErrors.billingDay = 'Billing day is required.';
    }
    if (!installationFee.trim()) {
      nextErrors.installationFee = 'Installation fee is required.';
    }
    if (discountApplied === 'yes') {
      if (!discountAmount.trim()) {
        nextErrors.discountAmount = 'Enter discount amount.';
      }
      if (!discountPeriod.trim()) {
        nextErrors.discountPeriod = 'Enter discount period.';
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (isAddingCustomer) return;
    setIsAddingCustomer(true);

    const formatNrc = (state: string, township: string, type: string, number: string) => {
      if (!state || !township || !type || !number) return '';
      return `${state}/${township}(${type})${number}`;
    };

    const toNumber = (value: string | number) => {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const payload = {
      customer: {
        customerType,
        userStatus,
        personalInformation:
          customerType === 'individual'
            ? {
                name: newCustomer.name,
                nrc: formatNrc(nrcState, nrcTownship, nrcType, nrcNumber)
              }
            : null,
        businessInformation:
          customerType === 'business'
            ? {
                companyName,
                businessRegistrationNumber: businessRegNo,
                taxIdentificationNumber: taxId,
                authorizedContactPerson: contactPerson,
                contactNrc: formatNrc(
                  contactNrcState,
                  contactNrcTownship,
                  contactNrcType,
                  contactNrcNumber
                )
              }
            : null,
        contactInformation: {
          primaryPhone,
          secondaryPhone,
          email: contactEmail
        },
        addressInformation: {
          installation: formatAddress({
            building: installationBuilding,
            street: installationStreet,
            ward: installationWard,
            city: installationCity,
            township: installationTownship,
            district: installationDistrict,
            region: installationRegion,
            postalCode: installationPostalCode
          }),
          installationMapLink: installationMapLink.trim(),
          billing:
            billingSameAsInstallation === 'yes'
              ? 'Same as installation'
              : formatAddress({
                  building: billingBuilding,
                  street: billingStreet,
                  ward: billingWard,
                  city: billingCity,
                  township: billingTownship,
                  district: billingDistrict,
                  region: billingRegion,
                  postalCode: billingPostalCode
                }),
          billingMapLink:
            billingSameAsInstallation === 'yes'
              ? installationMapLink.trim()
              : billingMapLink.trim()
        },
        services: {
          serviceId,
          serviceType,
          packageName,
          bandwidthPlan,
          serviceStartDate,
          contractStartDate,
          contractEndDate,
          installationDate,
          ipType,
          staticIpAddress
        },
        networkTechnical: {
          routerId,
          macAddress,
          onuSerial,
          vlanPort,
          networkZone
        },
        billingInformation: {
          billingCycle,
          customBillingMonths,
          billingDay: toNumber(billingDay),
          currency: 'MMK',
          monthlySubscriptionFee: toNumber(monthlyFee),
          installationFee: toNumber(installationFee),
          additionalFees: toNumber(additionalFees),
          discountApplied,
          discountAmount: discountApplied === 'yes' ? toNumber(discountAmount) : 0,
          discountPeriod: discountApplied === 'yes' ? discountPeriod : ''
        }
      }
    };

    console.log('Add customer payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await fetch(`${API_BASE_URL}/auth/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? 'Failed to create customer';
        console.error(message, data);
        setIsAddingCustomer(false);
        return;
      }
    } catch (error) {
      console.error('Failed to create customer', error);
      setIsAddingCustomer(false);
      return;
    }

    addCustomer({
      ...newCustomer,
      status: normalizeStatus(userStatus)
    });
    setCustomerType('individual');
    setUserStatus('enable');
    setNrcState('');
    setNrcTownship('');
    setNrcType('');
    setNrcNumber('');
    setCompanyName('');
    setBusinessRegNo('');
    setTaxId('');
    setContactPerson('');
    setContactNrcState('');
    setContactNrcTownship('');
    setContactNrcType('');
    setContactNrcNumber('');
    setPrimaryPhone('');
    setSecondaryPhone('');
    setContactEmail('');
    setInstallationRegion('');
    setInstallationDistrict('');
    setInstallationTownship('');
    setInstallationCity('');
    setInstallationWard('');
    setInstallationPostalCode('');
    setInstallationStreet('');
    setInstallationBuilding('');
    setInstallationMapLink('');
    setBillingSameAsInstallation('yes');
    setBillingRegion('');
    setBillingDistrict('');
    setBillingTownship('');
    setBillingCity('');
    setBillingWard('');
    setBillingPostalCode('');
    setBillingStreet('');
    setBillingBuilding('');
    setBillingMapLink('');
    setServiceId('');
    setServiceType('');
    setPackageName('');
    setSelectedPlanCode('');
    setBandwidthPlan('');
    setServiceStartDate('');
    setContractStartDate('');
    setContractEndDate('');
    setInstallationDate('');
    setIpType('');
    setStaticIpAddress('');
    setRouterId('');
    setMacAddress('');
    setOnuSerial('');
    setVlanPort('');
    setNetworkZone('');
    setBillingCycle('');
    setCustomBillingMonths('');
    setBillingDay('');
    setInstallationFee('');
    setAdditionalFees('');
    setDiscountApplied('no');
    setDiscountAmount('');
    setDiscountPeriod('');
    setErrors({});
    setNewCustomer({
      name: '',
      phone: '',
      address: '',
      package: '',
      monthlyFee: 0,
      status: 'active',
      collectorId: '',
      joinDate: new Date().toISOString().split('T')[0]
    });
    toast({
      title: 'Customer added',
      description: 'Redirecting to customer list...',
      duration: 3000
    });

    setTimeout(() => {
      router.replace(listPath);
    }, 3000);

    setIsAddingCustomer(false);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerType('individual');
    setUserStatus(customer.status === 'active' ? 'enable' : 'disable');
    setNrcState('');
    setNrcTownship('');
    setNrcType('');
    setNrcNumber('');
    setCompanyName('');
    setBusinessRegNo('');
    setTaxId('');
    setContactPerson('');
    setContactNrcState('');
    setContactNrcTownship('');
    setContactNrcType('');
    setContactNrcNumber('');
    setPrimaryPhone('');
    setSecondaryPhone('');
    setContactEmail('');
    setInstallationRegion('');
    setInstallationDistrict('');
    setInstallationTownship('');
    setInstallationCity('');
    setInstallationWard('');
    setInstallationPostalCode('');
    setInstallationStreet('');
    setInstallationBuilding('');
    setInstallationMapLink('');
    setBillingSameAsInstallation('yes');
    setBillingRegion('');
    setBillingDistrict('');
    setBillingTownship('');
    setBillingCity('');
    setBillingWard('');
    setBillingPostalCode('');
    setBillingStreet('');
    setBillingBuilding('');
    setBillingMapLink('');
    setServiceId('');
    setServiceType('');
    setPackageName('');
    setSelectedPlanCode('');
    setBandwidthPlan('');
    setServiceStartDate('');
    setContractStartDate('');
    setContractEndDate('');
    setInstallationDate('');
    setIpType('');
    setStaticIpAddress('');
    setRouterId('');
    setMacAddress('');
    setOnuSerial('');
    setVlanPort('');
    setNetworkZone('');
    setBillingCycle('');
    setCustomBillingMonths('');
    setBillingDay('');
    setInstallationFee('');
    setAdditionalFees('');
    setDiscountApplied('no');
    setDiscountAmount('');
    setDiscountPeriod('');
    const matchedPlan = activePlans.find((plan) => plan.planCode === customer.package);
    if (matchedPlan) {
      setSelectedPlanCode(matchedPlan.planCode);
      setServiceId(matchedPlan.planCode);
      setPackageName(matchedPlan.planName);
      setBandwidthPlan(matchedPlan.bandwidthPlan ?? '');
    }
    setNewCustomer({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      package: customer.package,
      monthlyFee: customer.monthlyFee,
      status: customer.status,
      collectorId: customer.collectorId,
      joinDate: customer.joinDate
    });
  };

  const handleUpdateCustomer = () => {
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        ...newCustomer,
        status: normalizeStatus(userStatus)
      });
      setEditingCustomer(null);
      setCustomerType('individual');
      setUserStatus('enable');
      setNrcState('');
      setNrcTownship('');
      setNrcType('');
      setNrcNumber('');
      setCompanyName('');
      setBusinessRegNo('');
      setTaxId('');
      setContactPerson('');
      setContactNrcState('');
      setContactNrcTownship('');
      setContactNrcType('');
      setContactNrcNumber('');
      setPrimaryPhone('');
      setSecondaryPhone('');
      setContactEmail('');
      setInstallationRegion('');
      setInstallationDistrict('');
      setInstallationTownship('');
      setInstallationCity('');
      setInstallationWard('');
      setInstallationPostalCode('');
      setInstallationStreet('');
      setInstallationBuilding('');
      setInstallationMapLink('');
      setBillingSameAsInstallation('yes');
      setBillingRegion('');
      setBillingDistrict('');
      setBillingTownship('');
      setBillingCity('');
      setBillingWard('');
      setBillingPostalCode('');
      setBillingStreet('');
      setBillingBuilding('');
      setBillingMapLink('');
      setServiceId('');
      setServiceType('');
      setPackageName('');
      setSelectedPlanCode('');
      setBandwidthPlan('');
      setServiceStartDate('');
      setContractStartDate('');
      setContractEndDate('');
      setInstallationDate('');
      setIpType('');
      setStaticIpAddress('');
      setRouterId('');
      setMacAddress('');
      setOnuSerial('');
      setVlanPort('');
      setNetworkZone('');
      setBillingCycle('');
      setCustomBillingMonths('');
      setBillingDay('');
      setInstallationFee('');
      setAdditionalFees('');
      setDiscountApplied('no');
      setDiscountAmount('');
      setDiscountPeriod('');
      setNewCustomer({
        name: '',
        phone: '',
        address: '',
        package: '',
        monthlyFee: 0,
        status: 'active',
        collectorId: '',
        joinDate: new Date().toISOString().split('T')[0]
      });
    }
  };

  const formContent = (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-sky-50 px-6 py-4">
        <h3 className="text-lg font-semibold text-slate-900">User Information</h3>
      </div>
      <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
        <div className="space-y-3">
          <Label className="text-sm font-medium text-slate-700">Customer Type</Label>
          <RadioGroup
            value={customerType}
            onValueChange={(value) => setCustomerType(value as 'individual' | 'business')}
            className="flex flex-wrap gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="customer-type-individual" value="individual" />
              <Label htmlFor="customer-type-individual">Individual</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="customer-type-business" value="business" />
              <Label htmlFor="customer-type-business">Business</Label>
            </div>
          </RadioGroup>
          {errors.customerType && (
            <p className="text-xs text-rose-600">{errors.customerType}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="userStatus" className="text-sm font-medium text-slate-700">
            User Status
          </Label>
          <SearchableSelect
            id="userStatus"
            value={userStatus}
            onValueChange={(value) => setUserStatus(value as 'enable' | 'disable' | 'takeoff')}
            options={userStatusSelectOptions}
            placeholder="Select status"
          />
          {errors.userStatus && (
            <p className="text-xs text-rose-600">{errors.userStatus}</p>
          )}
        </div>

      </div>

      {customerType === 'individual' && (
        <div className="border-t border-slate-200 px-6 py-6">
          <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-sky-400 pl-3">
            Personal Information
          </h4>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="individual-name" className="text-sm font-medium text-slate-700">
                Customer Name
              </Label>
              <Input
                id="individual-name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Aung Aung"
              />
              {errors.individualName && (
                <p className="text-xs text-rose-600">{errors.individualName}</p>
              )}
            </div>
            <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-100 p-4">
              <div className="text-sm font-medium text-slate-700">NRC</div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <SearchableSelect
                    id="nrcState"
                    value={nrcState}
                    onValueChange={(value) => {
                      setNrcState(value);
                      setNrcTownship('');
                    }}
                    options={nrcStateOptions}
                    placeholder="State"
                  />
                  {errors.nrcState && (
                    <p className="text-xs text-rose-600">{errors.nrcState}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <SearchableSelect
                    id="nrcTownship"
                    value={nrcTownship}
                    onValueChange={setNrcTownship}
                    options={nrcTownshipOptions}
                    placeholder="Township"
                  />
                  {errors.nrcTownship && (
                    <p className="text-xs text-rose-600">{errors.nrcTownship}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <SearchableSelect
                    id="nrcType"
                    value={nrcType}
                    onValueChange={setNrcType}
                    options={nrcTypeOptions}
                    placeholder="Type"
                  />
                  {errors.nrcType && (
                    <p className="text-xs text-rose-600">{errors.nrcType}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Input
                    id="nrcNumber"
                    value={nrcNumber}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setNrcNumber(digitsOnly);
                    }}
                    placeholder="123456"
                    inputMode="numeric"
                  />
                  {errors.nrcNumber && (
                    <p className="text-xs text-rose-600">{errors.nrcNumber}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {customerType === 'business' && (
        <div className="border-t border-slate-200 px-6 py-6">
          <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-emerald-400 pl-3">
            Business Information
          </h4>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companyName" className="text-sm font-medium text-slate-700">
                Company Name
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name"
              />
              {errors.companyName && (
                <p className="text-xs text-rose-600">{errors.companyName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessRegNo" className="text-sm font-medium text-slate-700">
                Business Registration Number
              </Label>
              <Input
                id="businessRegNo"
                value={businessRegNo}
                onChange={(e) => setBusinessRegNo(e.target.value)}
                placeholder="Registration number"
              />
              {errors.businessRegNo && (
                <p className="text-xs text-rose-600">{errors.businessRegNo}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId" className="text-sm font-medium text-slate-700">
                Tax Identification Number (VAT/GST)
              </Label>
              <Input
                id="taxId"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="VAT/GST number"
              />
              {errors.taxId && (
                <p className="text-xs text-rose-600">{errors.taxId}</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contactPerson" className="text-sm font-medium text-slate-700">
                Authorized Contact Person
              </Label>
              <Input
                id="contactPerson"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Contact person name"
              />
              {errors.contactPerson && (
                <p className="text-xs text-rose-600">{errors.contactPerson}</p>
              )}
            </div>
            <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-100 p-4">
              <div className="text-sm font-medium text-slate-700">Contact Person NRC</div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <SearchableSelect
                    id="contactNrcState"
                    value={contactNrcState}
                    onValueChange={(value) => {
                      setContactNrcState(value);
                      setContactNrcTownship('');
                    }}
                    options={nrcStateOptions}
                    placeholder="State"
                  />
                  {errors.contactNrcState && (
                    <p className="text-xs text-rose-600">{errors.contactNrcState}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <SearchableSelect
                    id="contactNrcTownship"
                    value={contactNrcTownship}
                    onValueChange={setContactNrcTownship}
                    options={contactNrcTownshipSelectOptions}
                    placeholder="Township"
                  />
                  {errors.contactNrcTownship && (
                    <p className="text-xs text-rose-600">{errors.contactNrcTownship}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <SearchableSelect
                    id="contactNrcType"
                    value={contactNrcType}
                    onValueChange={setContactNrcType}
                    options={nrcTypeOptions}
                    placeholder="Type"
                  />
                  {errors.contactNrcType && (
                    <p className="text-xs text-rose-600">{errors.contactNrcType}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    id="contactNrcNumber"
                    value={contactNrcNumber}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setContactNrcNumber(digitsOnly);
                    }}
                    placeholder="123456"
                    inputMode="numeric"
                  />
                  {errors.contactNrcNumber && (
                    <p className="text-xs text-rose-600">{errors.contactNrcNumber}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-violet-400 pl-3">
          Contact Information
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primaryPhone" className="text-sm font-medium text-slate-700">
              Primary Phone Number
            </Label>
            <div className="flex gap-2">
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                +95
              </div>
              <Input
                id="primaryPhone"
                value={primaryPhone}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setPrimaryPhone(digitsOnly);
                }}
                placeholder="9 123 456 789"
                inputMode="numeric"
              />
            </div>
            {errors.primaryPhone && (
              <p className="text-xs text-rose-600">{errors.primaryPhone}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryPhone" className="text-sm font-medium text-slate-700">
              Secondary Phone Number
            </Label>
            <div className="flex gap-2">
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                +95
              </div>
              <Input
                id="secondaryPhone"
                value={secondaryPhone}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setSecondaryPhone(digitsOnly);
                }}
                placeholder="9 123 456 789"
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="contactEmail" className="text-sm font-medium text-slate-700">
              Email
            </Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="example@domain.com"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-amber-400 pl-3">
          Address Information (Installation Address)
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="installationRegion" className="text-sm font-medium text-slate-700">
              Region
            </Label>
            <SearchableSelect
              id="installationRegion"
              value={installationRegion}
              onValueChange={(value) => {
                setInstallationRegion(value);
                setInstallationDistrict('');
                setInstallationTownship('');
              }}
              options={regionSelectOptions}
              placeholder="Select region"
            />
            {errors.installationRegion && (
              <p className="text-xs text-rose-600">{errors.installationRegion}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationDistrict" className="text-sm font-medium text-slate-700">
              District
            </Label>
            <SearchableSelect
              id="installationDistrict"
              value={installationDistrict}
              onValueChange={(value) => {
                setInstallationDistrict(value);
                setInstallationTownship('');
              }}
              options={installationDistrictSelectOptions}
              placeholder="Select district"
            />
            {errors.installationDistrict && (
              <p className="text-xs text-rose-600">{errors.installationDistrict}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationTownship" className="text-sm font-medium text-slate-700">
              Township
            </Label>
            <SearchableSelect
              id="installationTownship"
              value={installationTownship}
              onValueChange={setInstallationTownship}
              options={installationTownshipSelectOptions}
              placeholder="Select township"
            />
            {errors.installationTownship && (
              <p className="text-xs text-rose-600">{errors.installationTownship}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationCity" className="text-sm font-medium text-slate-700">
              City
            </Label>
            <Input
              id="installationCity"
              value={installationCity}
              onChange={(e) => setInstallationCity(e.target.value)}
              placeholder="City"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationPostalCode" className="text-sm font-medium text-slate-700">
              Postal Code
            </Label>
            <Input
              id="installationPostalCode"
              value={installationPostalCode}
              onChange={(e) => setInstallationPostalCode(e.target.value)}
              placeholder="Postal code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationWard" className="text-sm font-medium text-slate-700">
              Ward
            </Label>
            <Input
              id="installationWard"
              value={installationWard}
              onChange={(e) => setInstallationWard(e.target.value)}
              placeholder="Ward"
            />
            {errors.installationWard && (
              <p className="text-xs text-rose-600">{errors.installationWard}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationStreet" className="text-sm font-medium text-slate-700">
              Street
            </Label>
            <Input
              id="installationStreet"
              value={installationStreet}
              onChange={(e) => setInstallationStreet(e.target.value)}
              placeholder="Street"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationBuilding" className="text-sm font-medium text-slate-700">
              Building / Unit
            </Label>
            <Input
              id="installationBuilding"
              value={installationBuilding}
              onChange={(e) => setInstallationBuilding(e.target.value)}
              placeholder="Building / Unit"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-sm font-medium text-slate-700">Full Address</Label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {formatAddress({
                building: installationBuilding,
                street: installationStreet,
                ward: installationWard,
                city: installationCity,
                township: installationTownship,
                district: installationDistrict,
                region: installationRegion,
                postalCode: installationPostalCode
              }) || '—'}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="installationMapLink" className="text-sm font-medium text-slate-700">
              Google Map Link
            </Label>
            <Input
              id="installationMapLink"
              value={installationMapLink}
              onChange={(e) => setInstallationMapLink(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-700">
              Billing Address (Same with Installation Address?)
            </Label>
          </div>
          <RadioGroup
            value={billingSameAsInstallation}
            onValueChange={(value) => setBillingSameAsInstallation(value as 'yes' | 'no')}
            className="flex flex-wrap gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="billing-same-yes" value="yes" />
              <Label htmlFor="billing-same-yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="billing-same-no" value="no" />
              <Label htmlFor="billing-same-no">No</Label>
            </div>
          </RadioGroup>
        </div>

      {billingSameAsInstallation === 'no' && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billingRegion" className="text-sm font-medium text-slate-700">
                Region
              </Label>
              <SearchableSelect
                id="billingRegion"
                value={billingRegion}
                onValueChange={(value) => {
                  setBillingRegion(value);
                  setBillingDistrict('');
                  setBillingTownship('');
                }}
                options={regionSelectOptions}
                placeholder="Select region"
              />
              {errors.billingRegion && (
                <p className="text-xs text-rose-600">{errors.billingRegion}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingDistrict" className="text-sm font-medium text-slate-700">
                District
              </Label>
              <SearchableSelect
                id="billingDistrict"
                value={billingDistrict}
                onValueChange={(value) => {
                  setBillingDistrict(value);
                  setBillingTownship('');
                }}
                options={billingDistrictSelectOptions}
                placeholder="Select district"
              />
              {errors.billingDistrict && (
                <p className="text-xs text-rose-600">{errors.billingDistrict}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingTownship" className="text-sm font-medium text-slate-700">
                Township
              </Label>
              <SearchableSelect
                id="billingTownship"
                value={billingTownship}
                onValueChange={setBillingTownship}
                options={billingTownshipSelectOptions}
                placeholder="Select township"
              />
              {errors.billingTownship && (
                <p className="text-xs text-rose-600">{errors.billingTownship}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingCity" className="text-sm font-medium text-slate-700">
                City
              </Label>
              <Input
                id="billingCity"
                value={billingCity}
                onChange={(e) => setBillingCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingPostalCode" className="text-sm font-medium text-slate-700">
                Postal Code
              </Label>
              <Input
                id="billingPostalCode"
                value={billingPostalCode}
                onChange={(e) => setBillingPostalCode(e.target.value)}
                placeholder="Postal code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingWard" className="text-sm font-medium text-slate-700">
                Ward
              </Label>
              <Input
                id="billingWard"
                value={billingWard}
                onChange={(e) => setBillingWard(e.target.value)}
                placeholder="Ward"
              />
              {errors.billingWard && (
                <p className="text-xs text-rose-600">{errors.billingWard}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingStreet" className="text-sm font-medium text-slate-700">
                Street
              </Label>
              <Input
                id="billingStreet"
                value={billingStreet}
                onChange={(e) => setBillingStreet(e.target.value)}
                placeholder="Street"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingBuilding" className="text-sm font-medium text-slate-700">
                Building / Unit
              </Label>
              <Input
                id="billingBuilding"
                value={billingBuilding}
                onChange={(e) => setBillingBuilding(e.target.value)}
                placeholder="Building / Unit"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium text-slate-700">Full Address</Label>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {formatAddress({
                building: billingBuilding,
                street: billingStreet,
                ward: billingWard,
                city: billingCity,
                township: billingTownship,
                district: billingDistrict,
                region: billingRegion,
                postalCode: billingPostalCode
              }) || '—'}
            </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="billingMapLink" className="text-sm font-medium text-slate-700">
                Google Map Link
              </Label>
              <Input
                id="billingMapLink"
                value={billingMapLink}
                onChange={(e) => setBillingMapLink(e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-teal-400 pl-3">
          Services & Subscription Details
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="serviceId" className="text-sm font-medium text-slate-700">
              Service ID
            </Label>
            <SearchableSelect
              id="serviceId"
              value={selectedPlanCode}
              onValueChange={(value) => {
                setSelectedPlanCode(value);
                const plan = activePlans.find((item) => item.planCode === value);
                setServiceId(plan?.planCode ?? '');
                setPackageName(plan?.planName ?? '');
                setBandwidthPlan(plan?.bandwidthPlan ?? '');
              }}
              options={serviceIdSelectOptions}
              placeholder={plansLoading ? 'Loading plans...' : 'Select service ID'}
              disabled={plansLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceType" className="text-sm font-medium text-slate-700">
              Service Type
            </Label>
            <SearchableSelect
              id="serviceType"
              value={serviceType}
              onValueChange={setServiceType}
              options={serviceTypeSelectOptions}
              placeholder="Select service type"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="packageName" className="text-sm font-medium text-slate-700">
              Internet Plan / Package Name
            </Label>
            <SearchableSelect
              id="packageName"
              value={selectedPlanCode}
              onValueChange={(value) => {
                setSelectedPlanCode(value);
                const plan = activePlans.find((item) => item.planCode === value);
                setServiceId(plan?.planCode ?? '');
                setPackageName(plan?.planName ?? '');
                setBandwidthPlan(plan?.bandwidthPlan ?? '');
              }}
              options={packagePlanSelectOptions}
              placeholder={plansLoading ? 'Loading plans...' : 'Select package plan'}
              disabled={plansLoading}
            />
            {errors.packageName && (
              <p className="text-xs text-rose-600">{errors.packageName}</p>
            )}
            {plansError && (
              <p className="text-xs text-rose-600">{plansError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bandwidthPlan" className="text-sm font-medium text-slate-700">
              Bandwidth (Download / Upload) Mbps
            </Label>
            <SearchableSelect
              id="bandwidthPlan"
              value={bandwidthPlan}
              onValueChange={setBandwidthPlan}
              options={bandwidthSelectOptions}
              placeholder="Select bandwidth"
            />
            {errors.bandwidthPlan && (
              <p className="text-xs text-rose-600">{errors.bandwidthPlan}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceStartDate" className="text-sm font-medium text-slate-700">
              Service Start Date
            </Label>
            <Input
              id="serviceStartDate"
              type="date"
              value={serviceStartDate}
              onChange={(e) => setServiceStartDate(e.target.value)}
            />
            {errors.serviceStartDate && (
              <p className="text-xs text-rose-600">{errors.serviceStartDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractStartDate" className="text-sm font-medium text-slate-700">
              Contract Start Date
            </Label>
            <Input
              id="contractStartDate"
              type="date"
              value={contractStartDate}
              onChange={(e) => setContractStartDate(e.target.value)}
            />
            {errors.contractStartDate && (
              <p className="text-xs text-rose-600">{errors.contractStartDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractEndDate" className="text-sm font-medium text-slate-700">
              Contract End Date
            </Label>
            <Input
              id="contractEndDate"
              type="date"
              value={contractEndDate}
              onChange={(e) => setContractEndDate(e.target.value)}
            />
            {errors.contractEndDate && (
              <p className="text-xs text-rose-600">{errors.contractEndDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationDate" className="text-sm font-medium text-slate-700">
              Installation Date
            </Label>
            <Input
              id="installationDate"
              type="date"
              value={installationDate}
              onChange={(e) => setInstallationDate(e.target.value)}
            />
            {errors.installationDate && (
              <p className="text-xs text-rose-600">{errors.installationDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ipType" className="text-sm font-medium text-slate-700">
              Assigned IP Type (Static / Dynamic)
            </Label>
            <SearchableSelect
              id="ipType"
              value={ipType}
              onValueChange={setIpType}
              options={ipTypeSelectOptions}
              placeholder="Select IP type"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staticIpAddress" className="text-sm font-medium text-slate-700">
              Static IP Address (if applicable)
            </Label>
            <Input
              id="staticIpAddress"
              value={staticIpAddress}
              onChange={(e) => setStaticIpAddress(e.target.value)}
              placeholder="Static IP address"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-indigo-400 pl-3">
          Network and Technical Details
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="routerId" className="text-sm font-medium text-slate-700">
              Router / CPE ID
            </Label>
            <Input
              id="routerId"
              value={routerId}
              onChange={(e) => setRouterId(e.target.value)}
              placeholder="Router / CPE ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="macAddress" className="text-sm font-medium text-slate-700">
              MAC Address
            </Label>
            <Input
              id="macAddress"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
              placeholder="00:11:22:33:44:55"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onuSerial" className="text-sm font-medium text-slate-700">
              ONU / Modem Serial Number
            </Label>
            <Input
              id="onuSerial"
              value={onuSerial}
              onChange={(e) => setOnuSerial(e.target.value)}
              placeholder="ONU / Modem serial"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vlanPort" className="text-sm font-medium text-slate-700">
              VLAN / Port Number
            </Label>
            <Input
              id="vlanPort"
              value={vlanPort}
              onChange={(e) => setVlanPort(e.target.value)}
              placeholder="VLAN / Port"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="networkZone" className="text-sm font-medium text-slate-700">
              Network Zone / POP
            </Label>
            <Input
              id="networkZone"
              value={networkZone}
              onChange={(e) => setNetworkZone(e.target.value)}
              placeholder="Network zone / POP"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-rose-400 pl-3">
          Billing Information
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="billingCycle" className="text-sm font-medium text-slate-700">
              Billing Cycle
            </Label>
            <SearchableSelect
              id="billingCycle"
              value={billingCycle}
              onValueChange={setBillingCycle}
              options={billingCycleSelectOptions}
              placeholder="Select billing cycle"
            />
            {errors.billingCycle && (
              <p className="text-xs text-rose-600">{errors.billingCycle}</p>
            )}
          </div>
          {billingCycle === 'Custom' && (
            <div className="space-y-2">
              <Label htmlFor="customBillingMonths" className="text-sm font-medium text-slate-700">
                Custom Cycle (Months)
              </Label>
              <Input
                id="customBillingMonths"
                value={customBillingMonths}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setCustomBillingMonths(digitsOnly);
                }}
                placeholder="e.g. 6"
                inputMode="numeric"
              />
              {errors.customBillingMonths && (
                <p className="text-xs text-rose-600">{errors.customBillingMonths}</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Billing Day</Label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {billingDay || '—'}
            </div>
            {errors.billingDay && (
              <p className="text-xs text-rose-600">{errors.billingDay}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Currency</Label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              MMK
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Monthly Subscription Fee
            </Label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {monthlyFee || '—'}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationFee" className="text-sm font-medium text-slate-700">
              Installation Fee
            </Label>
            <Input
              id="installationFee"
              value={installationFee}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '');
                setInstallationFee(digitsOnly);
              }}
              placeholder="0"
              inputMode="numeric"
            />
            {errors.installationFee && (
              <p className="text-xs text-rose-600">{errors.installationFee}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="additionalFees" className="text-sm font-medium text-slate-700">
              Additional Services Fees
            </Label>
            <Input
              id="additionalFees"
              value={additionalFees}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '');
                setAdditionalFees(digitsOnly);
              }}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-sm font-medium text-slate-700">
              Discount Promotion Applied?
            </Label>
            <RadioGroup
              value={discountApplied}
              onValueChange={(value) => setDiscountApplied(value as 'yes' | 'no')}
              className="flex flex-wrap gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="discount-yes" value="yes" />
                <Label htmlFor="discount-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="discount-no" value="no" />
                <Label htmlFor="discount-no">No</Label>
              </div>
            </RadioGroup>
          </div>
          {discountApplied === 'yes' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="discountAmount" className="text-sm font-medium text-slate-700">
                  Discount Amount
                </Label>
                <Input
                  id="discountAmount"
                  value={discountAmount}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '');
                    setDiscountAmount(digitsOnly);
                  }}
                  placeholder="0"
                  inputMode="numeric"
                />
                {errors.discountAmount && (
                  <p className="text-xs text-rose-600">{errors.discountAmount}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountPeriod" className="text-sm font-medium text-slate-700">
                  Discount Period (Months)
                </Label>
                <Input
                  id="discountPeriod"
                  value={discountPeriod}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setDiscountPeriod(digitsOnly);
                  }}
                  placeholder="e.g. 3"
                  inputMode="numeric"
                />
                {errors.discountPeriod && (
                  <p className="text-xs text-rose-600">{errors.discountPeriod}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-indigo-400 pl-3">
          Assign Collector
        </h4>
        <div className="space-y-3 max-w-md">
          <Label htmlFor="assignedCollector" className="text-sm font-medium text-slate-700">
            Collector
          </Label>
          <SearchableSelect
            id="assignedCollector"
            value={newCustomer.collectorId}
            onValueChange={(value) => setNewCustomer({ ...newCustomer, collectorId: value })}
            options={collectorSelectOptions}
            placeholder={collectorsLoading ? 'Loading collectors...' : 'Select collector'}
          />
          {collectorsError && (
            <p className="text-xs text-rose-600">{collectorsError}</p>
          )}
          {!collectorsLoading && hasFetchedCollectors && collectorSelectOptions.length === 0 && (
            <p className="text-xs text-slate-500">No collectors available.</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {inlineForm ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">New Customer</h1>
              <p className="text-gray-600">Create a new customer record</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {formContent}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => router.replace(listPath)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCustomer} disabled={isAddingCustomer}>
                    {isAddingCustomer ? 'Adding...' : 'Add Customer'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
              <p className="text-gray-600">Manage your customer database</p>
            </div>
          </div>
        )}

        {!inlineForm && editingCustomer && (
          <Card>
            <CardHeader>
              <CardTitle>Update Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {formContent}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingCustomer(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateCustomer}>
                  Update Customer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!inlineForm && !editingCustomer && (
          <Card>
            <CardHeader>
              <CardTitle>Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Tabs value={customerTypeFilter} onValueChange={(value) => setCustomerTypeFilter(value as 'all' | 'individual' | 'business')}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All Customers</TabsTrigger>
                  <TabsTrigger value="individual">Individual</TabsTrigger>
                  <TabsTrigger value="business">Business</TabsTrigger>
                </TabsList>
              </Tabs>

              {customersLoading && (
                <div className="mb-4 text-sm text-slate-500">Loading customers...</div>
              )}
              {customersError && (
                <div className="mb-4 text-sm text-rose-600">{customersError}</div>
              )}
              {!customersLoading && hasFetchedCustomers && filteredCustomers.length === 0 && !customersError && (
                <div className="mb-4 text-sm text-slate-500">No customers found.</div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Code</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Monthly Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Collector</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => {
                      const collectorValue = customer.collectorId || 'unassigned';
                      const assignPlaceholder = isAssigningCollector[customer.id]
                        ? 'Assigning...'
                        : collectorsLoading
                        ? 'Loading collectors...'
                        : 'Assign collector';
                      return (
                        <TableRow key={customer.id}>
                          <TableCell>
                            {(customer as Customer & { code?: string }).code || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{customer.name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {customer.phone}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                              {customer.address.substring(0, 30)}...
                            </div>
                          </TableCell>
                          <TableCell>{customer.package}</TableCell>
                          <TableCell>{customer.monthlyFee}</TableCell>
                          <TableCell>
                            {(() => {
                              const statusValue = toSelectStatus(
                                customer.status as 'active' | 'inactive' | 'enable' | 'disable' | 'takeoff'
                              );
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
                                    handleStatusChange(customer.id, value as 'enable' | 'disable' | 'takeoff')
                                  }
                                  disabled={isUpdatingStatus[customer.id]}
                                >
                                  <SelectTrigger className={`h-8 w-32 ${statusClass}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {userStatusOptions.map((option) => (
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
                            <div className="min-w-[180px]">
                              <SearchableSelect
                                id={`collector-${customer.id}`}
                                value={collectorValue}
                                onValueChange={(value) => handleAssignCollector(customer.id, value)}
                                options={collectorSelectOptionsWithUnassigned}
                                placeholder={assignPlaceholder}
                                disabled={collectorsLoading || isAssigningCollector[customer.id]}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEditCustomer(customer)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
