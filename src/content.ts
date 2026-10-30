import {
  DEFAULT_SETTINGS,
  EligibleImage,
  ZoodSleSettings,
  ContentStatus,
} from './types';
import { getSettings, SessionDescriptionCache } from './storage';
import {
  findEligibleFeedImages,
  getImageSignature,
  getPrimaryFocusedFeedImage,
  isEligibleFeedImage,
} from './image-detector';
import { SpeechNarrator } from './speech-narrator';
import { AutoNarrationQueue } from './auto-queue';
import {
  getDeviceShortcuts,
  isDescribeKeyCombo,
  isStopSpeechKeyCombo,
} from './platform';

class ZoodSleContentController {
  private settings: ZoodSleSettings = { ...DEFAULT_SETTINGS };
  private cache = new SessionDescriptionCache(100);
  private narrator = new SpeechNarrator();
  private autoQueue: AutoNarrationQueue | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private observedImages = new WeakSet<HTMLImageElement>();
  private activeBadge: HTMLElement | null = null;
  private lastDescribedImageDataUrl: string | null = null;
  private lastDescriptionText: string | null = null;

  async init(): Promise<void> {
    this.settings = await getSettings();

    if (!this.settings.enabled) {
      console.log('[ZoodSle] Extension is disabled in settings.');
      return;
    }

    this.setupAutoQueue();
    this.setupIntersectionObserver();
    this.setupMutationObserver();
    this.setupKeyboardShortcuts();
    this.setupMessageListeners();
    this.setupImageFocusInteractions();

    // Initial scan of already rendered feed images
    this.scanAndObserveImages();

    console.debug('[ZoodSle] Universal accessibility controller initialized.');
  }

  private setupAutoQueue(): void {
    this.autoQueue = new AutoNarrationQueue(
      this.cache,
      this.narrator,
      async (item: EligibleImage) => {
        return await this.describeImageItem(item, 'auto');
      },
      5
    );

    if (!this.isAutoNarrationActive()) {
      this.autoQueue.pause();
    }
  }

  private isAutoNarrationActive(): boolean {
    return (
      this.settings.enabled &&
      this.settings.autoNarrationEnabled &&
      (this.settings.mode === 'auto' || this.settings.mode === 'both')
    );
  }

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (!this.isAutoNarrationActive() || !this.autoQueue) return;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const img = entry.target as HTMLImageElement;
            if (isEligibleFeedImage(img, this.settings.minImageDimension)) {
              const signature = getImageSignature(img);
              const rect = img.getBoundingClientRect();
              this.autoQueue.enqueue({
                element: img,
                src: img.currentSrc || img.src,
                signature,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              });
            }
          }
        }
      },
      { threshold: [0.5, 0.8] }
    );
  }

  private setupMutationObserver(): void {
    if (typeof MutationObserver === 'undefined') return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    this.mutationObserver = new MutationObserver((mutations) => {
      let hasAddedNodes = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          hasAddedNodes = true;
          break;
        }
      }

      if (hasAddedNodes) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.scanAndObserveImages();
        }, 500);
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private scanAndObserveImages(): void {
    const images = findEligibleFeedImages(document, this.settings.minImageDimension);
    for (const item of images) {
      if (!this.observedImages.has(item.element)) {
        this.observedImages.add(item.element);
        if (this.intersectionObserver) {
          this.intersectionObserver.observe(item.element);
        }
        this.attachHoverBadgeListeners(item.element);
      }
    }
  }

  private attachHoverBadgeListeners(img: HTMLImageElement): void {
    const showBadge = () => {
      if (!this.settings.enabled) return;
      this.renderActionBadge(img);
    };

    img.addEventListener('mouseenter', showBadge);
    img.addEventListener('focus', showBadge);

    // Also handle parent container focus
    const parentContainer = img.closest('[role="article"]') || img.parentElement;
    if (parentContainer) {
      parentContainer.addEventListener('focusin', (e) => {
        if (e.target === img || parentContainer.contains(img)) {
          showBadge();
        }
      });
    }
  }

  private renderActionBadge(img: HTMLImageElement): void {
    if (this.activeBadge && this.activeBadge.getAttribute('data-target-src') === img.src) {
      return;
    }

    if (this.activeBadge) {
      this.activeBadge.remove();
      this.activeBadge = null;
    }

    const shortcuts = getDeviceShortcuts();
    const badge = document.createElement('button');
    badge.className = 'zoodsle-action-badge';
    badge.setAttribute('data-zoodsle-ui', 'true');
    badge.setAttribute('data-target-src', img.src);
    badge.setAttribute('type', 'button');
    badge.setAttribute('aria-label', `Describe this photo with ZoodSle (Shortcut: ${shortcuts.describeShortcutLabel})`);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'zoodsle-badge-icon';
    iconSpan.setAttribute('aria-hidden', 'true');

    const textSpan = document.createElement('span');
    textSpan.textContent = 'Describe Image';

    const shortcutSpan = document.createElement('span');
    shortcutSpan.className = 'zoodsle-badge-shortcut';
    shortcutSpan.setAttribute('aria-hidden', 'true');
    shortcutSpan.textContent = shortcuts.describeShortcutLabel;

    badge.appendChild(iconSpan);
    badge.appendChild(textSpan);
    badge.appendChild(shortcutSpan);

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = img.getBoundingClientRect();
      const item: EligibleImage = {
        element: img,
        src: img.currentSrc || img.src,
        signature: getImageSignature(img),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      this.describeImageItem(item, 'ondemand');
    });

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    badge.style.position = 'absolute';
    badge.style.top = `${rect.top + scrollY + 12}px`;
    badge.style.left = `${rect.left + scrollX + 12}px`;

    document.body.appendChild(badge);
    this.activeBadge = badge;

    // Auto-remove badge when cursor moves away
    const removeBadge = (e: MouseEvent) => {
      if (!badge.contains(e.relatedTarget as Node) && e.relatedTarget !== img) {
        badge.remove();
        if (this.activeBadge === badge) {
          this.activeBadge = null;
        }
        img.removeEventListener('mouseleave', removeBadge);
        badge.removeEventListener('mouseleave', removeBadge);
      }
    };

    img.addEventListener('mouseleave', removeBadge);
    badge.addEventListener('mouseleave', removeBadge);
  }

  private setupImageFocusInteractions(): void {
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        if (isEligibleFeedImage(img, this.settings.minImageDimension)) {
          this.renderActionBadge(img);
        }
      }
    });
  }

  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Device-aware Describe shortcut (Option+Shift+D on Mac, Alt+Shift+D on Windows/Linux)
      if (isDescribeKeyCombo(e)) {
        e.preventDefault();
        this.describePrimaryFocusedImage();
      } else if (isStopSpeechKeyCombo(e)) {
        // Device-aware Stop Speech shortcut (Option+Shift+S on Mac, Alt+Shift+S on Windows/Linux)
        e.preventDefault();
        this.narrator.stop();
        this.narrator.announcePolite('Speech stopped.');
      }
    });
  }

  private setupMessageListeners(): void {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || !message.type) return false;

      switch (message.type) {
        case 'COMMAND_DESCRIBE_FOCUSED':
          this.describePrimaryFocusedImage();
          sendResponse({ ok: true });
          break;

        case 'COMMAND_STOP_SPEECH':
          this.narrator.stop();
          sendResponse({ ok: true });
          break;

        case 'COMMAND_PAUSE_RESUME_SPEECH':
          if (this.narrator.getState() === 'speaking') {
            this.narrator.pause();
          } else if (this.narrator.getState() === 'paused') {
            this.narrator.resume();
          }
          sendResponse({ ok: true, state: this.narrator.getState() });
          break;

        case 'COMMAND_REPEAT_SPEECH':
          this.narrator.repeatLast(this.settings.speechRate, this.settings.speechVolume);
          sendResponse({ ok: true });
          break;

        case 'SETTINGS_UPDATED':
          this.settings = { ...this.settings, ...message.settings };
          if (this.autoQueue) {
            if (this.isAutoNarrationActive()) {
              this.autoQueue.resume();
            } else {
              this.autoQueue.pause();
            }
          }
          sendResponse({ ok: true });
          break;

        case 'GET_CONTENT_STATUS': {
          const eligibleImages = findEligibleFeedImages(document, this.settings.minImageDimension);
          const status: ContentStatus = {
            activeImagesDetected: eligibleImages.length,
            lastDescription: this.lastDescriptionText,
            lastImageDataUrl: this.lastDescribedImageDataUrl,
            speechState: this.narrator.getState(),
            queueLength: this.autoQueue ? this.autoQueue.size() : 0,
            autoEnabled: this.isAutoNarrationActive(),
          };
          sendResponse({ ok: true, data: status });
          break;
        }

        default:
          sendResponse({ ok: false, error: 'Unknown message type' });
      }

      return true;
    });
  }

  async describePrimaryFocusedImage(): Promise<void> {
    const target = getPrimaryFocusedFeedImage(this.settings.minImageDimension);
    if (!target) {
      this.narrator.announceAlert('No eligible photo found in viewport.');
      return;
    }
    await this.describeImageItem(target, 'ondemand');
  }

  async describeImageItem(
    item: EligibleImage,
    trigger: 'ondemand' | 'auto'
  ): Promise<string | null> {
    // 1. Check session cache first
    const cached = this.cache.get(item.signature);
    if (cached) {
      if (trigger === 'ondemand') {
        this.renderDescriptionCard(item.element, cached.description, cached.model || 'qwen/qwen3-vl-4b');
        await this.narrator.speak(
          cached.description,
          this.settings.speechRate,
          this.settings.speechVolume
        );
      }
      return cached.description;
    }

    // 2. Announce analyzing state
    this.narrator.setAnalyzing();

    try {
      // Request description through background service worker to prevent mixed content issues
      const response = await chrome.runtime.sendMessage({
        type: 'DESCRIBE_IMAGE',
        payload: {
          src: item.src,
          mode: this.settings.verbosity,
        },
      });

      if (!response || !response.ok) {
        throw new Error(response?.error || 'Local vision backend did not return a description.');
      }

      const data = response.data;
      const description = data.description || 'No description generated.';
      const model = data.model || 'local vision model';
      const imageDataUrl = data.image_data_url;

      // 3. Save to session cache
      this.cache.set(item.signature, description, imageDataUrl, model);
      this.lastDescriptionText = description;
      this.lastDescribedImageDataUrl = imageDataUrl;

      // Store in local storage for popup inspection and follow-up Q&A
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          zoodsle_last_result: {
            description,
            model,
            timestamp: Date.now(),
            imageDataUrl,
            src: item.src,
          },
        }).catch(() => {});
      }

      // 4. Render accessible non-intrusive card
      this.renderDescriptionCard(item.element, description, model);

      // 5. Narrate aloud via SpeechSynthesis
      await this.narrator.speak(
        description,
        this.settings.speechRate,
        this.settings.speechVolume
      );

      return description;
    } catch (err: any) {
      console.warn('[ZoodSle] Describe error:', err);
      const userMessage = err.message || 'Unable to connect to ZoodSle backend.';
      this.narrator.announceAlert(`ZoodSle error: ${userMessage}`);
      return null;
    }
  }

  private renderDescriptionCard(
    img: HTMLImageElement,
    description: string,
    model: string
  ): void {
    // Remove any existing description card for this image
    const existing = img.parentElement?.querySelector('.zoodsle-description-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.className = 'zoodsle-description-card';
    card.setAttribute('data-zoodsle-ui', 'true');
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'ZoodSle Image Description');

    const header = document.createElement('div');
    header.className = 'zoodsle-description-header';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'ZoodSle Audio Description';

    const modelSpan = document.createElement('span');
    modelSpan.style.fontWeight = 'normal';
    modelSpan.style.color = '#94a3b8';
    modelSpan.textContent = model;

    header.appendChild(titleSpan);
    header.appendChild(modelSpan);

    const body = document.createElement('p');
    body.className = 'zoodsle-description-body';
    body.textContent = description;

    const actions = document.createElement('div');
    actions.className = 'zoodsle-card-actions';

    const repeatBtn = document.createElement('button');
    repeatBtn.className = 'zoodsle-card-btn';
    repeatBtn.type = 'button';
    repeatBtn.textContent = 'Repeat';
    repeatBtn.addEventListener('click', () => {
      this.narrator.speak(description, this.settings.speechRate, this.settings.speechVolume);
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'zoodsle-card-btn';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(description);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'zoodsle-card-btn';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Dismiss';
    closeBtn.addEventListener('click', () => {
      card.remove();
    });

    actions.appendChild(repeatBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(closeBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(actions);

    const postContainer = img.closest('[role="article"]') || img.parentElement || img;
    if (postContainer.nextSibling) {
      postContainer.parentElement?.insertBefore(card, postContainer.nextSibling);
    } else {
      postContainer.parentElement?.appendChild(card);
    }
  }
}

// Start content script
const controller = new ZoodSleContentController();
controller.init().catch((err) => {
  console.error('[ZoodSle] Failed to initialize content script:', err);
});
