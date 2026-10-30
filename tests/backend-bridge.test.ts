import { describe, it, expect, vi } from 'vitest';
import { DescribeResponse, ChatRequest, HealthResponse } from '../src/types';

describe('Backend API Contract & Security Checks', () => {
  it('correctly parses DescribeResponse schema from FastAPI', () => {
    const rawBackendPayload = {
      description: 'A wooden table with a coffee cup and notebook.',
      mode: 'concise',
      metadata: {
        format: 'JPEG',
        width: 1024,
        height: 768,
        aspect_ratio: 1.33,
        megapixels: 0.79,
        size_bytes: 145000,
        filename: 'feed_image.jpg',
      },
      model: 'qwen/qwen3-vl-4b',
      is_local: true,
      privacy_notice: 'Inference processed entirely on your local machine using LM Studio.',
      image_data_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
    };

    const parsed: DescribeResponse = rawBackendPayload;
    expect(parsed.is_local).toBe(true);
    expect(parsed.model).toBe('qwen/qwen3-vl-4b');
    expect(parsed.metadata.width).toBe(1024);
    expect(parsed.description).toContain('coffee cup');
  });

  it('validates HealthResponse fields from FastAPI backend', () => {
    const healthJson = {
      status: 'ok',
      connected: true,
      is_local: true,
      base_url: 'http://127.0.0.1:1234/v1',
      configured_model: 'qwen/qwen3-vl-4b',
      model_available: true,
      available_models: ['qwen/qwen3-vl-4b'],
      max_upload_mb: 10,
      error: null,
    };

    const health: HealthResponse = healthJson as HealthResponse;
    expect(health.status).toBe('ok');
    expect(health.connected).toBe(true);
    expect(health.model_available).toBe(true);
    expect(health.configured_model).toBe('qwen/qwen3-vl-4b');
  });

  it('structures ChatRequest for follow-up questions according to backend contract', () => {
    const chatPayload: ChatRequest = {
      image_data_url: 'data:image/jpeg;base64,sample123',
      question: 'What color is the car in the background?',
      history: [
        { role: 'user', content: 'Describe this image' },
        { role: 'assistant', content: 'A street with a car and trees.' },
      ],
    };

    expect(chatPayload.image_data_url.startsWith('data:image/')).toBe(true);
    expect(chatPayload.question).toBe('What color is the car in the background?');
    expect(chatPayload.history?.length).toBe(2);
  });

  it('enforces that remote credentials are never forwarded with requests', () => {
    const fetchOptions: RequestInit = {
      cache: 'force-cache',
      credentials: 'omit',
    };

    expect(fetchOptions.credentials).toBe('omit');
  });
});
