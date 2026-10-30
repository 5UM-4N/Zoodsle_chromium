import { DEFAULT_SETTINGS, HealthResponse, ZoodSleSettings } from './types';
import { getSettings, saveSettings } from './storage';

document.addEventListener('DOMContentLoaded', async () => {
  const backendUrlInput = document.getElementById('backendUrlInput') as HTMLInputElement;
  const minDimensionInput = document.getElementById('minDimensionInput') as HTMLInputElement;
  const speechVolumeInput = document.getElementById('speechVolumeInput') as HTMLInputElement;
  const volumeValue = document.getElementById('volumeValue') as HTMLElement;
  const testConnectionBtn = document.getElementById('testConnectionBtn') as HTMLButtonElement;
  const testConnectionResult = document.getElementById('testConnectionResult') as HTMLElement;
  const clearCacheBtn = document.getElementById('clearCacheBtn') as HTMLButtonElement;
  const clearCacheResult = document.getElementById('clearCacheResult') as HTMLElement;
  const saveStatus = document.getElementById('saveStatus') as HTMLElement;

  // 1. Populate form
  let currentSettings: ZoodSleSettings = await getSettings();

  function renderForm(settings: ZoodSleSettings): void {
    backendUrlInput.value = settings.backendUrl;
    minDimensionInput.value = String(settings.minImageDimension);
    speechVolumeInput.value = String(settings.speechVolume);
    volumeValue.textContent = `${Math.round(settings.speechVolume * 100)}%`;
  }

  renderForm(currentSettings);

  function notifySave(): void {
    saveStatus.textContent = 'Settings saved.';
    saveStatus.style.color = '#38bdf8';
    setTimeout(() => {
      saveStatus.textContent = 'All changes saved automatically.';
      saveStatus.style.color = '#64748b';
    }, 2000);
  }

  // 2. Auto-save on changes
  backendUrlInput.addEventListener('change', async () => {
    let url = backendUrlInput.value.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }
    currentSettings = await saveSettings({ backendUrl: url });
    notifySave();
  });

  minDimensionInput.addEventListener('change', async () => {
    const val = parseInt(minDimensionInput.value, 10);
    if (!isNaN(val) && val >= 50) {
      currentSettings = await saveSettings({ minImageDimension: val });
      notifySave();
    }
  });

  speechVolumeInput.addEventListener('input', () => {
    const vol = parseFloat(speechVolumeInput.value);
    volumeValue.textContent = `${Math.round(vol * 100)}%`;
  });

  speechVolumeInput.addEventListener('change', async () => {
    const vol = parseFloat(speechVolumeInput.value);
    currentSettings = await saveSettings({ speechVolume: vol });
    notifySave();
  });

  // 3. Test Connection Button
  testConnectionBtn.addEventListener('click', async () => {
    testConnectionResult.className = 'test-result';
    testConnectionResult.textContent = 'Testing connection...';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' });
      if (response && response.ok && response.data) {
        const data: HealthResponse = response.data;
        if (data.connected && data.model_available) {
          testConnectionResult.className = 'test-result success';
          testConnectionResult.textContent = `Connected! Model: ${data.configured_model} (Local: ${data.is_local})`;
        } else if (data.connected && !data.model_available) {
          testConnectionResult.className = 'test-result error';
          testConnectionResult.textContent = `LM Studio connected, but model '${data.configured_model}' is not loaded.`;
        } else {
          testConnectionResult.className = 'test-result error';
          testConnectionResult.textContent = `Failed: ${data.error || 'LM Studio is unreachable.'}`;
        }
      } else {
        throw new Error(response?.error || 'No response from service worker.');
      }
    } catch (err: any) {
      testConnectionResult.className = 'test-result error';
      testConnectionResult.textContent = `Connection error: ${err.message || String(err)}`;
    }
  });

  // 4. Reset Settings Button
  clearCacheBtn.addEventListener('click', async () => {
    if (confirm('Reset all ZoodSle settings to their default values?')) {
      await saveSettings(DEFAULT_SETTINGS);
      currentSettings = { ...DEFAULT_SETTINGS };
      renderForm(currentSettings);
      clearCacheResult.className = 'test-result success';
      clearCacheResult.textContent = 'All settings reset to defaults.';
      setTimeout(() => {
        clearCacheResult.textContent = '';
      }, 3000);
    }
  });
});
