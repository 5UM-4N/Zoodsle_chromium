import { EligibleImage } from './types';

const IGNORED_URL_PATTERNS = [
  /static\.xx\.fbcdn\.net/i,
  /emoji/i,
  /emoticon/i,
  /reaction/i,
  /rsrc\.php/i,
  /twemoji/i,
  /favicon/i,
  /tracking/i,
  /pixel/i,
  /spacer\.gif/i,
  /blank\.gif/i,
  /data:image\/svg\+xml/i,
  /\/assets\/.*icon/i,
  /\/sprites?\//i,
  /\/badges?\//i,
];

const AVATAR_PATTERNS = [
  'profile picture',
  "'s profile",
  'avatar',
  'user avatar',
  'user photo',
  'user image',
  'profile photo',
  'author photo',
  'author image',
  'pfp',
  'profile pic',
  'account photo',
  'user icon',
];

const AVATAR_CLASS_PATTERNS = [
  'avatar',
  'profile-pic',
  'profile-img',
  'user-avatar',
  'author-avatar',
  'author-image',
  'pfp',
  'comment-avatar',
  'round-avatar',
  'user-thumb',
];

/**
 * Normalizes any image URL into a stable signature by stripping volatile tracking query parameters.
 */
export function getImageSignature(img: HTMLImageElement): string {
  const src = img.currentSrc || img.src;
  if (!src) return '';
  try {
    const url = new URL(src);
    // Social CDN paths (e.g. Facebook, Instagram) uniquely identify media by pathname
    if (
      url.hostname.includes('fbcdn.net') ||
      url.hostname.includes('facebook.com') ||
      url.hostname.includes('instagram.com')
    ) {
      return `${url.origin}${url.pathname}`;
    }

    const cleanParams = new URLSearchParams();
    url.searchParams.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (
        !lower.startsWith('utm_') &&
        !lower.startsWith('_nc_') &&
        !['fbclid', 'gclid', 'ref', 'token', 'sig', 'timestamp', '_', 'ver', 't', 'oh', 'oe', 'ccb'].includes(lower)
      ) {
        cleanParams.set(key, val);
      }
    });
    const qs = cleanParams.toString();
    return `${url.origin}${url.pathname}${qs ? `?${qs}` : ''}`;
  } catch {
    return src.length > 200 ? src.slice(0, 200) : src;
  }
}

/**
 * Universal web image eligibility evaluator.
 * Works across social media (Facebook, Twitter/X, Instagram, Reddit, LinkedIn),
 * news articles, blogs, e-commerce, and general web platforms.
 */
export function isEligibleWebImage(
  img: HTMLImageElement,
  minDimension = 180
): boolean {
  // Ignore images marked as ZoodSle extension UI
  if (img.closest('[data-zoodsle-ui="true"]') || img.hasAttribute('data-zoodsle-ignore')) {
    return false;
  }

  // Must have a valid src
  const src = img.currentSrc || img.src;
  if (!src || src.startsWith('data:image/svg')) {
    return false;
  }

  // Check against ignored URL patterns (emojis, icons, badges, tracking pixels)
  if (IGNORED_URL_PATTERNS.some((pattern) => pattern.test(src))) {
    return false;
  }

  // Check dimensions: both client rendering and natural dimensions
  const rect = img.getBoundingClientRect();
  const renderedWidth = rect.width;
  const renderedHeight = rect.height;

  if (renderedWidth < minDimension || renderedHeight < minDimension) {
    return false;
  }

  // If already loaded, verify natural dimensions
  if (img.complete && (img.naturalWidth < minDimension || img.naturalHeight < minDimension)) {
    return false;
  }

  // Prevent thin divider lines, extreme banners, or decorative strips
  const aspectRatio = renderedWidth / (renderedHeight || 1);
  if (aspectRatio > 8.0 || aspectRatio < 0.12) {
    return false;
  }

  // Avatar / Profile Picture textual detection
  const alt = (img.alt || '').toLowerCase();
  const ariaLabel = (img.getAttribute('aria-label') || '').toLowerCase();
  const title = (img.getAttribute('title') || '').toLowerCase();

  if (
    AVATAR_PATTERNS.some(
      (pat) => alt.includes(pat) || ariaLabel.includes(pat) || title.includes(pat)
    )
  ) {
    return false;
  }

  // Check element class names or parent classes indicating an avatar/pfp
  const imgClass = String(img.className || '').toLowerCase();
  const imgId = String(img.id || '').toLowerCase();
  if (
    renderedWidth <= 150 &&
    AVATAR_CLASS_PATTERNS.some((pat) => imgClass.includes(pat) || imgId.includes(pat))
  ) {
    return false;
  }

  // Check if inside a profile link or avatar circle container
  const parentLink = img.closest('a');
  if (parentLink) {
    const linkLabel = (parentLink.getAttribute('aria-label') || '').toLowerCase();
    const linkHref = (parentLink.getAttribute('href') || '').toLowerCase();
    const linkRel = (parentLink.getAttribute('rel') || '').toLowerCase();
    const linkClass = String(parentLink.className || '').toLowerCase();

    const isProfileLink =
      linkRel === 'author' ||
      linkLabel.includes('profile') ||
      linkLabel.includes('author') ||
      linkHref.includes('/user/') ||
      linkHref.includes('/profile/') ||
      linkHref.includes('/author/') ||
      linkHref.includes('/u/') ||
      linkHref.includes('/stories/') ||
      AVATAR_CLASS_PATTERNS.some((pat) => linkClass.includes(pat));

    if (isProfileLink && renderedWidth <= 150) {
      return false;
    }
  }

  // Visibility checks
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }

  const style = window.getComputedStyle ? window.getComputedStyle(img) : null;
  if (style) {
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
  }

  return true;
}

// Backward-compatibility alias
export const isEligibleFeedImage = isEligibleWebImage;

export function isElementInViewport(el: Element, thresholdRatio = 0.5): boolean {
  const rect = el.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  // Fully outside bounds
  if (rect.bottom < 0 || rect.top > windowHeight || rect.right < 0 || rect.left > windowWidth) {
    return false;
  }

  // Calculate visible vertical height
  const visibleTop = Math.max(0, rect.top);
  const visibleBottom = Math.min(windowHeight, rect.bottom);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);

  return visibleHeight >= rect.height * thresholdRatio;
}

export function findEligibleWebImages(
  root: Document | Element = document,
  minDimension = 180
): EligibleImage[] {
  const images = root.querySelectorAll<HTMLImageElement>('img');
  const results: EligibleImage[] = [];

  images.forEach((img) => {
    if (isEligibleWebImage(img, minDimension)) {
      const signature = getImageSignature(img);
      const rect = img.getBoundingClientRect();
      results.push({
        element: img,
        src: img.currentSrc || img.src,
        signature,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
  });

  return results;
}

// Backward-compatibility alias
export const findEligibleFeedImages = findEligibleWebImages;

/**
 * Finds the single most focused or central eligible image in the user's viewport on any website.
 */
export function getPrimaryFocusedWebImage(minDimension = 180): EligibleImage | null {
  // First check if an image or its parent has keyboard focus
  const active = document.activeElement;
  if (active) {
    if (active.tagName.toLowerCase() === 'img' && isEligibleWebImage(active as HTMLImageElement, minDimension)) {
      const img = active as HTMLImageElement;
      const rect = img.getBoundingClientRect();
      return {
        element: img,
        src: img.currentSrc || img.src,
        signature: getImageSignature(img),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }

    const insideImg = active.querySelector<HTMLImageElement>('img');
    if (insideImg && isEligibleWebImage(insideImg, minDimension)) {
      const rect = insideImg.getBoundingClientRect();
      return {
        element: insideImg,
        src: insideImg.currentSrc || insideImg.src,
        signature: getImageSignature(insideImg),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }
  }

  // Otherwise, find the image closest to the vertical center of the viewport
  const images = findEligibleWebImages(document, minDimension);
  if (images.length === 0) return null;

  const windowCenterY = (window.innerHeight || document.documentElement.clientHeight) / 2;
  let bestCandidate: EligibleImage | null = null;
  let smallestDistance = Infinity;

  for (const item of images) {
    const rect = item.element.getBoundingClientRect();
    const itemCenterY = rect.top + rect.height / 2;
    const distance = Math.abs(windowCenterY - itemCenterY);

    if (isElementInViewport(item.element, 0.3) && distance < smallestDistance) {
      smallestDistance = distance;
      bestCandidate = item;
    }
  }

  return bestCandidate;
}

// Backward-compatibility alias
export const getPrimaryFocusedFeedImage = getPrimaryFocusedWebImage;
