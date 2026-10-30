import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoNarrationQueue } from '../src/auto-queue';
import { SessionDescriptionCache } from '../src/storage';
import { SpeechNarrator } from '../src/speech-narrator';
import { EligibleImage } from '../src/types';

describe('Auto Narration Queue', () => {
  let cache: SessionDescriptionCache;
  let narrator: SpeechNarrator;

  beforeEach(() => {
    cache = new SessionDescriptionCache(10);
    narrator = new SpeechNarrator();
  });

  function makeMockImage(sig: string): EligibleImage {
    const el = document.createElement('img');
    document.body.appendChild(el);
    return {
      element: el,
      src: `https://facebook.com/images/${sig}.jpg`,
      signature: sig,
      width: 400,
      height: 300,
    };
  }

  it('enqueues eligible unseen images', () => {
    const onDescribe = vi.fn().mockResolvedValue('Description text');
    const queue = new AutoNarrationQueue(cache, narrator, onDescribe, 5);

    const img1 = makeMockImage('sig-1');
    const added = queue.enqueue(img1);

    expect(added).toBe(true);
  });

  it('rejects images that are already present in session cache', () => {
    cache.set('sig-1', 'Previously analyzed description');
    const onDescribe = vi.fn().mockResolvedValue(null);
    const queue = new AutoNarrationQueue(cache, narrator, onDescribe, 5);

    const img1 = makeMockImage('sig-1');
    const added = queue.enqueue(img1);

    expect(added).toBe(false);
    expect(queue.size()).toBe(0);
  });

  it('enforces maximum queue capacity by dropping oldest items during fast scrolling', () => {
    const onDescribe = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves to keep processing busy
    const queue = new AutoNarrationQueue(cache, narrator, onDescribe, 3);

    // Queue 4 items
    const img1 = makeMockImage('sig-1');
    const img2 = makeMockImage('sig-2');
    const img3 = makeMockImage('sig-3');
    const img4 = makeMockImage('sig-4');

    queue.enqueue(img1);
    queue.enqueue(img2);
    queue.enqueue(img3);
    queue.enqueue(img4);

    // Queue size should never exceed max capacity (3)
    expect(queue.size()).toBeLessThanOrEqual(3);
  });

  it('pauses and resumes queue processing cleanly', () => {
    const onDescribe = vi.fn().mockResolvedValue('Done');
    const queue = new AutoNarrationQueue(cache, narrator, onDescribe, 5);

    queue.pause();
    const img1 = makeMockImage('sig-paused');
    const added = queue.enqueue(img1);

    // Enqueueing while paused is blocked
    expect(added).toBe(false);

    queue.resume();
    const addedAfterResume = queue.enqueue(img1);
    expect(addedAfterResume).toBe(true);
  });

  it('automatically resumes processing queued items when speech state transitions to idle', async () => {
    // Simulate narrator being active
    vi.spyOn(narrator, 'getState').mockReturnValue('speaking');
    const onDescribe = vi.fn().mockResolvedValue('Description');
    const queue = new AutoNarrationQueue(cache, narrator, onDescribe, 5);

    const img1 = makeMockImage('sig-waiting');
    queue.enqueue(img1);

    // Because narrator was speaking, item stays in queue and onDescribe was not called
    expect(queue.size()).toBe(1);
    expect(onDescribe).not.toHaveBeenCalled();

    // Now narrator finishes speech and transitions to idle
    vi.spyOn(narrator, 'getState').mockReturnValue('idle');
    (narrator as any).setState('idle');

    // Wait a tick for processNext
    await new Promise((r) => setTimeout(r, 50));
    expect(onDescribe).toHaveBeenCalledWith(img1);
  });
});
