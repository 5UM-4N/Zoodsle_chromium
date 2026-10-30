import { DescribeResponse, HealthResponse, ChatResponse, ChatRequest, ZoodSleSettings, DEFAULT_SETTINGS } from './types';
import { getSettings } from './storage';
import { isSafePublicImageUrl } from './url-validator';

const SYSTEM_PROMPT_CONCISE =
  'You are ZoodSle, an accessibility assistant specifically helping blind and visually impaired people ' +
  'understand photographs sent by family and friends.\n\n' +
  'Generate a CONCISE, natural verbal description of the photograph in 2 to 4 sentences:\n' +
  '1. State the central subject and overall scene immediately.\n' +
  '2. Mention key spatial relationships (left, right, center, foreground, background) and prominent colors.\n' +
  '3. If any text or writing is visible and legible, transcribe it directly inside quotation marks.\n' +
  '4. ACCURACY AND HONESTY: If any detail, background, or object is blurry, dim, cropped, or ambiguous, ' +
  'explicitly acknowledge this uncertainty. NEVER invent or hallucinate details.\n' +
  '5. NO FACIAL RECOGNITION: Do not attempt to identify or name specific people. Describe them respectfully by general visual attributes.';

const SYSTEM_PROMPT_DETAILED =
  'You are ZoodSle, an expert accessibility assistant providing a comprehensive, structured description ' +
  'of photographs for blind and visually impaired individuals.\n\n' +
  'Provide a thorough, well-organized description divided into the following clear sections:\n\n' +
  '### Overview\n' +
  'A concise 1-2 sentence description of what the photograph captures, the setting, and the primary focus.\n\n' +
  '### Primary Subjects & People\n' +
  'Describe the key subjects in detail. If people are present, describe their actions, expressions, clothing, ' +
  'and relative positioning. (Do NOT attempt facial recognition).\n\n' +
  '### Spatial Layout & Composition\n' +
  'Explain what is in the foreground, center, background, left, and right areas of the photo.\n\n' +
  '### Colors, Lighting & Atmosphere\n' +
  'Describe the color palette, lighting quality, and overall mood.\n\n' +
  '### Visible Text & Notable Objects\n' +
  'Quote any legible text verbatim in quotation marks.\n\n' +
  '### Ambiguities & Uncertainties\n' +
  'Explicitly highlight any elements that are unclear, partially obscured, cropped out, or out of focus.';

const SYSTEM_PROMPT_CHAT =
  'You are ZoodSle, an accessibility assistant answering follow-up questions from a blind or visually impaired user ' +
  'about the photograph they uploaded.\n\n' +
  '- Answer the user\'s question directly, clearly, and concisely based strictly on the visual content of the photograph.\n' +
  '- Use spatial descriptions when helpful.\n' +
  '- If the requested information is not visible, clearly state that it is not visible rather than guessing.\n' +
  '- Do NOT attempt facial recognition.';

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(parts[1]);
  const length = binary.length;
  const buffer = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  const base64 = btoa(binary);
  const mime = blob.type || 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

async function checkBackendHealth(backendUrl: string): Promise<HealthResponse> {
  const normalized = (backendUrl || DEFAULT_SETTINGS.backendUrl).replace(/\/+$/, '');
  const isDirectLmStudio = normalized.includes(':1234') || normalized.endsWith('/v1');

  if (isDirectLmStudio) {
    const target = normalized.endsWith('/v1') ? `${normalized}/models` : `${normalized}/v1/models`;
    try {
      const response = await fetch(target, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`LM Studio HTTP ${response.status}`);
      }
      const data = await response.json();
      const models = (data.data || []).map((m: any) => m.id);
      const hasModel = models.length > 0;
      const configured = models.find((m: string) => m.toLowerCase().includes('qwen') || m.toLowerCase().includes('vl')) || models[0] || 'qwen/qwen3-vl-4b';

      return {
        status: hasModel ? 'ok' : 'degraded',
        connected: true,
        is_local: true,
        base_url: normalized,
        configured_model: configured,
        model_available: hasModel,
        available_models: models,
        max_upload_mb: 10,
        error: hasModel ? null : 'No models currently loaded in LM Studio. Please load a vision model in LM Studio.',
      };
    } catch (err: any) {
      return {
        status: 'degraded',
        connected: false,
        is_local: true,
        base_url: normalized,
        configured_model: 'qwen/qwen3-vl-4b',
        model_available: false,
        available_models: [],
        max_upload_mb: 10,
        error: `Cannot connect to LM Studio at ${normalized}. Please ensure LM Studio is running and local server is started.`,
      };
    }
  }

  // Otherwise, FastAPI backend
  const target = `${normalized}/api/health`;
  const response = await fetch(target, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Backend health check failed with HTTP ${response.status}`);
  }
  return await response.json();
}

async function describeImage(
  backendUrl: string,
  src: string,
  dataUrl?: string,
  mode: 'concise' | 'detailed' = 'concise'
): Promise<DescribeResponse> {
  let blob: Blob;

  if (dataUrl && dataUrl.startsWith('data:image/')) {
    blob = dataUrlToBlob(dataUrl);
  } else {
    // Validate src against SSRF and intranet attacks
    const safety = isSafePublicImageUrl(src);
    if (!safety.safe) {
      throw new Error(`SSRF blocked: ${safety.reason}`);
    }

    // Fetch image directly using service worker's host permissions
    const imgResponse = await fetch(src, {
      cache: 'force-cache',
      credentials: 'omit', // Explicitly omit credentials for privacy
    });
    if (!imgResponse.ok) {
      throw new Error(`Failed to fetch image asset: HTTP ${imgResponse.status}`);
    }
    blob = await imgResponse.blob();
  }

  // Enforce upload size limit (10MB safety margin)
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error('Image exceeds maximum allowable size (10MB).');
  }

  const normalized = (backendUrl || DEFAULT_SETTINGS.backendUrl).replace(/\/+$/, '');
  const isDirectLmStudio = normalized.includes(':1234') || normalized.endsWith('/v1');

  if (isDirectLmStudio) {
    const base64DataUrl = dataUrl && dataUrl.startsWith('data:image/') ? dataUrl : await blobToDataUrl(blob);
    const endpoint = normalized.endsWith('/v1') ? `${normalized}/chat/completions` : `${normalized}/v1/chat/completions`;

    const systemPrompt = mode === 'detailed' ? SYSTEM_PROMPT_DETAILED : SYSTEM_PROMPT_CONCISE;
    const userPrompt = mode === 'detailed'
      ? 'Provide a comprehensive, structured description of this photograph according to your guidelines.'
      : 'Describe this photograph concisely for a visually impaired user in 2 to 4 sentences.';

    const payload = {
      model: 'qwen/qwen3-vl-4b',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: base64DataUrl } },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LM Studio error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content || 'No description returned by local AI model.';

    return {
      description: content.trim(),
      mode,
      model: completion.model || 'qwen/qwen3-vl-4b (Direct LM Studio)',
      processing_time_ms: 0,
      image_data_url: base64DataUrl,
      local_ai: true,
      metadata: {
        format: 'JPEG',
        width: 0,
        height: 0,
        aspect_ratio: 1.0,
        megapixels: 0,
        size_bytes: blob.size,
        filename: 'feed_image.jpg',
      },
    };
  }

  // Route through ZoodSle FastAPI backend
  const formData = new FormData();
  formData.append('file', blob, 'feed_image.jpg');
  formData.append('mode', mode);

  const endpoint = `${normalized}/api/describe`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = `API error ${response.status}`;
    try {
      const errJson = JSON.parse(errorText);
      message = errJson.detail || message;
    } catch {
      if (errorText) message = errorText;
    }
    throw new Error(message);
  }

  return await response.json();
}

async function chatWithImage(
  backendUrl: string,
  request: ChatRequest
): Promise<ChatResponse> {
  const normalized = (backendUrl || DEFAULT_SETTINGS.backendUrl).replace(/\/+$/, '');
  const isDirectLmStudio = normalized.includes(':1234') || normalized.endsWith('/v1');

  if (isDirectLmStudio) {
    const endpoint = normalized.endsWith('/v1') ? `${normalized}/chat/completions` : `${normalized}/v1/chat/completions`;

    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT_CHAT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is the photograph I am asking about.' },
          { type: 'image_url', image_url: { url: request.image_data_url } },
        ],
      },
    ];

    if (request.initial_description) {
      messages.push({
        role: 'assistant',
        content: request.initial_description,
      });
    }

    if (request.history && request.history.length > 0) {
      for (const msg of request.history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: request.question });

    const payload = {
      model: 'qwen/qwen3-vl-4b',
      messages,
      max_tokens: 500,
      temperature: 0.2,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LM Studio chat error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const completion = await response.json();
    const answer = completion.choices?.[0]?.message?.content || 'No response generated.';

    return {
      answer: answer.trim(),
      model: completion.model || 'qwen/qwen3-vl-4b (Direct LM Studio)',
      local_ai: true,
      error: null,
    };
  }

  // Otherwise, FastAPI backend
  const endpoint = `${normalized}/api/chat`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = `Chat error ${response.status}`;
    try {
      const errJson = JSON.parse(errorText);
      message = errJson.detail || message;
    } catch {
      if (errorText) message = errorText;
    }
    throw new Error(message);
  }

  return await response.json();
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  // Verify message sender origin to prevent external injection
  const isExtensionOrigin = sender.id === chrome.runtime.id || (Boolean(sender.url) && sender.url!.startsWith(chrome.runtime.getURL('')));
  const isTabSender = Boolean(sender.tab && sender.tab.id);
  if (!isExtensionOrigin && !isTabSender) {
    sendResponse({ ok: false, error: 'Unauthorized message sender context.' });
    return false;
  }

  (async () => {
    try {
      const settings = await getSettings();
      const backendUrl = settings.backendUrl || DEFAULT_SETTINGS.backendUrl;

      switch (message.type) {
        case 'CHECK_HEALTH': {
          const health = await checkBackendHealth(backendUrl);
          sendResponse({ ok: true, data: health });
          break;
        }

        case 'DESCRIBE_IMAGE': {
          const { src, dataUrl, mode } = message.payload || {};
          if (!src && !dataUrl) {
            sendResponse({ ok: false, error: 'No image source or data URL provided.' });
            return;
          }
          const result = await describeImage(backendUrl, src, dataUrl, mode || settings.verbosity);
          sendResponse({ ok: true, data: result });
          break;
        }

        case 'CHAT_WITH_IMAGE': {
          const chatResult = await chatWithImage(backendUrl, message.payload);
          sendResponse({ ok: true, data: chatResult });
          break;
        }

        default:
          sendResponse({ ok: false, error: `Unhandled message type: ${message.type}` });
      }
    } catch (err: any) {
      console.warn('[ZoodSle Background] Error handling message:', err);
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();

  return true; // Keep message channel open for async response
});

// Handle Chrome extension keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (!activeTab || !activeTab.id) return;

  const msgType = command === 'stop-speech' ? 'COMMAND_STOP_SPEECH' : 'COMMAND_DESCRIBE_FOCUSED';

  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: msgType });
  } catch {
    // If content script is not yet active (e.g. pre-existing tab before reload), inject it dynamically
    if (activeTab.url && (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js'],
        });
        await chrome.scripting.insertCSS({
          target: { tabId: activeTab.id },
          files: ['content.css'],
        });
        setTimeout(() => {
          if (activeTab.id) {
            chrome.tabs.sendMessage(activeTab.id, { type: msgType }).catch(() => {});
          }
        }, 150);
      } catch (injectErr) {
        console.warn('[ZoodSle Background] Injection fallback error:', injectErr);
      }
    }
  }
});
