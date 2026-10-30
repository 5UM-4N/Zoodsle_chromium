import { describe, it, expect } from 'vitest';
import { SessionDescriptionCache, getSettings } from '../src/storage';
import { DEFAULT_SETTINGS } from '../src/types';

describe('Storage and Session Cache', () => {
  it('returns default settings when storage is empty', async () => {
    const settings = await getSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.mode).toBe('ondemand');
    expect(settings.autoNarrationEnabled).toBe(false);
    expect(settings.backendUrl).toBe('http://127.0.0.1:1234/v1');
    expect(settings.verbosity).toBe('concise');
  });

  it('stores and retrieves cached image descriptions', () => {
    const cache = new SessionDescriptionCache(3);
    cache.set('sig-1', 'A dog playing in a park', 'data:image/jpeg;base64,abc', 'qwen/qwen3-vl-4b');

    expect(cache.has('sig-1')).toBe(true);
    const item = cache.get('sig-1');
    expect(item?.description).toBe('A dog playing in a park');
    expect(item?.model).toBe('qwen/qwen3-vl-4b');
    expect(item?.imageDataUrl).toBe('data:image/jpeg;base64,abc');
  });

  it('evicts oldest entries when exceeding maximum capacity', () => {
    const cache = new SessionDescriptionCache(2);
    cache.set('sig-1', 'Description 1');
    cache.set('sig-2', 'Description 2');

    expect(cache.size()).toBe(2);
    expect(cache.has('sig-1')).toBe(true);

    // Adding 3rd item should evict sig-1
    cache.set('sig-3', 'Description 3');
    expect(cache.size()).toBe(2);
    expect(cache.has('sig-1')).toBe(false);
    expect(cache.has('sig-2')).toBe(true);
    expect(cache.has('sig-3')).toBe(true);
  });

  it('clears all cached entries when requested', () => {
    const cache = new SessionDescriptionCache(5);
    cache.set('sig-1', 'Desc 1');
    cache.set('sig-2', 'Desc 2');
    expect(cache.size()).toBe(2);

    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.has('sig-1')).toBe(false);
  });
});
