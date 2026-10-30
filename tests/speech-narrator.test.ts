import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpeechNarrator } from '../src/speech-narrator';

describe('Speech Narrator & Live Regions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates live regions on initialization for screen reader accessibility', () => {
    new SpeechNarrator();

    const politeRegion = document.getElementById('zoodsle-live-region');
    const alertRegion = document.getElementById('zoodsle-alert-region');

    expect(politeRegion).not.toBeNull();
    expect(politeRegion?.getAttribute('aria-live')).toBe('polite');
    expect(politeRegion?.classList.contains('zoodsle-sr-only')).toBe(true);

    expect(alertRegion).not.toBeNull();
    expect(alertRegion?.getAttribute('aria-live')).toBe('assertive');
  });

  it('notifies listeners when transitioning to analyzing state', () => {
    const narrator = new SpeechNarrator();
    const states: string[] = [];

    narrator.onStateChange((state) => states.push(state));
    narrator.setAnalyzing();

    expect(narrator.getState()).toBe('analyzing');
    expect(states).toContain('analyzing');
  });

  it('stops ongoing speech and sets state back to idle', () => {
    const narrator = new SpeechNarrator();
    narrator.setAnalyzing();
    expect(narrator.getState()).toBe('analyzing');

    narrator.stop();
    expect(narrator.getState()).toBe('idle');
  });

  it('remembers last spoken description for repeat requests', async () => {
    const narrator = new SpeechNarrator();
    await narrator.speak('A bright blue mountain lake under a clear sky.');
    expect(narrator.getLastSpoken()).toBe('A bright blue mountain lake under a clear sky.');
  });
});
