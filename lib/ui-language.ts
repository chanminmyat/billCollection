export type UiLanguage = 'en' | 'mm';

export const UI_LANGUAGE_STORAGE_KEY = 'billpro_ui_language_v1';
export const UI_LANGUAGE_UPDATED_EVENT = 'billpro-ui-language-updated';

export const normalizeUiLanguage = (value?: string | null): UiLanguage => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (
    normalized === 'mm' ||
    normalized === 'my' ||
    normalized === 'burmese' ||
    normalized === 'myanmar' ||
    normalized.includes('မြန်')
  ) {
    return 'mm';
  }
  return 'en';
};

export const readUiLanguage = (fallback?: string | null): UiLanguage => {
  if (typeof window === 'undefined') {
    return normalizeUiLanguage(fallback);
  }

  const saved = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  if (saved) {
    return normalizeUiLanguage(saved);
  }

  return normalizeUiLanguage(fallback);
};

export const writeUiLanguage = (language: UiLanguage) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
  window.dispatchEvent(new CustomEvent(UI_LANGUAGE_UPDATED_EVENT, { detail: language }));
};
