'use client';

/**
 * Waiting-room view: shareable code, player slots, host start button.
 */

import { Clock, Crown, Loader2, LogOut, Play, Swords, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/idclash/CopyButton';
import type { RoomState } from '@/lib/idclash/types';

interface RoomViewProps {
  snap: RoomState;
  busy: boolean;
  onStartPrep: () => Promise<unknown>;
  onLeave: () => Promise<unknown>;
}

export default function RoomView({ snap, busy, onStartPrep, onLeave }: RoomViewProps) {
  const isHost = snap.me.isHost;
  const full = snap.players.length === 2;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-3 py-6 sm:px-4">
      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle className="justify-center text-xl">غرفة الانتظار</CardTitle>
          <CardDescription>
            شارك الكود التالي مع صديقك — بعد انضمامه سيفتح المضيف مرحلة إعداد الهوية السرية.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-5">
          {/* Room code */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">كود الغرفة</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="num rounded-xl border-2 border-dashed px-5 py-3 font-mono text-4xl font-black tracking-[0.3em] text-emerald-400 sm:px-6">
                {snap.code}
              </span>
              <CopyButton value={snap.code} />
            </div>
          </div>

          {/* Player slots */}
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1].map((slot) => {
              const p = snap.players[slot];
              if (!p) {
                return (
                  <div
                    key="empty-slot"
                    className="flex items-center gap-3 rounded-xl border border-dashed p-3 text-muted-foreground"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                      <UserPlus className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">مقعد شاغر</p>
                      <p className="text-xs">بانتظار انضمام اللاعب الثاني...</p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600/15 font-bold text-emerald-400">
                    {p.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-bold">
                      {p.name}
                      {p.isHost ? <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-label="المضيف" /> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.id === snap.me.id ? 'أنت' : 'الخصم'}
                      {' · '}
                      {p.connected ? 'متصل' : 'غير متصل'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              مدة الجولة: {snap.durationMin} دقائق
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Swords className="h-3.5 w-3.5" aria-hidden="true" />
              وضع 1 ضد 1
            </Badge>
          </div>

          {/* Actions */}
          {isHost ? (
            <Button size="lg" className="w-full" disabled={!full || busy} onClick={() => void onStartPrep()}>
              <Play className="h-5 w-5" aria-hidden="true" />
              بدء مرحلة إعداد الهوية
            </Button>
          ) : (
            <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              بانتظار المضيف لبدء المباراة...
            </div>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void onLeave()}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            خروج من الغرفة
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
