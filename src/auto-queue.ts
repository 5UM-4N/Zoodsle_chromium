import { EligibleImage } from './types';
import { SessionDescriptionCache } from './storage';
import { SpeechNarrator } from './speech-narrator';

export type DescribeHandler = (item: EligibleImage) => Promise<string | null>;

export class AutoNarrationQueue {
  private queue: EligibleImage[] = [];
  private queuedSignatures = new Set<string>();
  private isProcessing = false;
  private isPaused = false;
  private maxCapacity: number;
  private cache: SessionDescriptionCache;
  private narrator: SpeechNarrator;
  private onDescribe: DescribeHandler;

  constructor(
    cache: SessionDescriptionCache,
    narrator: SpeechNarrator,
    onDescribe: DescribeHandler,
    maxCapacity = 5
  ) {
    this.cache = cache;
    this.narrator = narrator;
    this.onDescribe = onDescribe;
    this.maxCapacity = maxCapacity;

    // Listen for narrator completing speech so queued items automatically resume processing
    this.narrator.onStateChange((state) => {
      if (state === 'idle' && !this.isPaused && this.queue.length > 0 && !this.isProcessing) {
        this.processNext();
      }
    });
  }

  enqueue(image: EligibleImage): boolean {
    if (this.isPaused) return false;

    // Skip if already cached or already in the queue
    if (this.cache.has(image.signature) || this.queuedSignatures.has(image.signature)) {
      return false;
    }

    // If queue is full, drop oldest item to keep up with user scrolling
    if (this.queue.length >= this.maxCapacity) {
      const dropped = this.queue.shift();
      if (dropped) {
        this.queuedSignatures.delete(dropped.signature);
      }
    }

    this.queue.push(image);
    this.queuedSignatures.add(image.signature);
    this.processNext();
    return true;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) {
      return;
    }

    // Do not interrupt active speech; let the current narration finish
    if (this.narrator.getState() === 'speaking' || this.narrator.getState() === 'analyzing') {
      return;
    }

    const nextImage = this.queue.shift();
    if (!nextImage) return;

    this.queuedSignatures.delete(nextImage.signature);
    this.isProcessing = true;

    try {
      // Re-verify the element is still attached and somewhat visible
      if (!nextImage.element.isConnected) {
        this.isProcessing = false;
        this.processNext();
        return;
      }

      await this.onDescribe(nextImage);
    } catch (err) {
      console.warn('[ZoodSle] Auto-narration error on item:', err);
    } finally {
      this.isProcessing = false;
      // Process next in queue after brief delay
      setTimeout(() => this.processNext(), 400);
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.processNext();
  }

  clear(): void {
    this.queue = [];
    this.queuedSignatures.clear();
  }

  size(): number {
    return this.queue.length;
  }

  isBusy(): boolean {
    return this.isProcessing;
  }
}
