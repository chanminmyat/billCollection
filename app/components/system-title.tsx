'use client';

import { useEffect } from 'react';
import {
  fetchSystemBranding,
  readSystemBranding,
  SYSTEM_BRANDING_STORAGE_KEY,
  SYSTEM_BRANDING_UPDATED_EVENT,
} from '@/lib/system-branding';

const buildTitle = () => {
  const branding = readSystemBranding();
  return branding.systemTagline
    ? `${branding.systemName} - ${branding.systemTagline}`
    : branding.systemName;
};

export default function SystemTitle() {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const syncTitle = () => {
      document.title = buildTitle();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SYSTEM_BRANDING_STORAGE_KEY) syncTitle();
    };

    syncTitle();
    fetchSystemBranding()
      .then((branding) => {
        document.title = branding.systemTagline
          ? `${branding.systemName} - ${branding.systemTagline}`
          : branding.systemName;
      })
      .catch(() => {
        syncTitle();
      });

    window.addEventListener('storage', onStorage);
    window.addEventListener(SYSTEM_BRANDING_UPDATED_EVENT, syncTitle as EventListener);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SYSTEM_BRANDING_UPDATED_EVENT, syncTitle as EventListener);
    };
  }, []);

  return null;
}
