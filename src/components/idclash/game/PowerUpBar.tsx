'use client';

/**
 * Power-up bar: the player's tactical cards with per-card availability
 * rules, inline confirm and server-authoritative execution.
 */

import { useState } from 'react';
import { Ban, Check, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCountdown, type OffsetRef } from '@/components/idclash/use-countdown';
import { POWERUP_ICONS } from '@/components/idclash/powerup-meta';
import { POWERUP_META } from '@/lib/idclash/constants';
import type { PowerupCard, RoomState } from '@/lib/idclash/types';

interface PowerUpBarProps {
  snap: RoomState;
  offsetRef: OffsetRef;
  busy: boolean;
  onUse: (cardId: string) => Promise<unknown>;
}

interface Usability {
  enabled: boolean;
  reason?: string;
}

function getUsability(card: PowerupCard, snap: RoomState, letterLocked: boolean): Usability {
  if (card.used) return { enabled: false, reason: 'استُخدمت بالفعل' };
  if (snap.status !== 'playing') return { enabled: false, reason: 'تعمل أثناء المباراة فقط' };

  const isMyAskTurn =
    snap.currentTurn === snap.me.id && snap.turnPhase === 'ask' && !snap.pending;

  switch (card.type) {
    case 'double_turn':
      return isMyAskTurn
        ? { enabled: true }
        : { enabled: false, reason: 'تُستخدم في دورك قبل طرح السؤال' };
    case 'time_freeze':
      return { enabled: true };
    case 'letter_reveal':
      return letterLocked
        ? { enabled: false, reason: `تتاح بعد ${snap.config.letterRevealAfterPercent}% من مدة الجولة` }
        : { enabled: true };
    case 'veto_shield':
      return snap.pending && snap.pending.to === snap.me.id
        ? { enabled: true }
        : { enabled: false, reason: 'تحتاج سؤالاً معلقاً موجهاً إليك' };
    case 'steal':
      return (snap.opponent?.handCount ?? 0) > 0
        ? { enabled: true }
        : { enabled: false, reason: 'لا توجد بطاقات غير مستخدمة لدى الخصم' };
    case 'category_reveal':
      return { enabled: true };
    default:
      return { enabled: false, reason: 'بطاقة مجهولة' };
  }
}

export default function PowerUpBar({ snap, offsetRef, busy, onUse }: PowerUpBarProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Live check for the letter-reveal time gate.
  const letterLeft = useCountdown(snap.letterRevealUnlocksAt, offsetRef);
  const letterLocked = letterLeft != null && letterLeft > 0;

  const hand = snap.me.hand;

  const use = async (cardId: string) => {
    setConfirmingId(null);
    await onUse(cardId);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
          بطاقات القوة
          <span className="num text-xs font-normal text-muted-foreground">
            ({hand.length} متاحة)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hand.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            لم تعد لديك بطاقات قوة — استخدمت كل بطاقاتك في هذه المباراة.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {hand.map((card) => {
              const Icon = POWERUP_ICONS[card.type];
              const meta = POWERUP_META[card.type];
              const usab = getUsability(card, snap, letterLocked);
              const confirming = confirmingId === card.id;

              return (
                <div
                  key={card.id}
                  className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
                    usab.enabled ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-muted/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-400">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{meta.name}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{meta.desc}</p>
                    </div>
                  </div>

                  {confirming ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-xs font-semibold text-amber-400">تأكيد استخدام البطاقة؟</span>
                      <Button size="sm" className="h-8 bg-amber-600 text-white hover:bg-amber-700" disabled={busy} onClick={() => void use(card.id)}>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        تأكيد
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setConfirmingId(null)}>
                        <X className="h-4 w-4" aria-hidden="true" />
                        إلغاء
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      {usab.enabled ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                          disabled={busy}
                          onClick={() => setConfirmingId(card.id)}
                        >
                          استخدام
                        </Button>
                      ) : (
                        <span
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                          title={usab.reason}
                        >
                          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                          {usab.reason}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
