'use client';

import { useEffect, useState } from 'react';
import {
  fetchSystemBranding,
  readSystemBranding,
  SYSTEM_BRANDING_STORAGE_KEY,
  SYSTEM_BRANDING_UPDATED_EVENT,
  type SystemBranding,
} from '@/lib/system-branding';

export const useSystemBranding = () => {
  const [branding, setBranding] = useState<SystemBranding>(() => readSystemBranding());

  useEffect(() => {
    const syncFromCache = () => setBranding(readSystemBranding());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SYSTEM_BRANDING_STORAGE_KEY) syncFromCache();
    };

    void fetchSystemBranding().then(setBranding).catch(syncFromCache);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(SYSTEM_BRANDING_UPDATED_EVENT, syncFromCache as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(SYSTEM_BRANDING_UPDATED_EVENT, syncFromCache as EventListener);
    };
  }, []);

  return branding;
};
