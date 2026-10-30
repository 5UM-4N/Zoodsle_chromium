/**
 * Platform and Device detection for keyboard shortcuts and accessible labels.
 */

export interface DeviceShortcuts {
  isMac: boolean;
  describeShortcutLabel: string;
  stopShortcutLabel: string;
}

export function getDeviceShortcuts(): DeviceShortcuts {
  const isMac =
    typeof navigator !== 'undefined' &&
    (/Mac|iPhone|iPad|iPod/.test(navigator.platform || '') ||
      /Macintosh|Mac OS X/.test(navigator.userAgent || ''));

  return {
    isMac,
    describeShortcutLabel: isMac ? '⌥⇧D' : 'Alt+Shift+D',
    stopShortcutLabel: isMac ? '⌥⇧S' : 'Alt+Shift+S',
  };
}

/**
 * Checks if a keydown event matches the "Describe focused image" shortcut across devices.
 * On macOS:
 *  - Option+Shift+D produces e.code='KeyD', e.altKey=true, e.shiftKey=true, e.key='Î'
 *  - Cmd+Shift+D produces e.code='KeyD', e.metaKey=true, e.shiftKey=true
 * On Windows/Linux:
 *  - Alt+Shift+D produces e.code='KeyD', e.altKey=true, e.shiftKey=true
 *  - Ctrl+Shift+D produces e.code='KeyD', e.ctrlKey=true, e.shiftKey=true
 */
export function isDescribeKeyCombo(e: KeyboardEvent): boolean {
  const isKeyD =
    e.code === 'KeyD' ||
    e.key === 'D' ||
    e.key === 'd' ||
    e.key === 'Î' ||
    e.key === '∂';

  const hasModifier =
    (e.altKey && e.shiftKey) ||
    (e.metaKey && e.shiftKey) ||
    (e.ctrlKey && e.shiftKey);

  return isKeyD && hasModifier;
}

/**
 * Checks if a keydown event matches the "Stop speech narration" shortcut across devices.
 * Supports Option+Shift+S, Cmd+Shift+S, Alt+Shift+S, Ctrl+Shift+S.
 */
export function isStopSpeechKeyCombo(e: KeyboardEvent): boolean {
  const isKeyS =
    e.code === 'KeyS' ||
    e.key === 'S' ||
    e.key === 's' ||
    e.key === 'Í' ||
    e.key === 'ß';

  const hasModifier =
    (e.altKey && e.shiftKey) ||
    (e.metaKey && e.shiftKey) ||
    (e.ctrlKey && e.shiftKey);

  return isKeyS && hasModifier;
}
