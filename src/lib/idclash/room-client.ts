/**
 * ID Clash — realtime room client.
 * Thin socket.io wrapper exposing an ack-based request API and a
 * snapshot stream (the Firestore onSnapshot equivalent for this game).
 */

'use client';

import { io, type Socket } from 'socket.io-client';
import { REALTIME } from './realtime-config';
import type { RoomState } from './types';

export interface AckResponse {
  ok: boolean;
  error?: string;
  code?: string;
  playerId?: string;
  correct?: boolean;
  similarity?: number;
  remaining?: number;
}

export interface RoomClientApi {
  request(event: string, payload?: Record<string, unknown>): Promise<AckResponse>;
  isConnected(): boolean;
  disconnect(): void;
}

export interface RoomClientHandlers {
  /** Fires for every authoritative state snapshot pushed by the server. */
  onState: (state: RoomState) => void;
  /** Fires on connect / reconnect / disconnect. */
  onConnected: (up: boolean) => void;
}

export function createRoomClient(handlers: RoomClientHandlers): RoomClientApi {
  const socket: Socket = io(REALTIME.socketUrl(), {
    transports: [...REALTIME.TRANSPORTS],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on(REALTIME.EVENTS.STATE, (state: RoomState) => handlers.onState(state));
  socket.on('connect', () => handlers.onConnected(true));
  socket.on('disconnect', () => handlers.onConnected(false));

  return {
    request(event, payload) {
      return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve({ ok: false, error: 'انتهت مهلة الرد من الخادم — حاول مجدداً' });
          }
        }, REALTIME.ACK_TIMEOUT_MS);

        socket.emit(event, payload ?? {}, (res: AckResponse | undefined) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            resolve(res ?? { ok: false, error: 'لا يوجد رد من الخادم' });
          }
        });
      });
    },
    isConnected: () => socket.connected,
    disconnect() {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

/** Ping the Next.js bootstrap API so the realtime mini-service is up. */
export function ensureRealtimeService(): Promise<boolean> {
  return fetch('/api/rt-bootstrap', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d: { ready?: boolean }) => Boolean(d?.ready))
    .catch(() => false);
}

/* ---------------- local persistence (rejoin support) ---------------- */

const PLAYER_ID_KEY = 'idclash:playerId';
const ROOM_KEY = 'idclash:room';

export function getPlayerId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getStoredRoom(): { code: string; playerId: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ROOM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; playerId?: string };
    if (parsed?.code && parsed?.playerId) return { code: parsed.code, playerId: parsed.playerId };
    return null;
  } catch {
    return null;
  }
}

export function setStoredRoom(code: string, playerId: string): void {
  try {
    window.sessionStorage.setItem(ROOM_KEY, JSON.stringify({ code, playerId }));
  } catch {
    /* storage unavailable */
  }
}

export function clearStoredRoom(): void {
  try {
    window.sessionStorage.removeItem(ROOM_KEY);
  } catch {
    /* storage unavailable */
  }
}
