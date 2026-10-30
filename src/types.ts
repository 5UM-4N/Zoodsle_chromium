export type ZoodSleMode = 'ondemand' | 'auto' | 'both';
export type VerbosityMode = 'concise' | 'detailed';
export type SpeechState = 'idle' | 'analyzing' | 'speaking' | 'paused';

export interface ZoodSleSettings {
  enabled: boolean;
  mode: ZoodSleMode;
  autoNarrationEnabled: boolean;
  verbosity: VerbosityMode;
  speechRate: number;
  speechVolume: number;
  backendUrl: string;
  minImageDimension: number;
  highContrast: boolean;
}

export const DEFAULT_SETTINGS: ZoodSleSettings = {
  enabled: true,
  mode: 'ondemand',
  autoNarrationEnabled: false,
  verbosity: 'concise',
  speechRate: 1.0,
  speechVolume: 1.0,
  backendUrl: 'http://127.0.0.1:1234/v1',
  minImageDimension: 180,
  highContrast: false,
};

export interface HealthResponse {
  status: 'ok' | 'degraded';
  connected: boolean;
  is_local: boolean;
  base_url: string;
  configured_model: string;
  model_available: boolean;
  available_models: string[];
  max_upload_mb: number;
  error?: string | null;
}

export interface ImageMetadata {
  format: string;
  width: number;
  height: number;
  aspect_ratio: number;
  megapixels: number;
  size_bytes: number;
  filename: string;
}

export interface DescribeResponse {
  description: string;
  mode: string;
  metadata: ImageMetadata;
  model: string;
  is_local: boolean;
  privacy_notice: string;
  image_data_url: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  image_data_url: string;
  question: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  response: string;
  model: string;
  is_local: boolean;
}

export interface EligibleImage {
  element: HTMLImageElement;
  src: string;
  signature: string;
  width: number;
  height: number;
  caption?: string;
}

export interface CachedDescription {
  signature: string;
  description: string;
  timestamp: number;
  imageDataUrl?: string;
  model?: string;
}

export interface ContentStatus {
  activeImagesDetected: number;
  lastDescription: string | null;
  lastImageDataUrl: string | null;
  speechState: SpeechState;
  queueLength: number;
  autoEnabled: boolean;
}
