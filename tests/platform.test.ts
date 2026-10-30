import { describe, it, expect } from 'vitest';
import {
  isDescribeKeyCombo,
  isStopSpeechKeyCombo,
  getDeviceShortcuts,
} from '../src/platform';

describe('Platform and Device Shortcut Heuristics', () => {
  it('detects macOS and returns device-appropriate labels', () => {
    const shortcuts = getDeviceShortcuts();
    expect(shortcuts).toHaveProperty('isMac');
    expect(shortcuts).toHaveProperty('describeShortcutLabel');
    expect(shortcuts).toHaveProperty('stopShortcutLabel');
  });

  it('triggers describe on macOS Option+Shift+D even when key transforms to diacritic Î', () => {
    // When Option+Shift+D is pressed on macOS US keyboard layout:
    const macOptionShiftD = new KeyboardEvent('keydown', {
      code: 'KeyD',
      key: 'Î',
      altKey: true,
      shiftKey: true,
      bubbles: true,
    });
    expect(isDescribeKeyCombo(macOptionShiftD)).toBe(true);
  });

  it('triggers describe on macOS Cmd+Shift+D', () => {
    const macCmdShiftD = new KeyboardEvent('keydown', {
      code: 'KeyD',
      key: 'D',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    });
    expect(isDescribeKeyCombo(macCmdShiftD)).toBe(true);
  });

  it('triggers describe on Windows / Linux Alt+Shift+D', () => {
    const winAltShiftD = new KeyboardEvent('keydown', {
      code: 'KeyD',
      key: 'D',
      altKey: true,
      shiftKey: true,
      bubbles: true,
    });
    expect(isDescribeKeyCombo(winAltShiftD)).toBe(true);
  });

  it('triggers stop speech on Option+Shift+S (diacritic Í) and Alt+Shift+S', () => {
    const macOptionShiftS = new KeyboardEvent('keydown', {
      code: 'KeyS',
      key: 'Í',
      altKey: true,
      shiftKey: true,
      bubbles: true,
    });
    expect(isStopSpeechKeyCombo(macOptionShiftS)).toBe(true);

    const winAltShiftS = new KeyboardEvent('keydown', {
      code: 'KeyS',
      key: 'S',
      altKey: true,
      shiftKey: true,
      bubbles: true,
    });
    expect(isStopSpeechKeyCombo(winAltShiftS)).toBe(true);
  });

  it('does not trigger when modifiers are missing', () => {
    const plainD = new KeyboardEvent('keydown', {
      code: 'KeyD',
      key: 'd',
      altKey: false,
      shiftKey: false,
    });
    expect(isDescribeKeyCombo(plainD)).toBe(false);

    const shiftOnlyD = new KeyboardEvent('keydown', {
      code: 'KeyD',
      key: 'D',
      altKey: false,
      shiftKey: true,
    });
    expect(isDescribeKeyCombo(shiftOnlyD)).toBe(false);
  });
});
