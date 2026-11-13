'use client';

/**
 * Global round countdown (timestamp-based, synced via server offset).
 */

import { Timer } from 'lucide-react';
import { useCountdown, type OffsetRef } from '@/components/idclash/use-countdown';
import { fmtClock } from '@/lib/idclash/format';

interface GlobalTimerProps {
  endsAt: number | null;
  offsetRef: OffsetRef;
}

export function GlobalTimer({ endsAt, offsetRef }: GlobalTimerProps) {
  const left = useCountdown(endsAt, offsetRef);
  if (left == null) return null;

  const danger = left < 60_000;
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
        danger ? 'border-rose-500/50 text-rose-400' : 'border-emerald-500/50 text-emerald-400'
      }`}
      role="timer"
      aria-label={`الوقت المتبقي للجولة ${fmtClock(left)}`}
    >
      <Timer className={`h-4 w-4 ${danger ? 'animate-pulse' : ''}`} aria-hidden="true" />
      <span className="num text-lg font-black leading-none">{fmtClock(left)}</span>
    </div>
  );
}
