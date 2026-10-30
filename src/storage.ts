import { DEFAULT_SETTINGS, ZoodSleSettings, CachedDescription } from './types';

const SETTINGS_KEY = 'zoodsle_settings';

export async function getSettings(): Promise<ZoodSleSettings> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(SETTINGS_KEY);
      if (data && data[SETTINGS_KEY]) {
        return { ...DEFAULT_SETTINGS, ...data[SETTINGS_KEY] };
      }
    }
  } catch (err) {
    console.warn('[ZoodSle] Failed to load settings from storage, using defaults:', err);
  }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: Partial<ZoodSleSettings>): Promise<ZoodSleSettings> {
  const current = await getSettings();
  const updated: ZoodSleSettings = { ...current, ...settings };
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
    }
  } catch (err) {
    console.error('[ZoodSle] Failed to save settings:', err);
  }
  return updated;
}

export class SessionDescriptionCache {
  private cache = new Map<string, CachedDescription>();
  private maxItems: number;

  constructor(maxItems = 100) {
    this.maxItems = maxItems;
  }

  get(signature: string): CachedDescription | undefined {
    return this.cache.get(signature);
  }

  has(signature: string): boolean {
    return this.cache.has(signature);
  }

  set(signature: string, description: string, imageDataUrl?: string, model?: string): void {
    if (this.cache.size >= this.maxItems) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(signature, {
      signature,
      description,
      timestamp: Date.now(),
      imageDataUrl,
      model,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
