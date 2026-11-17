import { NextResponse } from 'next/server';
import type { HapticCueEvent } from '@cuepulse/shared';

export type WatchRemoteCommandType = 'NEXT_SLIDE' | 'PREV_SLIDE' | 'PING_VIBRATE';

export interface WatchRemoteCommand {
  id: string;
  type: WatchRemoteCommandType;
  createdAtMs: number;
}

export interface WatchTelemetryState {
  pairCode: string;
  isRunning: boolean;
  mode: 'solo' | 'team';
  currentSpm: number;
  slideNumber: number;
  totalSlides: number;
  remainingSeconds: number | null;
  cooldownRemainingMs: number;
  activeCue: HapticCueEvent | null;
  updatedAtMs: number;
}

interface WatchRoom {
  state: WatchTelemetryState;
  pendingCommands: WatchRemoteCommand[];
}

const ROOM_TTL_MS = 30 * 60 * 1000;
const rooms = new Map<string, WatchRoom>();

function cleanupExpiredRooms(nowMs: number) {
  for (const [code, room] of rooms.entries()) {
    if (nowMs - room.state.updatedAtMs > ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}

function getOrCreateRoom(pairCode: string): WatchRoom {
  const existing = rooms.get(pairCode);
  if (existing) return existing;
  const fresh: WatchRoom = {
    state: {
      pairCode,
      isRunning: false,
      mode: 'solo',
      currentSpm: 0,
      slideNumber: 1,
      totalSlides: 1,
      remainingSeconds: null,
      cooldownRemainingMs: 0,
      activeCue: null,
      updatedAtMs: Date.now(),
    },
    pendingCommands: [],
  };
  rooms.set(pairCode, fresh);
  return fresh;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim();
  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json(
      { error: 'รหัสจับคู่ต้องเป็นตัวเลข 4 หลัก' },
      { status: 400 }
    );
  }
  const now = Date.now();
  cleanupExpiredRooms(now);
  const room = rooms.get(code);
  return NextResponse.json({
    connected: Boolean(room),
    state: room?.state ?? null,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action: 'studio_update' | 'watch_command';
      pairCode?: string;
      state?: Partial<WatchTelemetryState>;
      command?: WatchRemoteCommandType;
    };

    const code = (body.pairCode || '').trim();
    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json(
        { error: 'รหัสจับคู่ต้องเป็นตัวเลข 4 หลัก' },
        { status: 400 }
      );
    }

    const now = Date.now();
    cleanupExpiredRooms(now);
    const room = getOrCreateRoom(code);

    if (body.action === 'studio_update') {
      room.state = {
        ...room.state,
        ...body.state,
        pairCode: code,
        updatedAtMs: now,
      };
      const commands = [...room.pendingCommands];
      room.pendingCommands = [];
      return NextResponse.json({ ok: true, commands });
    }

    if (body.action === 'watch_command' && body.command) {
      room.pendingCommands.push({
        id: `cmd-${now}-${Math.random().toString(36).slice(2, 6)}`,
        type: body.command,
        createdAtMs: now,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
