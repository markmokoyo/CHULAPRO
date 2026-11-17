'use client';

import type { HapticCueEvent, HapticPatternType } from '@cuepulse/shared';
import type {
  WatchRemoteCommand,
  WatchRemoteCommandType,
  WatchTelemetryState,
} from '@/app/api/watch-sync/route';

const PAIR_CODE_KEY = 'cuepulse_watch_pair_code_v1';
const WATCH_CHANNEL = 'cuepulse_watch_sync_v1';

export function getOrCreateWatchPairCode(): string {
  if (typeof window === 'undefined') return '1234';
  const saved = window.localStorage.getItem(PAIR_CODE_KEY);
  if (saved && /^\d{4}$/.test(saved)) return saved;
  const generated = String(Math.floor(1000 + Math.random() * 9000));
  window.localStorage.setItem(PAIR_CODE_KEY, generated);
  return generated;
}

export function saveWatchPairCode(code: string): void {
  if (typeof window === 'undefined') return;
  if (/^\d{4}$/.test(code)) {
    window.localStorage.setItem(PAIR_CODE_KEY, code);
  }
}

export function vibrateDevice(pattern: HapticPatternType): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    const seq =
      pattern === 'SOFT_TICK'
        ? [80]
        : pattern === 'DOUBLE_PULSE'
          ? [100, 80, 100]
          : [300];
    navigator.vibrate(seq);
  } catch {
    // Ignore on browsers that restrict vibrate
  }
}

// Web Bluetooth GATT Immediate Alert Service (0x1802 / 0x2A06)
interface BluetoothRemoteGATTCharacteristicLike {
  writeValue: (value: BufferSource) => Promise<void>;
}

interface BluetoothDeviceLike {
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<{
      getPrimaryService: (uuid: number | string) => Promise<{
        getCharacteristic: (uuid: number | string) => Promise<BluetoothRemoteGATTCharacteristicLike>;
      }>;
    }>;
    disconnect: () => void;
  };
}

let connectedBleDevice: BluetoothDeviceLike | null = null;
let bleAlertCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;

export function isWebBluetoothSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'bluetooth' in navigator;
}

export function getConnectedBleDeviceName(): string | null {
  if (!connectedBleDevice?.gatt?.connected) return null;
  return connectedBleDevice.name || 'Smartwatch (BLE)';
}

export async function connectBleSmartwatch(): Promise<{
  connected: boolean;
  deviceName?: string;
  error?: string;
}> {
  if (!isWebBluetoothSupported()) {
    return {
      connected: false,
      error: 'เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth — ใช้รหัสจับคู่ 4 หลักแทนได้ครับ',
    };
  }
  try {
    const bt = (navigator as unknown as {
      bluetooth: {
        requestDevice: (opts: Record<string, unknown>) => Promise<BluetoothDeviceLike>;
      };
    }).bluetooth;
    const device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: [0x1802, 'heart_rate', 'battery_service'],
    });
    connectedBleDevice = device;
    if (device.gatt) {
      const server = await device.gatt.connect();
      try {
        const service = await server.getPrimaryService(0x1802);
        bleAlertCharacteristic = await service.getCharacteristic(0x2a06);
      } catch {
        bleAlertCharacteristic = null;
      }
    }
    return {
      connected: true,
      deviceName: device.name || 'Smartwatch (BLE)',
    };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'ยกเลิกการเชื่อมต่อ Bluetooth',
    };
  }
}

export async function sendBleAlert(pattern: HapticPatternType): Promise<void> {
  if (!bleAlertCharacteristic || !connectedBleDevice?.gatt?.connected) return;
  try {
    const level = pattern === 'SOFT_TICK' ? 1 : 2;
    await bleAlertCharacteristic.writeValue(new Uint8Array([level]));
  } catch {
    // Ignore BLE write errors so studio never stalls
  }
}

export async function pushStudioTelemetry(
  pairCode: string,
  state: Partial<WatchTelemetryState>
): Promise<WatchRemoteCommand[]> {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const ch = new BroadcastChannel(WATCH_CHANNEL);
      ch.postMessage({ type: 'studio_update', pairCode, state });
      ch.close();
    } catch {
      // ignore
    }
  }
  try {
    const res = await fetch('/api/watch-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'studio_update', pairCode, state }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { commands?: WatchRemoteCommand[] };
    return data.commands ?? [];
  } catch {
    return [];
  }
}

export async function sendWatchRemoteCommand(
  pairCode: string,
  command: WatchRemoteCommandType
): Promise<boolean> {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const ch = new BroadcastChannel(WATCH_CHANNEL);
      ch.postMessage({ type: 'watch_command', pairCode, command });
      ch.close();
    } catch {
      // ignore
    }
  }
  try {
    const res = await fetch('/api/watch-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'watch_command', pairCode, command }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pollWatchState(
  pairCode: string
): Promise<WatchTelemetryState | null> {
  try {
    const res = await fetch(`/api/watch-sync?code=${encodeURIComponent(pairCode)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { state?: WatchTelemetryState | null };
    return data.state ?? null;
  } catch {
    return null;
  }
}

export function triggerNativeAndroidWearCue(cue: HapticCueEvent): void {
  const bridge = (window as unknown as {
    CuePulseAndroid?: { sendWearCue?: (json: string) => void };
  }).CuePulseAndroid;
  if (bridge?.sendWearCue) {
    try {
      bridge.sendWearCue(JSON.stringify(cue));
    } catch {
      // ignore
    }
  }
}
