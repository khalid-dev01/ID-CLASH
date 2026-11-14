'use client';

/**
 * Countdown hook driven by an authoritative server timestamp plus a
 * server-clock offset ref. Re-renders every 250ms while the target is set.
 */

import { useEffect, useState } from 'react';

export interface OffsetRef {
  current: number;
}

export function useCountdown(
  targetAt: number | null | undefined,
  offsetRef: OffsetRef,
): number | null {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (targetAt == null) return;
    const iv = window.setInterval(() => forceTick((t) => (t + 1) % 1000000), 250);
    return () => window.clearInterval(iv);
  }, [targetAt]);

  if (targetAt == null) return null;
  return Math.max(0, targetAt - (Date.now() + offsetRef.current));
}
