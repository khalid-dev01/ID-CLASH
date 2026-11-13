/**
 * ID Clash — small formatting helpers (clocks and timestamps).
 */

/** Milliseconds -> MM:SS (never negative). */
export function fmtClock(ms: number | null | undefined): string {
  if (ms == null) return '--:--';
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Epoch ms -> HH:MM:SS local time (for log rows). */
export function fmtTimeOfDay(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('en-GB', { hour12: false });
  } catch {
    return '';
  }
}
