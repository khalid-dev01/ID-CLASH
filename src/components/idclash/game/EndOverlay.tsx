'use client';

/**
 * End-of-match overlay: outcome, reason, revealed identities, actions.
 */

import { useState } from 'react';
import { Crown, Handshake, History, LogOut, Trophy, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RoomState } from '@/lib/idclash/types';

interface EndOverlayProps {
  snap: RoomState;
  onLeave: () => Promise<unknown>;
}

export default function EndOverlay({ snap, onLeave }: EndOverlayProps) {
  const [dismissed, setDismissed] = useState(false);
  if (snap.status !== 'ended' || dismissed) return null;

  const outcome = snap.winner ? (snap.winner === snap.me.id ? 'win' : 'lose') : 'draw';

  const title = outcome === 'win' ? 'انتصار رائع!' : outcome === 'lose' ? 'خسارة هذه الجولة' : 'تعادل!';
  const Icon =
    outcome === 'win' ? Trophy : outcome === 'lose' ? XCircle : Handshake;
  const iconClass =
    outcome === 'win' ? 'text-yellow-400' : outcome === 'lose' ? 'text-rose-400' : 'text-muted-foreground';

  const reason =
    snap.endReason === 'guess'
      ? outcome === 'win'
        ? 'خمّنت هوية خصمك بنجاح — فوز فوري!'
        : 'للأسف — خمّن خصمك هويتك السرية بنجاح.'
      : snap.endReason === 'forfeit'
        ? outcome === 'win'
          ? 'فزت بالانسحاب — غادر الخصم المباراة.'
          : 'غادر الخصم المباراة وتم احتساب الفوز له.'
        : 'انتهى وقت الجولة قبل نجاح أي تخمين — تعادل مشرف.';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center pb-2 text-center">
          <span className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-muted ${iconClass}`}>
            <Icon className="h-9 w-9" aria-hidden="true" />
          </span>
          <CardTitle className="mt-1 text-2xl">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{reason}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Revealed identities */}
          <div className="grid gap-2 sm:grid-cols-2">
            {(snap.revealed ?? []).map((r) => {
              const isWinner = snap.winner === r.pid;
              return (
                <div
                  key={r.pid}
                  className={`flex flex-col gap-1 rounded-lg border p-3 ${
                    isWinner ? 'border-yellow-500/60 bg-yellow-500/10' : 'border-border bg-muted/30'
                  }`}
                >
                  <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    {r.name}
                    {isWinner ? <Crown className="h-3.5 w-3.5 text-yellow-400" aria-label="الفائز" /> : null}
                    {r.pid === snap.me.id ? ' (أنت)' : ''}
                  </p>
                  <p className="truncate text-base font-black" dir="auto">
                    {r.character ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.category ?? ''}</p>
                </div>
              );
            })}
          </div>

          <Button size="lg" className="w-full" onClick={() => void onLeave()}>
            <LogOut className="h-5 w-5" aria-hidden="true" />
            العودة إلى اللوبي
          </Button>
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setDismissed(true)}>
            <History className="h-4 w-4" aria-hidden="true" />
            استعراض سجل المباراة
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
