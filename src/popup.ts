import { getSettings, saveSettings } from './storage';
import { ZoodSleMode, VerbosityMode, HealthResponse } from './types';
import { getDeviceShortcuts } from './platform';

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const masterToggle = document.getElementById('masterToggle') as HTMLInputElement;
  const statusDot = document.getElementById('statusDot') as HTMLElement;
  const statusText = document.getElementById('statusText') as HTMLElement;
  const refreshHealthBtn = document.getElementById('refreshHealthBtn') as HTMLButtonElement;
  const troubleshootAlert = document.getElementById('troubleshootAlert') as HTMLElement;
  const troubleshootMsg = document.getElementById('troubleshootMsg') as HTMLElement;

  const modeRadios = document.querySelectorAll<HTMLInputElement>('input[name="zoodsleMode"]');
  const autoToggle = document.getElementById('autoToggle') as HTMLInputElement;
  const verbositySelect = document.getElementById('verbositySelect') as HTMLSelectElement;
  const speedSlider = document.getElementById('speedSlider') as HTMLInputElement;
  const speedValue = document.getElementById('speedValue') as HTMLElement;

  const describeNowBtn = document.getElementById('describeNowBtn') as HTMLButtonElement;
  const repeatBtn = document.getElementById('repeatBtn') as HTMLButtonElement;
  const pauseResumeBtn = document.getElementById('pauseResumeBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;

  const descEmptyText = document.getElementById('descEmptyText') as HTMLElement;
  const descContent = document.getElementById('descContent') as HTMLElement;
  const latestDescriptionText = document.getElementById('latestDescriptionText') as HTMLElement;
  const descModelBadge = document.getElementById('descModelBadge') as HTMLElement;
  const descTime = document.getElementById('descTime') as HTMLElement;

  const chatForm = document.getElementById('chatForm') as HTMLFormElement;
  const chatInput = document.getElementById('chatInput') as HTMLInputElement;
  const chatSubmitBtn = document.getElementById('chatSubmitBtn') as HTMLButtonElement;
  const chatAnswer = document.getElementById('chatAnswer') as HTMLElement;

  let currentImageDataUrl: string | null = null;

  // 1. Load initial settings
  const settings = await getSettings();
  masterToggle.checked = settings.enabled;
  autoToggle.checked = settings.autoNarrationEnabled;
  verbositySelect.value = settings.verbosity;
  speedSlider.value = String(settings.speechRate);
  speedValue.textContent = `${settings.speechRate.toFixed(2)}x`;

  modeRadios.forEach((radio) => {
    radio.checked = radio.value === settings.mode;
  });

  const shortcuts = getDeviceShortcuts();
  descEmptyText.textContent = `No photo described yet. Press ${shortcuts.describeShortcutLabel} on any webpage or select "Describe Focused".`;
  describeNowBtn.title = `Describe Focused (${shortcuts.describeShortcutLabel})`;
  repeatBtn.title = `Repeat Description (${shortcuts.describeShortcutLabel})`;
  stopBtn.title = `Stop Speech (${shortcuts.stopShortcutLabel})`;

  // 2. Health check function
  async function checkHealth(): Promise<void> {
    statusDot.className = 'status-dot checking';
    statusText.textContent = 'Checking local AI backend...';
    troubleshootAlert.style.display = 'none';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' });
      if (response && response.ok && response.data) {
        const data: HealthResponse = response.data;
        if (data.connected && data.model_available) {
          statusDot.className = 'status-dot connected';
          statusText.textContent = `Connected (${data.configured_model || 'Local Model'})`;
        } else if (data.connected && !data.model_available) {
          statusDot.className = 'status-dot checking';
          statusText.textContent = 'LM Studio online, but model not loaded';
          troubleshootMsg.textContent = `Model '${data.configured_model}' not found in LM Studio.`;
          troubleshootAlert.style.display = 'block';
        } else {
          statusDot.className = 'status-dot disconnected';
          statusText.textContent = 'Backend offline or LM Studio unreachable';
          troubleshootMsg.textContent = data.error || 'FastAPI backend reported LM Studio connection failure.';
          troubleshootAlert.style.display = 'block';
        }
      } else {
        throw new Error(response?.error || 'No response from background worker.');
      }
    } catch (err: any) {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'ZoodSle backend not reachable';
      troubleshootMsg.textContent = err.message || 'Ensure FastAPI is running on http://127.0.0.1:8000';
      troubleshootAlert.style.display = 'block';
    }
  }

  // 3. Sync Settings changes
  async function updateSettings(partial: Record<string, any>): Promise<void> {
    const updated = await saveSettings(partial);
    // Notify active tabs
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SETTINGS_UPDATED',
        settings: updated,
      }).catch(() => {});
    }
  }

  masterToggle.addEventListener('change', () => {
    updateSettings({ enabled: masterToggle.checked });
  });

  modeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        updateSettings({ mode: radio.value as ZoodSleMode });
      }
    });
  });

  autoToggle.addEventListener('change', () => {
    updateSettings({ autoNarrationEnabled: autoToggle.checked });
  });

  verbositySelect.addEventListener('change', () => {
    updateSettings({ verbosity: verbositySelect.value as VerbosityMode });
  });

  speedSlider.addEventListener('input', () => {
    const rate = parseFloat(speedSlider.value);
    speedValue.textContent = `${rate.toFixed(2)}x`;
  });

  speedSlider.addEventListener('change', () => {
    const rate = parseFloat(speedSlider.value);
    updateSettings({ speechRate: rate });
  });

  refreshHealthBtn.addEventListener('click', checkHealth);

  // 4. Playback controls
  async function sendTabCommand(type: string): Promise<any> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return;
    return chrome.tabs.sendMessage(tabs[0].id, { type }).catch(() => {});
  }

  describeNowBtn.addEventListener('click', async () => {
    await sendTabCommand('COMMAND_DESCRIBE_FOCUSED');
    setTimeout(loadRecentResult, 1200);
  });

  repeatBtn.addEventListener('click', () => {
    sendTabCommand('COMMAND_REPEAT_SPEECH');
  });

  function setPauseResumeState(isPaused: boolean) {
    pauseResumeBtn.textContent = '';
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = isPaused ? '▶' : '⏸';
    pauseResumeBtn.appendChild(icon);
    pauseResumeBtn.appendChild(document.createTextNode(isPaused ? ' Resume' : ' Pause'));
  }

  pauseResumeBtn.addEventListener('click', async () => {
    const res = await sendTabCommand('COMMAND_PAUSE_RESUME_SPEECH');
    setPauseResumeState(res?.state === 'paused');
  });

  stopBtn.addEventListener('click', () => {
    sendTabCommand('COMMAND_STOP_SPEECH');
    setPauseResumeState(false);
  });

  // 5. Load Recent Description from storage
  async function loadRecentResult(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const res = await chrome.storage.local.get('zoodsle_last_result');
    const result = res?.zoodsle_last_result;
    if (result && result.description) {
      descEmptyText.style.display = 'none';
      descContent.style.display = 'block';
      latestDescriptionText.textContent = result.description;
      descModelBadge.textContent = result.model || 'Local Model';

      if (result.timestamp) {
        const timeAgo = Math.round((Date.now() - result.timestamp) / 1000);
        descTime.textContent = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.round(timeAgo / 60)}m ago`;
      }

      if (result.imageDataUrl) {
        currentImageDataUrl = result.imageDataUrl;
        chatForm.style.display = 'block';
      }
    } else {
      descEmptyText.style.display = 'block';
      descContent.style.display = 'none';
      chatForm.style.display = 'none';
    }
  }

  // 6. Follow-up Chat Form
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = chatInput.value.trim();
    if (!question || !currentImageDataUrl) return;

    chatSubmitBtn.disabled = true;
    chatSubmitBtn.textContent = '...';
    chatAnswer.style.display = 'block';
    chatAnswer.textContent = 'Thinking...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_WITH_IMAGE',
        payload: {
          image_data_url: currentImageDataUrl,
          question,
        },
      });

      if (response && response.ok && response.data) {
        const answer = response.data.response;
        chatAnswer.textContent = answer;
        chatInput.value = '';
      } else {
        chatAnswer.textContent = `Error: ${response?.error || 'Unable to generate answer.'}`;
      }
    } catch (err: any) {
      chatAnswer.textContent = `Request failed: ${err.message || String(err)}`;
    } finally {
      chatSubmitBtn.disabled = false;
      chatSubmitBtn.textContent = 'Ask';
    }
  });

  // Initial runs
  checkHealth();
  loadRecentResult();
});
