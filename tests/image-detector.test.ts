import { describe, it, expect, beforeEach } from 'vitest';
import {
  isEligibleWebImage,
  isEligibleFeedImage,
  getImageSignature,
  findEligibleWebImages,
  getPrimaryFocusedWebImage,
} from '../src/image-detector';

describe('Universal Web Image Detector Logic', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('rejects tiny images below minimum dimensions threshold', () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/assets/icon.png';
    img.getBoundingClientRect = () => ({
      width: 60,
      height: 60,
      top: 100,
      bottom: 160,
      left: 0,
      right: 60,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    expect(isEligibleWebImage(img, 180)).toBe(false);
  });

  it('rejects avatar profile pictures on social platforms (Twitter, Reddit, Facebook)', () => {
    // 1. Alt-based avatar
    const img1 = document.createElement('img');
    img1.src = 'https://pbs.twimg.com/profile_images/123/pfp.jpg';
    img1.alt = "Alice's profile picture";
    img1.getBoundingClientRect = () => ({
      width: 200,
      height: 200,
      top: 100,
      bottom: 300,
      left: 0,
      right: 200,
      x: 0,
      y: 100,
      toJSON: () => {},
    });
    expect(isEligibleWebImage(img1, 180)).toBe(false);

    // 2. Class-based avatar
    const img2 = document.createElement('img');
    img2.src = 'https://redditstatic.com/avatars/avatar_default.png';
    img2.className = 'author-avatar round-avatar';
    img2.getBoundingClientRect = () => ({
      width: 140,
      height: 140,
      top: 100,
      bottom: 240,
      left: 0,
      right: 140,
      x: 0,
      y: 100,
      toJSON: () => {},
    });
    expect(isEligibleWebImage(img2, 100)).toBe(false);

    // 3. Parent author link
    const link = document.createElement('a');
    link.href = 'https://example.com/author/john-doe';
    link.rel = 'author';
    const img3 = document.createElement('img');
    img3.src = 'https://example.com/authors/john.jpg';
    link.appendChild(img3);
    document.body.appendChild(link);
    img3.getBoundingClientRect = () => ({
      width: 120,
      height: 120,
      top: 100,
      bottom: 220,
      left: 0,
      right: 120,
      x: 0,
      y: 100,
      toJSON: () => {},
    });
    expect(isEligibleWebImage(img3, 100)).toBe(false);
  });

  it('rejects static emojis, reaction icons, and tracking pixels', () => {
    const img = document.createElement('img');
    img.src = 'https://twemoji.maxcdn.com/v/14.0.2/72x72/1f600.png';
    img.getBoundingClientRect = () => ({
      width: 200,
      height: 200,
      top: 100,
      bottom: 300,
      left: 0,
      right: 200,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    expect(isEligibleWebImage(img, 180)).toBe(false);
  });

  it('rejects thin decorative separator strips or horizontal dividers', () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/line-separator.png';
    img.getBoundingClientRect = () => ({
      width: 800,
      height: 10,
      top: 100,
      bottom: 110,
      left: 0,
      right: 800,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    expect(isEligibleWebImage(img, 10)).toBe(false);
  });

  it('rejects images marked as ZoodSle extension UI', () => {
    const container = document.createElement('div');
    container.setAttribute('data-zoodsle-ui', 'true');
    const img = document.createElement('img');
    img.src = 'https://images.unsplash.com/photo-1';
    container.appendChild(img);
    document.body.appendChild(container);

    img.getBoundingClientRect = () => ({
      width: 400,
      height: 300,
      top: 100,
      bottom: 400,
      left: 0,
      right: 400,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    expect(isEligibleWebImage(img, 180)).toBe(false);
  });

  it('accepts news article hero photos, e-commerce images, and social posts', () => {
    // 1. Article / blog photo
    const imgArticle = document.createElement('img');
    imgArticle.src = 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200';
    imgArticle.alt = 'Circuit board closeup';
    document.body.appendChild(imgArticle);

    imgArticle.getBoundingClientRect = () => ({
      width: 650,
      height: 420,
      top: 150,
      bottom: 570,
      left: 30,
      right: 680,
      x: 30,
      y: 150,
      toJSON: () => {},
    });
    expect(isEligibleWebImage(imgArticle, 180)).toBe(true);

    // 2. Facebook feed photo (backwards compatible)
    const imgFB = document.createElement('img');
    imgFB.src = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/456789_123456.jpg?_nc_cat=101&ccb=1-7';
    imgFB.alt = 'Photo posted by friends';
    document.body.appendChild(imgFB);

    imgFB.getBoundingClientRect = () => ({
      width: 500,
      height: 350,
      top: 100,
      bottom: 450,
      left: 50,
      right: 550,
      x: 50,
      y: 100,
      toJSON: () => {},
    });
    expect(isEligibleFeedImage(imgFB, 180)).toBe(true);
  });

  it('extracts stable signatures across web CDNs by stripping tracking params', () => {
    // 1. Facebook CDN
    const img1 = document.createElement('img');
    img1.src = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/photo123.jpg?_nc_cat=109&ccb=1-7&oh=00_AYB3r9&oe=66F';
    expect(getImageSignature(img1)).toBe('https://scontent.xx.fbcdn.net/v/t39.30808-6/photo123.jpg');

    // 2. Generic web CDN with tracking params (utm, ref, fbclid)
    const img2 = document.createElement('img');
    img2.src = 'https://cdn.example.com/products/headphones.jpg?utm_source=twitter&utm_medium=social&fbclid=abc123456&variant=black';
    expect(getImageSignature(img2)).toBe('https://cdn.example.com/products/headphones.jpg?variant=black');
  });

  it('selects active focused image or closest to viewport center across web pages', () => {
    const img1 = document.createElement('img');
    img1.src = 'https://cdn.example.com/gallery/photo1.jpg';
    img1.tabIndex = 0;
    img1.getBoundingClientRect = () => ({
      width: 400,
      height: 300,
      top: 100,
      bottom: 400,
      left: 0,
      right: 400,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    const img2 = document.createElement('img');
    img2.src = 'https://cdn.example.com/gallery/photo2.jpg';
    img2.tabIndex = 0;
    img2.getBoundingClientRect = () => ({
      width: 400,
      height: 300,
      top: 500,
      bottom: 800,
      left: 0,
      right: 400,
      x: 0,
      y: 500,
      toJSON: () => {},
    });

    document.body.appendChild(img1);
    document.body.appendChild(img2);

    img2.focus();
    const primary = getPrimaryFocusedWebImage(180);
    expect(primary).not.toBeNull();
    expect(primary?.src).toContain('photo2.jpg');
  });
});
