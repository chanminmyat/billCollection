'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type EditorState = {
  content: string;
  loading: boolean;
  saving: boolean;
  error: string;
  success: string;
};

type TownshipData = Record<string, Record<string, string[]>>;

type NrcTypeItem = {
  id: string;
  name: { en: string; mm: string };
};

type NrcStateItem = {
  id: string;
  code: string;
  number: { en: string; mm: string };
  name: { en: string; mm: string };
};

type NrcTownshipItem = {
  id: string;
  code: string;
  short: { en: string; mm: string };
  name: { en: string; mm: string };
  stateId: string;
  stateCode: string;
};

type NrcData = {
  nrcTypes: NrcTypeItem[];
  nrcStates: NrcStateItem[];
  nrcTownships: NrcTownshipItem[];
};

type DeleteAction =
  | { kind: 'region'; region: string }
  | { kind: 'district'; region: string; district: string }
  | { kind: 'township'; region: string; district: string; index: number; name: string }
  | { kind: 'nrc-type'; index: number }
  | { kind: 'nrc-state'; index: number }
  | { kind: 'nrc-township'; id: string };

const makeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const parseTownshipJson = (value: string): TownshipData => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const output: TownshipData = {};
    for (const [region, districtValue] of Object.entries(parsed as Record<string, unknown>)) {
      if (!districtValue || typeof districtValue !== 'object' || Array.isArray(districtValue)) continue;
      output[region] = {};
      for (const [district, townshipsValue] of Object.entries(districtValue as Record<string, unknown>)) {
        if (!Array.isArray(townshipsValue)) continue;
        output[region][district] = townshipsValue
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    return output;
  } catch {
    return {};
  }
};

const parseNrcJson = (value: string): NrcData => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      return { nrcTypes: [], nrcStates: [], nrcTownships: [] };
    }

    const safeTypes = Array.isArray((parsed as { nrcTypes?: unknown[] }).nrcTypes)
      ? (parsed as { nrcTypes: NrcTypeItem[] }).nrcTypes
      : [];
    const safeStates = Array.isArray((parsed as { nrcStates?: unknown[] }).nrcStates)
      ? (parsed as { nrcStates: NrcStateItem[] }).nrcStates
      : [];
    const safeTownships = Array.isArray((parsed as { nrcTownships?: unknown[] }).nrcTownships)
      ? (parsed as { nrcTownships: NrcTownshipItem[] }).nrcTownships
      : [];

    return {
      nrcTypes: safeTypes,
      nrcStates: safeStates,
      nrcTownships: safeTownships,
    };
  } catch {
    return { nrcTypes: [], nrcStates: [], nrcTownships: [] };
  }
};

const toPrettyJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export default function ReferenceDataPage() {
  const nrcTownshipPageSize = 25;
  const [nrc, setNrc] = useState<EditorState>({
    content: '',
    loading: true,
    saving: false,
    error: '',
    success: ''
  });
  const [township, setTownship] = useState<EditorState>({
    content: '',
    loading: true,
    saving: false,
    error: '',
    success: ''
  });

  const [townshipData, setTownshipData] = useState<TownshipData>({});
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newDistrict, setNewDistrict] = useState('');
  const [newTownship, setNewTownship] = useState('');
  const [renameRegion, setRenameRegion] = useState('');
  const [renameDistrict, setRenameDistrict] = useState('');
  const [structuredTownshipError, setStructuredTownshipError] = useState('');
  const [structuredTownshipSuccess, setStructuredTownshipSuccess] = useState('');

  const [nrcData, setNrcData] = useState<NrcData>({ nrcTypes: [], nrcStates: [], nrcTownships: [] });
  const [townshipSearch, setTownshipSearch] = useState('');
  const [structuredNrcError, setStructuredNrcError] = useState('');
  const [structuredNrcSuccess, setStructuredNrcSuccess] = useState('');
  const [nrcTownshipPage, setNrcTownshipPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<DeleteAction | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [nrcResponse, townshipResponse] = await Promise.all([
          fetch('/api/reference-data/nrc'),
          fetch('/api/reference-data/township')
        ]);

        const nrcDataResponse = await nrcResponse.json().catch(() => ({}));
        const townshipDataResponse = await townshipResponse.json().catch(() => ({}));

        if (!isMounted) return;

        const nrcContent = nrcDataResponse?.content ?? '';
        const townshipContent = townshipDataResponse?.content ?? '';

        setNrc((prev) => ({
          ...prev,
          content: nrcContent,
          loading: false,
          error: nrcResponse.ok ? '' : nrcDataResponse?.message ?? 'Failed to load NRC data.'
        }));

        setTownship((prev) => ({
          ...prev,
          content: townshipContent,
          loading: false,
          error: townshipResponse.ok ? '' : townshipDataResponse?.message ?? 'Failed to load township data.'
        }));

        const parsedTownship = parseTownshipJson(townshipContent);
        setTownshipData(parsedTownship);

        const firstRegion = Object.keys(parsedTownship)[0] ?? '';
        const firstDistrict = firstRegion ? Object.keys(parsedTownship[firstRegion] ?? {})[0] ?? '' : '';
        setSelectedRegion(firstRegion);
        setSelectedDistrict(firstDistrict);
        setRenameRegion(firstRegion);
        setRenameDistrict(firstDistrict);

        setNrcData(parseNrcJson(nrcContent));
      } catch {
        if (!isMounted) return;
        setNrc((prev) => ({ ...prev, loading: false, error: 'Failed to load NRC data.' }));
        setTownship((prev) => ({ ...prev, loading: false, error: 'Failed to load township data.' }));
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const regions = useMemo(() => Object.keys(townshipData).sort((a, b) => a.localeCompare(b)), [townshipData]);

  const districts = useMemo(() => {
    if (!selectedRegion) return [] as string[];
    return Object.keys(townshipData[selectedRegion] ?? {}).sort((a, b) => a.localeCompare(b));
  }, [selectedRegion, townshipData]);

  const townships = useMemo(() => {
    if (!selectedRegion || !selectedDistrict) return [] as string[];
    return [...(townshipData[selectedRegion]?.[selectedDistrict] ?? [])].sort((a, b) => a.localeCompare(b));
  }, [selectedDistrict, selectedRegion, townshipData]);

  const filteredNrcTownships = useMemo(() => {
    const query = townshipSearch.trim().toLowerCase();
    if (!query) return nrcData.nrcTownships;

    return nrcData.nrcTownships
      .filter((item) =>
        [
          item.code,
          item.short?.en,
          item.short?.mm,
          item.name?.en,
          item.name?.mm,
          item.stateCode,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
      );
  }, [nrcData.nrcTownships, townshipSearch]);

  const nrcTownshipPageCount = Math.max(
    1,
    Math.ceil(filteredNrcTownships.length / nrcTownshipPageSize),
  );

  const pagedNrcTownships = useMemo(() => {
    const safePage = Math.min(nrcTownshipPage, nrcTownshipPageCount);
    const start = (safePage - 1) * nrcTownshipPageSize;
    return filteredNrcTownships.slice(start, start + nrcTownshipPageSize);
  }, [filteredNrcTownships, nrcTownshipPage, nrcTownshipPageCount]);

  useEffect(() => {
    setNrcTownshipPage(1);
  }, [townshipSearch]);

  useEffect(() => {
    if (nrcTownshipPage > nrcTownshipPageCount) {
      setNrcTownshipPage(nrcTownshipPageCount);
    }
  }, [nrcTownshipPage, nrcTownshipPageCount]);

  const syncTownshipData = (nextData: TownshipData) => {
    setTownshipData(nextData);
    setTownship((prev) => ({ ...prev, content: toPrettyJson(nextData), error: '' }));
  };

  const syncNrcData = (nextData: NrcData) => {
    setNrcData(nextData);
    setNrc((prev) => ({ ...prev, content: toPrettyJson(nextData), error: '' }));
  };

  const validateNrcData = (data: NrcData): string[] => {
    const errors: string[] = [];

    const typeEnSet = new Set<string>();
    for (let index = 0; index < data.nrcTypes.length; index += 1) {
      const item = data.nrcTypes[index];
      const en = String(item.name?.en ?? '').trim().toLowerCase();
      if (!en) {
        errors.push(`NRC Type row ${index + 1}: EN is required.`);
      } else if (typeEnSet.has(en)) {
        errors.push(`NRC Type row ${index + 1}: duplicate EN value.`);
      } else {
        typeEnSet.add(en);
      }
    }

    const stateCodeSet = new Set<string>();
    for (let index = 0; index < data.nrcStates.length; index += 1) {
      const item = data.nrcStates[index];
      const code = String(item.code ?? '').trim().toLowerCase();
      if (!code) {
        errors.push(`NRC State row ${index + 1}: code is required.`);
      } else if (stateCodeSet.has(code)) {
        errors.push(`NRC State row ${index + 1}: duplicate code.`);
      } else {
        stateCodeSet.add(code);
      }
    }

    const townshipCompositeSet = new Set<string>();
    for (let index = 0; index < data.nrcTownships.length; index += 1) {
      const item = data.nrcTownships[index];
      const code = String(item.code ?? '').trim();
      const shortEn = String(item.short?.en ?? '').trim();
      const stateCode = String(item.stateCode ?? '').trim();
      const composite = `${stateCode.toLowerCase()}|${shortEn.toLowerCase()}|${code.toLowerCase()}`;
      if (!code || !shortEn || !stateCode) {
        errors.push(
          `NRC Township row ${index + 1}: code, short EN, and state code are required.`,
        );
      } else if (townshipCompositeSet.has(composite)) {
        errors.push(`NRC Township row ${index + 1}: duplicate state+short+code.`);
      } else {
        townshipCompositeSet.add(composite);
      }
    }

    return errors;
  };

  const handleAddTownship = () => {
    setStructuredTownshipError('');
    setStructuredTownshipSuccess('');

    const regionInput = newRegion.trim();
    const districtInput = newDistrict.trim();
    const townshipInput = newTownship.trim();

    const targetRegion = regionInput || selectedRegion;
    const targetDistrict = districtInput || selectedDistrict;

    if (!targetRegion) {
      setStructuredTownshipError('Choose or type a region.');
      return;
    }
    if (!targetDistrict) {
      setStructuredTownshipError('Choose or type a district.');
      return;
    }
    if (!townshipInput) {
      setStructuredTownshipError('Enter township/city name.');
      return;
    }

    const existingRegion = townshipData[targetRegion] ?? {};
    const existingTownships = existingRegion[targetDistrict] ?? [];

    if (existingTownships.some((value) => value.toLowerCase() === townshipInput.toLowerCase())) {
      setStructuredTownshipError('Township already exists in selected district.');
      return;
    }

    const nextData: TownshipData = {
      ...townshipData,
      [targetRegion]: {
        ...existingRegion,
        [targetDistrict]: [...existingTownships, townshipInput],
      },
    };

    syncTownshipData(nextData);
    setSelectedRegion(targetRegion);
    setSelectedDistrict(targetDistrict);
    setRenameRegion(targetRegion);
    setRenameDistrict(targetDistrict);
    setNewRegion('');
    setNewDistrict('');
    setNewTownship('');
    setStructuredTownshipSuccess(`Added ${townshipInput}.`);
  };

  const handleRenameRegion = () => {
    setStructuredTownshipError('');
    setStructuredTownshipSuccess('');
    const nextName = renameRegion.trim();
    if (!selectedRegion || !nextName) {
      setStructuredTownshipError('Select a region and enter a new name.');
      return;
    }
    if (nextName === selectedRegion) return;
    if (townshipData[nextName]) {
      setStructuredTownshipError('Region name already exists.');
      return;
    }

    const { [selectedRegion]: currentValue, ...rest } = townshipData;
    const nextData: TownshipData = { ...rest, [nextName]: currentValue ?? {} };
    syncTownshipData(nextData);
    setSelectedRegion(nextName);
    setStructuredTownshipSuccess('Region renamed.');
  };

  const handleDeleteRegion = () => {
    if (!selectedRegion) return;
    setPendingDelete({ kind: 'region', region: selectedRegion });
  };

  const handleRenameDistrict = () => {
    setStructuredTownshipError('');
    setStructuredTownshipSuccess('');
    const nextName = renameDistrict.trim();
    if (!selectedRegion || !selectedDistrict || !nextName) {
      setStructuredTownshipError('Select district and enter new name.');
      return;
    }
    if (nextName === selectedDistrict) return;

    const regionMap = townshipData[selectedRegion] ?? {};
    if (regionMap[nextName]) {
      setStructuredTownshipError('District name already exists in this region.');
      return;
    }

    const { [selectedDistrict]: currentList, ...restDistricts } = regionMap;
    const nextData: TownshipData = {
      ...townshipData,
      [selectedRegion]: {
        ...restDistricts,
        [nextName]: currentList ?? [],
      },
    };
    syncTownshipData(nextData);
    setSelectedDistrict(nextName);
    setStructuredTownshipSuccess('District renamed.');
  };

  const handleDeleteDistrict = () => {
    if (!selectedRegion || !selectedDistrict) return;
    setPendingDelete({
      kind: 'district',
      region: selectedRegion,
      district: selectedDistrict,
    });
  };

  const handleUpdateTownshipName = (index: number, value: string) => {
    if (!selectedRegion || !selectedDistrict) return;
    const trimmed = value.trim();
    const regionMap = townshipData[selectedRegion] ?? {};
    const list = [...(regionMap[selectedDistrict] ?? [])];
    list[index] = trimmed;
    const nextData: TownshipData = {
      ...townshipData,
      [selectedRegion]: {
        ...regionMap,
        [selectedDistrict]: list,
      },
    };
    syncTownshipData(nextData);
  };

  const handleDeleteTownship = (index: number) => {
    if (!selectedRegion || !selectedDistrict) return;
    const name = townships[index] ?? '';
    setPendingDelete({
      kind: 'township',
      region: selectedRegion,
      district: selectedDistrict,
      index,
      name,
    });
  };

  const updateNrcType = (index: number, field: 'en' | 'mm', value: string) => {
    const nextTypes = [...nrcData.nrcTypes];
    nextTypes[index] = { ...nextTypes[index], name: { ...nextTypes[index].name, [field]: value } };
    syncNrcData({ ...nrcData, nrcTypes: nextTypes });
  };

  const addNrcType = () => {
    syncNrcData({
      ...nrcData,
      nrcTypes: [...nrcData.nrcTypes, { id: makeId(), name: { en: '', mm: '' } }],
    });
    setStructuredNrcSuccess('NRC type row added.');
  };

  const deleteNrcType = (index: number) => {
    setPendingDelete({ kind: 'nrc-type', index });
  };

  const updateNrcState = (index: number, key: string, value: string) => {
    const nextStates = [...nrcData.nrcStates];
    const item = { ...nextStates[index] };
    if (key === 'code') item.code = value;
    if (key === 'numberEn') item.number = { ...item.number, en: value };
    if (key === 'numberMm') item.number = { ...item.number, mm: value };
    if (key === 'nameEn') item.name = { ...item.name, en: value };
    if (key === 'nameMm') item.name = { ...item.name, mm: value };
    nextStates[index] = item;
    syncNrcData({ ...nrcData, nrcStates: nextStates });
  };

  const addNrcState = () => {
    syncNrcData({
      ...nrcData,
      nrcStates: [
        ...nrcData.nrcStates,
        { id: makeId(), code: '', number: { en: '', mm: '' }, name: { en: '', mm: '' } },
      ],
    });
    setStructuredNrcSuccess('NRC state row added.');
  };

  const deleteNrcState = (index: number) => {
    setPendingDelete({ kind: 'nrc-state', index });
  };

  const updateNrcTownship = (id: string, key: string, value: string) => {
    const nextTownships = nrcData.nrcTownships.map((item) => {
      if (item.id !== id) return item;
      const nextItem = { ...item };
      if (key === 'code') nextItem.code = value;
      if (key === 'shortEn') nextItem.short = { ...nextItem.short, en: value };
      if (key === 'shortMm') nextItem.short = { ...nextItem.short, mm: value };
      if (key === 'nameEn') nextItem.name = { ...nextItem.name, en: value };
      if (key === 'nameMm') nextItem.name = { ...nextItem.name, mm: value };
      if (key === 'stateId') nextItem.stateId = value;
      if (key === 'stateCode') nextItem.stateCode = value;
      return nextItem;
    });
    syncNrcData({ ...nrcData, nrcTownships: nextTownships });
  };

  const addNrcTownship = () => {
    syncNrcData({
      ...nrcData,
      nrcTownships: [
        {
          id: makeId(),
          code: '',
          short: { en: '', mm: '' },
          name: { en: '', mm: '' },
          stateId: '',
          stateCode: '',
        },
        ...nrcData.nrcTownships,
      ],
    });
    setStructuredNrcSuccess('NRC township row added.');
  };

  const deleteNrcTownship = (id: string) => {
    setPendingDelete({ kind: 'nrc-township', id });
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;

    if (pendingDelete.kind === 'region') {
      const { [pendingDelete.region]: _, ...rest } = townshipData;
      syncTownshipData(rest);
      const nextRegion = Object.keys(rest)[0] ?? '';
      const nextDistrict = nextRegion ? Object.keys(rest[nextRegion] ?? {})[0] ?? '' : '';
      setSelectedRegion(nextRegion);
      setSelectedDistrict(nextDistrict);
      setRenameRegion(nextRegion);
      setRenameDistrict(nextDistrict);
      setStructuredTownshipSuccess('Region deleted.');
    } else if (pendingDelete.kind === 'district') {
      const regionMap = townshipData[pendingDelete.region] ?? {};
      const { [pendingDelete.district]: _, ...restDistricts } = regionMap;
      const nextData: TownshipData = {
        ...townshipData,
        [pendingDelete.region]: restDistricts,
      };
      syncTownshipData(nextData);
      const nextDistrict = Object.keys(restDistricts)[0] ?? '';
      setSelectedDistrict(nextDistrict);
      setRenameDistrict(nextDistrict);
      setStructuredTownshipSuccess('District deleted.');
    } else if (pendingDelete.kind === 'township') {
      const regionMap = townshipData[pendingDelete.region] ?? {};
      const list = [...(regionMap[pendingDelete.district] ?? [])];
      list.splice(pendingDelete.index, 1);
      const nextData: TownshipData = {
        ...townshipData,
        [pendingDelete.region]: {
          ...regionMap,
          [pendingDelete.district]: list,
        },
      };
      syncTownshipData(nextData);
      setStructuredTownshipSuccess('Township deleted.');
    } else if (pendingDelete.kind === 'nrc-type') {
      const nextTypes = [...nrcData.nrcTypes];
      nextTypes.splice(pendingDelete.index, 1);
      syncNrcData({ ...nrcData, nrcTypes: nextTypes });
    } else if (pendingDelete.kind === 'nrc-state') {
      const nextStates = [...nrcData.nrcStates];
      nextStates.splice(pendingDelete.index, 1);
      syncNrcData({ ...nrcData, nrcStates: nextStates });
    } else if (pendingDelete.kind === 'nrc-township') {
      syncNrcData({
        ...nrcData,
        nrcTownships: nrcData.nrcTownships.filter((item) => item.id !== pendingDelete.id),
      });
    }

    setPendingDelete(null);
  };

  const handleSave = async (type: 'nrc' | 'township') => {
    if (type === 'nrc') {
      const validationErrors = validateNrcData(nrcData);
      if (validationErrors.length > 0) {
        setStructuredNrcError(validationErrors.slice(0, 3).join(' '));
        setStructuredNrcSuccess('');
        return;
      }

      setNrc((prev) => ({ ...prev, saving: true, error: '', success: '' }));
      try {
        const response = await fetch('/api/reference-data/nrc', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: nrc.content }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message ?? 'Failed to save NRC data.');
        setNrc((prev) => ({ ...prev, saving: false, success: 'Saved successfully.' }));
      } catch (error) {
        setNrc((prev) => ({
          ...prev,
          saving: false,
          error: error instanceof Error ? error.message : 'Failed to save NRC data.',
        }));
      }
      return;
    }

    setTownship((prev) => ({ ...prev, saving: true, error: '', success: '' }));
    try {
      const response = await fetch('/api/reference-data/township', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: township.content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message ?? 'Failed to save township data.');
      setTownship((prev) => ({ ...prev, saving: false, success: 'Saved successfully.' }));
    } catch (error) {
      setTownship((prev) => ({
        ...prev,
        saving: false,
        error: error instanceof Error ? error.message : 'Failed to save township data.',
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Reference Data</h2>
        <p className="text-sm text-slate-500">Edit all NRC and township data with form UI and JSON mode.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Township Data (Structured Editor)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={selectedRegion}
              onChange={(event) => {
                const value = event.target.value;
                const nextDistrict = Object.keys(townshipData[value] ?? {})[0] ?? '';
                setSelectedRegion(value);
                setSelectedDistrict(nextDistrict);
                setRenameRegion(value);
                setRenameDistrict(nextDistrict);
              }}
            >
              <option value="">Select region</option>
              {regions.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={selectedDistrict}
              onChange={(event) => {
                setSelectedDistrict(event.target.value);
                setRenameDistrict(event.target.value);
              }}
            >
              <option value="">Select district</option>
              {districts.map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {townships.length} township(s)
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Add new region" value={newRegion} onChange={(event) => setNewRegion(event.target.value)} />
            <Input placeholder="Add new district" value={newDistrict} onChange={(event) => setNewDistrict(event.target.value)} />
            <Input placeholder="Add new township/city" value={newTownship} onChange={(event) => setNewTownship(event.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleAddTownship} disabled={township.loading}>Add Township/City</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex gap-2">
              <Input placeholder="Rename selected region" value={renameRegion} onChange={(event) => setRenameRegion(event.target.value)} />
              <Button type="button" variant="outline" onClick={handleRenameRegion}>Rename Region</Button>
              <Button type="button" variant="outline" onClick={handleDeleteRegion}>Delete Region</Button>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Rename selected district" value={renameDistrict} onChange={(event) => setRenameDistrict(event.target.value)} />
              <Button type="button" variant="outline" onClick={handleRenameDistrict}>Rename District</Button>
              <Button type="button" variant="outline" onClick={handleDeleteDistrict}>Delete District</Button>
            </div>
          </div>

          {townships.length > 0 && (
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-600">Edit Townships</p>
              {townships.map((name, index) => (
                <div key={`${name}-${index}`} className="flex gap-2">
                  <Input value={name} onChange={(event) => handleUpdateTownshipName(index, event.target.value)} />
                  <Button type="button" variant="outline" onClick={() => handleDeleteTownship(index)}>Delete</Button>
                </div>
              ))}
            </div>
          )}

          {structuredTownshipSuccess && <p className="text-sm text-emerald-600">{structuredTownshipSuccess}</p>}
          {structuredTownshipError && <p className="text-sm text-rose-600">{structuredTownshipError}</p>}

          {township.loading ? (
            <p className="text-sm text-slate-500">Loading township data...</p>
          ) : (
            <Textarea
              value={township.content}
              onChange={(event) => {
                const content = event.target.value;
                setTownship((prev) => ({ ...prev, content }));
                setTownshipData(parseTownshipJson(content));
                setStructuredTownshipError('');
                setStructuredTownshipSuccess('');
              }}
              rows={12}
              className="font-mono text-xs"
            />
          )}
          {township.error && <p className="text-sm text-rose-600">{township.error}</p>}
          {township.success && <p className="text-sm text-emerald-600">{township.success}</p>}
          <Button onClick={() => handleSave('township')} disabled={township.saving || township.loading}>
            {township.saving ? 'Saving...' : 'Save Township Data'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NRC Data (Structured Editor)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">NRC Types</p>
              <Button type="button" variant="outline" onClick={addNrcType}>Add Type</Button>
            </div>
            {nrcData.nrcTypes.map((item, index) => (
              <div key={item.id || index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <Input value={item.name?.en ?? ''} placeholder="EN" onChange={(event) => updateNrcType(index, 'en', event.target.value)} />
                <Input value={item.name?.mm ?? ''} placeholder="MM" onChange={(event) => updateNrcType(index, 'mm', event.target.value)} />
                <Button type="button" variant="outline" onClick={() => deleteNrcType(index)}>Delete</Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">NRC States</p>
              <Button type="button" variant="outline" onClick={addNrcState}>Add State</Button>
            </div>
            {nrcData.nrcStates.map((item, index) => (
              <div key={item.id || index} className="grid gap-2 md:grid-cols-6">
                <Input value={item.code ?? ''} placeholder="Code" onChange={(event) => updateNrcState(index, 'code', event.target.value)} />
                <Input value={item.number?.en ?? ''} placeholder="Number EN" onChange={(event) => updateNrcState(index, 'numberEn', event.target.value)} />
                <Input value={item.number?.mm ?? ''} placeholder="Number MM" onChange={(event) => updateNrcState(index, 'numberMm', event.target.value)} />
                <Input value={item.name?.en ?? ''} placeholder="Name EN" onChange={(event) => updateNrcState(index, 'nameEn', event.target.value)} />
                <Input value={item.name?.mm ?? ''} placeholder="Name MM" onChange={(event) => updateNrcState(index, 'nameMm', event.target.value)} />
                <Button type="button" variant="outline" onClick={() => deleteNrcState(index)}>Delete</Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">NRC Townships</p>
              <div className="flex gap-2">
                <Input
                  value={townshipSearch}
                  onChange={(event) => setTownshipSearch(event.target.value)}
                  placeholder="Search township..."
                />
                <Button type="button" variant="outline" onClick={addNrcTownship}>Add Township</Button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Showing page {nrcTownshipPage} of {nrcTownshipPageCount} ({filteredNrcTownships.length} total matches).
            </p>

            {pagedNrcTownships.map((item) => (
              <div key={item.id} className="grid gap-2 md:grid-cols-8">
                <Input value={item.code ?? ''} placeholder="Code" onChange={(event) => updateNrcTownship(item.id, 'code', event.target.value)} />
                <Input value={item.short?.en ?? ''} placeholder="Short EN" onChange={(event) => updateNrcTownship(item.id, 'shortEn', event.target.value)} />
                <Input value={item.short?.mm ?? ''} placeholder="Short MM" onChange={(event) => updateNrcTownship(item.id, 'shortMm', event.target.value)} />
                <Input value={item.name?.en ?? ''} placeholder="Name EN" onChange={(event) => updateNrcTownship(item.id, 'nameEn', event.target.value)} />
                <Input value={item.name?.mm ?? ''} placeholder="Name MM" onChange={(event) => updateNrcTownship(item.id, 'nameMm', event.target.value)} />
                <Input value={item.stateId ?? ''} placeholder="State ID" onChange={(event) => updateNrcTownship(item.id, 'stateId', event.target.value)} />
                <Input value={item.stateCode ?? ''} placeholder="State Code" onChange={(event) => updateNrcTownship(item.id, 'stateCode', event.target.value)} />
                <Button type="button" variant="outline" onClick={() => deleteNrcTownship(item.id)}>Delete</Button>
              </div>
            ))}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={nrcTownshipPage <= 1}
                onClick={() => setNrcTownshipPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={nrcTownshipPage >= nrcTownshipPageCount}
                onClick={() =>
                  setNrcTownshipPage((prev) => Math.min(nrcTownshipPageCount, prev + 1))
                }
              >
                Next
              </Button>
            </div>
          </div>

          {structuredNrcSuccess && <p className="text-sm text-emerald-600">{structuredNrcSuccess}</p>}
          {structuredNrcError && <p className="text-sm text-rose-600">{structuredNrcError}</p>}

          {nrc.loading ? (
            <p className="text-sm text-slate-500">Loading NRC data...</p>
          ) : (
            <Textarea
              value={nrc.content}
              onChange={(event) => {
                const content = event.target.value;
                setNrc((prev) => ({ ...prev, content }));
                setNrcData(parseNrcJson(content));
                setStructuredNrcError('');
                setStructuredNrcSuccess('');
              }}
              rows={12}
              className="font-mono text-xs"
            />
          )}
          {nrc.error && <p className="text-sm text-rose-600">{nrc.error}</p>}
          {nrc.success && <p className="text-sm text-emerald-600">{nrc.success}</p>}
          <Button onClick={() => handleSave('nrc')} disabled={nrc.saving || nrc.loading}>
            {nrc.saving ? 'Saving...' : 'Save NRC Data'}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove the selected data entry. This cannot be undone after save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
