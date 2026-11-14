'use client';

/**
 * ID Clash — root game orchestrator.
 * Owns the realtime client, the authoritative snapshot state, the
 * server-clock offset and view switching. Views are pure and receive
 * callbacks; every mutation round-trips through the server.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Shield, WifiOff } from 'lucide-react';
import { REALTIME } from '@/lib/idclash/realtime-config';
import {
  clearStoredRoom,
  createRoomClient,
  ensureRealtimeService,
  getStoredRoom,
  setStoredRoom,
  type AckResponse,
  type RoomClientApi,
} from '@/lib/idclash/room-client';
import type { AnswerType, RoomState } from '@/lib/idclash/types';
import { useToast } from '@/hooks/use-toast';
import LobbyView from './views/LobbyView';
import RoomView from './views/RoomView';
import PrepView from './views/PrepView';
import GameView from './views/GameView';

type ViewKey = 'lobby' | 'room' | 'prep' | 'game';

export default function IdClashGame() {
  const [snap, setSnap] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const clientRef = useRef<RoomClientApi | null>(null);
  const offsetRef = useRef(0);
  const { toast } = useToast();

  /* ---------- realtime lifecycle ---------- */
  useEffect(() => {
    let cancelled = false;
    let client: RoomClientApi | null = null;

    const run = async () => {
      await ensureRealtimeService();
      if (cancelled) return;
      client = createRoomClient({
        onState: (state: RoomState) => {
          offsetRef.current = state.serverTime - Date.now();
          setSnap(state);
          if (state?.code && state?.me?.id) setStoredRoom(state.code, state.me.id);
        },
        onConnected: (up) => {
          setConnected(up);
          if (!up || !client) return;
          // Rejoin flow: session refresh or socket drop -> restore seat.
          const stored = getStoredRoom();
          if (!stored) return;
          void client.request(REALTIME.EVENTS.REJOIN, stored).then((res) => {
            if (res && !res.ok) {
              clearStoredRoom();
              setSnap(null);
              toast({
                title: 'انتهت صلاحية الغرفة',
                description: 'تعذر إعادة الانضمام إلى المباراة السابقة — عُد إلى اللوبي وابدأ مباراة جديدة.',
                variant: 'destructive',
              });
            }
          });
        },
      });
      clientRef.current = client;
      setBooting(false);
    };

    void run();

    return () => {
      cancelled = true;
      // Clear all listeners and timers on unmount (room exit / game end).
      client?.disconnect();
      clientRef.current = null;
    };
  }, [toast]);

  /* ---------- action plumbing ---------- */
  const call = useCallback(
    async (event: string, payload?: Record<string, unknown>): Promise<AckResponse> => {
      const client = clientRef.current;
      if (!client) return { ok: false, error: 'جاري الاتصال بالخادم... انتظر لحظة' };
      setBusy(true);
      try {
        const res = await client.request(event, payload);
        if (!res.ok && res.error) {
          toast({ title: 'تعذّر تنفيذ العملية', description: res.error, variant: 'destructive' });
        }
        return res;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const onCreateRoom = useCallback(
    async (name: string, durationMin: number) => {
      const res = await call(REALTIME.EVENTS.CREATE, { name, durationMin });
      if (res.ok && res.code && res.playerId) setStoredRoom(res.code, res.playerId);
    },
    [call],
  );

  const onJoinRoom = useCallback(
    async (name: string, code: string) => {
      const res = await call(REALTIME.EVENTS.JOIN, { name, code });
      if (res.ok && res.code && res.playerId) setStoredRoom(res.code, res.playerId);
    },
    [call],
  );

  const onLeave = useCallback(async () => {
    await call(REALTIME.EVENTS.LEAVE);
    clearStoredRoom();
    setSnap(null);
  }, [call]);

  const onStartPrep = useCallback(() => call(REALTIME.EVENTS.START_PREP), [call]);

  const onLockIdentity = useCallback(
    (name: string, category: string) => call(REALTIME.EVENTS.LOCK, { name, category }),
    [call],
  );

  const onAsk = useCallback((text: string) => call(REALTIME.EVENTS.ASK, { text }), [call]);

  const onAnswer = useCallback(
    (type: AnswerType) => call(REALTIME.EVENTS.ANSWER, { type }),
    [call],
  );

  const onUsePowerup = useCallback(
    (cardId: string) => call(REALTIME.EVENTS.POWERUP, { cardId }),
    [call],
  );

  const onGuess = useCallback((name: string) => call(REALTIME.EVENTS.GUESS, { name }), [call]);

  /* ---------- view routing ---------- */
  const view: ViewKey = !snap
    ? 'lobby'
    : snap.status === 'waiting'
      ? 'room'
      : snap.status === 'prep'
        ? 'prep'
        : 'game';

  return (
    <div className="idclash-root bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-extrabold">ID Clash</p>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                معركة الهويات السرية — 1 ضد 1
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'animate-pulse bg-rose-500'}`}
              aria-hidden="true"
            />
            <span>{connected ? 'متصل بالخادم' : 'جاري إعادة الاتصال...'}</span>
            {snap ? (
              <span className="num rounded-md border px-2 py-0.5 font-mono text-[11px] tracking-widest">
                {snap.code}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <main className="idclash-main">
        <div id="view-lobby" className={`view ${view === 'lobby' ? 'active' : ''}`} role="region" aria-label="اللوبي">
          <LobbyView
            busy={busy || booting || !connected}
            onCreateRoom={onCreateRoom}
            onJoinRoom={onJoinRoom}
          />
        </div>
        <div id="view-room" className={`view ${view === 'room' ? 'active' : ''}`} role="region" aria-label="غرفة الانتظار">
          {snap ? <RoomView snap={snap} busy={busy} onStartPrep={onStartPrep} onLeave={onLeave} /> : null}
        </div>
        <div id="view-prep" className={`view ${view === 'prep' ? 'active' : ''}`} role="region" aria-label="مرحلة إعداد الهوية السرية">
          {snap ? <PrepView snap={snap} busy={busy} onLockIdentity={onLockIdentity} onLeave={onLeave} /> : null}
        </div>
        <div id="view-game" className={`view ${view === 'game' ? 'active' : ''}`} role="region" aria-label="ساحة المباراة">
          {snap ? (
            <GameView
              snap={snap}
              offsetRef={offsetRef}
              busy={busy}
              onLeave={onLeave}
              onAsk={onAsk}
              onAnswer={onAnswer}
              onUsePowerup={onUsePowerup}
              onGuess={onGuess}
            />
          ) : null}
        </div>
      </main>

      <footer className="idclash-footer border-t py-3">
        <p className="text-center text-xs text-muted-foreground">
          ID Clash — لعبة استنتاج وتخمين في الوقت الفعلي · شارك الكود، أخفِ هويتك، وخمّن شخصية خصمك قبل نهاية الوقت
        </p>
      </footer>

      {!connected && !booting ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-lg">
            <WifiOff className="h-8 w-8 text-rose-500" aria-hidden="true" />
            <p className="text-sm font-bold">انقطع الاتصال بالخادم</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              جاري إعادة المحاولة تلقائياً... عند عودة الاتصال سيتم استئناف مقعدك في المباراة من نفس النقطة.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
