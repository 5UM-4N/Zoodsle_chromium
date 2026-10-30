import { SpeechState } from './types';

export class SpeechNarrator {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private lastSpokenText: string = '';
  private state: SpeechState = 'idle';
  private liveRegion: HTMLElement | null = null;
  private alertRegion: HTMLElement | null = null;
  private stateChangeListeners: Array<(state: SpeechState) => void> = [];

  constructor() {
    if (typeof document !== 'undefined') {
      this.setupLiveRegions();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  private setupLiveRegions(): void {
    if (typeof document === 'undefined') return;

    if (!document.getElementById('zoodsle-live-region')) {
      const live = document.createElement('div');
      live.id = 'zoodsle-live-region';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      live.setAttribute('data-zoodsle-ui', 'true');
      live.className = 'zoodsle-sr-only';
      document.body.appendChild(live);
      this.liveRegion = live;
    } else {
      this.liveRegion = document.getElementById('zoodsle-live-region');
    }

    if (!document.getElementById('zoodsle-alert-region')) {
      const alert = document.createElement('div');
      alert.id = 'zoodsle-alert-region';
      alert.setAttribute('aria-live', 'assertive');
      alert.setAttribute('aria-atomic', 'true');
      alert.setAttribute('data-zoodsle-ui', 'true');
      alert.className = 'zoodsle-sr-only';
      document.body.appendChild(alert);
      this.alertRegion = alert;
    } else {
      this.alertRegion = document.getElementById('zoodsle-alert-region');
    }
  }

  onStateChange(listener: (state: SpeechState) => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }

  private setState(newState: SpeechState): void {
    this.state = newState;
    this.stateChangeListeners.forEach((l) => l(newState));
  }

  getState(): SpeechState {
    return this.state;
  }

  announcePolite(text: string): void {
    if (this.liveRegion) {
      // Clear briefly to force re-announcement of identical text if repeated
      this.liveRegion.textContent = '';
      setTimeout(() => {
        if (this.liveRegion) this.liveRegion.textContent = text;
      }, 50);
    }
  }

  announceAlert(text: string): void {
    if (this.alertRegion) {
      this.alertRegion.textContent = '';
      setTimeout(() => {
        if (this.alertRegion) this.alertRegion.textContent = text;
      }, 50);
    }
  }

  setAnalyzing(): void {
    this.setState('analyzing');
    this.announcePolite('Analyzing image with local AI model...');
  }

  speak(text: string, rate = 1.0, volume = 1.0): Promise<void> {
    return new Promise((resolve) => {
      this.lastSpokenText = text;

      if (!this.synth) {
        this.announcePolite(text);
        this.setState('idle');
        resolve();
        return;
      }

      // Stop any ongoing speech first
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.5, Math.min(2.5, rate));
      utterance.volume = Math.max(0, Math.min(1.0, volume));

      utterance.onstart = () => {
        this.setState('speaking');
        this.announcePolite(text);
      };

      utterance.onend = () => {
        this.setState('idle');
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (e) => {
        console.warn('[ZoodSle] Speech synthesis error:', e);
        this.setState('idle');
        this.currentUtterance = null;
        resolve();
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    });
  }

  pause(): void {
    if (this.synth && this.state === 'speaking') {
      this.synth.pause();
      this.setState('paused');
    }
  }

  resume(): void {
    if (this.synth && this.state === 'paused') {
      this.synth.resume();
      this.setState('speaking');
    }
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
    this.setState('idle');
  }

  repeatLast(rate = 1.0, volume = 1.0): Promise<void> {
    if (this.lastSpokenText) {
      return this.speak(this.lastSpokenText, rate, volume);
    }
    this.announceAlert('No previous image description to repeat.');
    return Promise.resolve();
  }

  getLastSpoken(): string {
    return this.lastSpokenText;
  }
}
