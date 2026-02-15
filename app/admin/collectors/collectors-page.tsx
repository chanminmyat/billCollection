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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

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
      <SelectContent onOpenAutoFocus={(event) => event.preventDefault()}>
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
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);
  const [remoteCollectors, setRemoteCollectors] = useState<Collector[]>([]);
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
  const [newCollector, setNewCollector] = useState({
    name: '',
    phone: '',
    email: '',
    area: ''
  });

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
    const match = value.match(/^(.+?)\/(.+?)\((.+?)\)(.+)$/);
    if (!match) return { state: '', township: '', type: '', number: '' };
    return {
      state: match[1] ?? '',
      township: match[2] ?? '',
      type: match[3] ?? '',
      number: match[4] ?? ''
    };
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

        const normalized = list.map((item: any, index: number) => ({
          id: String(item?.id ?? item?.user?.id ?? index + 1),
          collectorCode: item?.collectorCode ?? item?.user?.username ?? '',
          name: item?.user?.name ?? 'Unknown',
          phone: item?.user?.phone ?? '',
          email: item?.user?.email ?? '',
          area: item?.area ?? item?.township ?? '',
          status: item?.status ?? item?.user?.status ?? 'enable',
          nrc: item?.nrc ?? '',
          address: item?.address ?? ''
        })) as Collector[];

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
        const normalized = list.map((item: any, index: number) => {
          const collectorIdRaw =
            item?.collectorCode ?? item?.collectorId ?? item?.collector?.id ?? '';
          const collectorId = collectorIdRaw ? String(collectorIdRaw) : '';
          return {
            id: String(item?.id ?? index + 1),
            name:
              item?.personalName ||
              item?.companyName ||
              item?.name ||
              'Unknown',
            collectorId
          };
        });

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

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  const handleAddCollector = async () => {
    if (isAddingCollector) return;
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

    const payload = {
      collector: {
        name: newCollector.name,
        phone: newCollector.phone,
        email: newCollector.email,
        area: collectorTownship || collectorDistrict || newCollector.area,
        status: collectorStatus,
        nrc: nrcValue,
        address: addressValue
      }
    };

    console.log('Add collector payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await fetch(`${API_BASE_URL}/auth/collectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? 'Failed to create collector';
        console.error(message, data);
        setIsAddingCollector(false);
        return;
      }
    } catch (error) {
      console.error('Failed to create collector', error);
      setIsAddingCollector(false);
      return;
    }

    addCollector({
      ...newCollector,
      area: collectorTownship || collectorDistrict || newCollector.area,
      status: collectorStatus,
      nrc: nrcValue,
      address: addressValue
    });
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
    setEditingCollector(collector);
    setNewCollector({
      name: collector.name,
      phone: collector.phone,
      email: collector.email,
      area: collector.area
    });
    setCollectorStatus(collector.status ?? 'enable');
    setNrcState(parsedNrc.state);
    setNrcTownship(parsedNrc.township);
    setNrcType(parsedNrc.type);
    setNrcNumber(parsedNrc.number);
    setCollectorRegion(collector.addressDetails?.region ?? '');
    setCollectorDistrict(collector.addressDetails?.district ?? '');
    setCollectorTownship(collector.addressDetails?.township ?? '');
    setCollectorCity(collector.addressDetails?.city ?? '');
    setCollectorWard(collector.addressDetails?.ward ?? '');
    setCollectorStreet(
      collector.addressDetails?.street ?? (collector.address ? collector.address : '')
    );
    setCollectorBuilding(collector.addressDetails?.building ?? '');
    setCollectorPostalCode(collector.addressDetails?.postalCode ?? '');
  };

  const handleUpdateCollector = async () => {
    if (editingCollector) {
      if (isUpdatingCollector) return;
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
        email: newCollector.email,
        area: collectorTownship || collectorDistrict || newCollector.area,
        status: collectorStatus,
        nrc: nrcValue,
        address: addressValue
      };

      try {
        const response = await fetch(`${API_BASE_URL}/customers/${editingCollector.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.message ?? 'Failed to update collector';
          console.error(message, data);
          setIsUpdatingCollector(false);
          return;
        }
      } catch (error) {
        console.error('Failed to update collector', error);
        setIsUpdatingCollector(false);
        return;
      }

      updateCollector(editingCollector.id, {
        ...newCollector,
        area: collectorTownship || collectorDistrict || newCollector.area,
        status: collectorStatus,
        nrc: nrcValue,
        address: addressValue
      });
      updateRemoteCollector(editingCollector.id, {
        name: newCollector.name,
        phone: newCollector.phone,
        email: newCollector.email,
        area: collectorTownship || collectorDistrict || newCollector.area,
        status: collectorStatus,
        nrc: nrcValue,
        address: addressValue
      });
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
            Full Name
          </Label>
          <Input
            id="collector-name"
            value={newCollector.name}
            onChange={(e) => setNewCollector({ ...newCollector, name: e.target.value })}
            placeholder="Enter collector's full name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="collector-status" className="text-sm font-medium text-slate-700">
            Collector Status
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
            onChange={(e) => setNewCollector({ ...newCollector, email: e.target.value })}
            placeholder="collector@billflow.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="collector-phone" className="text-sm font-medium text-slate-700">
            Phone Number
          </Label>
          <Input
            id="collector-phone"
            value={newCollector.phone}
            onChange={(e) => setNewCollector({ ...newCollector, phone: e.target.value })}
            placeholder="09 123 456 789"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-sm font-medium text-slate-700">NRC</Label>
          <div className="grid gap-3 md:grid-cols-4 rounded-lg border border-slate-200 bg-slate-100 p-4">
            <SearchableSelect
              id="collector-nrc-state"
              value={nrcState}
              onValueChange={(value) => {
                setNrcState(value);
                setNrcTownship('');
              }}
              options={nrcStateOptions}
              placeholder="State"
            />
            <SearchableSelect
              id="collector-nrc-township"
              value={nrcTownship}
              onValueChange={setNrcTownship}
              options={nrcTownshipOptions}
              placeholder="Township"
            />
            <SearchableSelect
              id="collector-nrc-type"
              value={nrcType}
              onValueChange={setNrcType}
              options={nrcTypeOptions}
              placeholder="Type"
            />
            <Input
              id="collector-nrc-number"
              value={nrcNumber}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                setNrcNumber(digitsOnly);
              }}
              placeholder="123456"
              inputMode="numeric"
            />
          </div>
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
              Region
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
              District
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
              Township
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
              Ward
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
            <Button onClick={() => router.push('/admin/collectors/new-collector')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Collector
            </Button>
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
                              <div className="text-sm text-gray-500">
                                ID: {(collector as Collector & { collectorCode?: string }).collectorCode || collector.id}
                              </div>
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
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    Assigned Customers{viewCollector ? ` • ${viewCollector.name}` : ''}
                  </DialogTitle>
                </DialogHeader>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
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
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setViewDialogOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
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
