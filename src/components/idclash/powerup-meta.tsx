/**
 * ID Clash — power-up display metadata (icons + Arabic copy) and a static
 * chip used in the prep phase preview.
 */

'use client';

import { Eye, FastForward, Grab, ShieldBan, Snowflake, Tags, type LucideIcon } from 'lucide-react';
import { POWERUP_META } from '@/lib/idclash/constants';
import type { PowerupType } from '@/lib/idclash/types';

export const POWERUP_ICONS: Record<PowerupType, LucideIcon> = {
  double_turn: FastForward,
  time_freeze: Snowflake,
  letter_reveal: Eye,
  veto_shield: ShieldBan,
  steal: Grab,
  category_reveal: Tags,
};

interface PowerupChipProps {
  type: PowerupType;
}

export function PowerupChip({ type }: PowerupChipProps) {
  const Icon = POWERUP_ICONS[type];
  const meta = POWERUP_META[type];
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-400">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold">{meta.name}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{meta.desc}</p>
      </div>
    </div>
  );
}
