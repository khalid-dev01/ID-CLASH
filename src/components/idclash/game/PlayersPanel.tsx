'use client';

/**
 * Players panel: my stats vs opponent stats, gathered intel chips and
 * the guess launcher with remaining attempts.
 */

import { Crown, Eye, Tag, Target, Users, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { attemptsWord } from '@/lib/idclash/constants';
import type { RoomState } from '@/lib/idclash/types';

interface PlayersPanelProps {
  snap: RoomState;
  onOpenGuess: () => void;
}

function StatChip({ label, left, limit }: { label: string; left: number; limit: number | string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
      title={`${label}: متبقي ${left} من ${limit}`}
    >
      {label}
      <span className="num font-bold text-foreground/80">{left}/{limit}</span>
    </span>
  );
}

function PlayerRow({
  name,
  isMe,
  isHost,
  connected,
  children,
}: {
  name: string;
  isMe: boolean;
  isHost: boolean;
  connected: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600/15 font-bold text-emerald-400">
          {name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-bold">
            {name}
            {isMe ? <span className="text-xs font-normal text-muted-foreground">(أنت)</span> : null}
            {isHost ? <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-label="المضيف" /> : null}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {connected ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-500" aria-hidden="true" /> متصل
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-rose-500" aria-hidden="true" /> غير متصل
              </>
            )}
          </p>
        </div>
      </div>
      {children ? <div className="flex flex-wrap gap-1.5 ps-11">{children}</div> : null}
    </div>
  );
}

export default function PlayersPanel({ snap, onOpenGuess }: PlayersPanelProps) {
  const { me, opponent, config } = snap;
  const attemptsLeft = config.guessLimit - me.guessesUsed;
  const dkLeft = config.dontKnowLimit - me.dontKnowUsed;
  const intel = me.intel;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" aria-hidden="true" />
          اللاعبون والمعلومات
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <PlayerRow name={me.name} isMe isHost={me.isHost} connected={me.connected}>
          <StatChip label="تخميني" left={attemptsLeft} limit={config.guessLimit} />
          <StatChip label="لا أعرف" left={dkLeft} limit={config.dontKnowLimit} />
          {me.doubleTurnArmed ? (
            <Badge variant="outline" className="border-fuchsia-500/50 text-[11px] text-fuchsia-400">
              دور مزدوج مسلّح
            </Badge>
          ) : null}
        </PlayerRow>

        <Separator />

        {opponent ? (
          <PlayerRow name={opponent.name} isMe={false} isHost={opponent.id === snap.hostId} connected={opponent.connected}>
            <StatChip label="تخمينه" left={config.guessLimit - opponent.guessesUsed} limit={config.guessLimit} />
            <StatChip label="لا أعرف" left={config.dontKnowLimit - opponent.dontKnowUsed} limit={config.dontKnowLimit} />
            <StatChip label="بطاقاته" left={opponent.handCount} limit="؟" />
          </PlayerRow>
        ) : (
          <p className="text-sm text-muted-foreground">بانتظار انضمام الخصم...</p>
        )}

        {/* Intel gathered from power-ups */}
        {intel.letter || intel.category ? (
          <>
            <Separator />
            <div className="flex flex-col gap-1.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                معلوماتك المكتسبة عن شخصية الخصم:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {intel.letter ? (
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                    الحرف الأول:{' '}
                    <span className="font-black">{intel.letter}</span>
                  </Badge>
                ) : null}
                {intel.category ? (
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                    <Tag className="h-3 w-3" aria-hidden="true" />
                    الفئة: {intel.category}
                  </Badge>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <Separator />

        <Button
          className="w-full bg-rose-600 text-white hover:bg-rose-700"
          disabled={snap.status !== 'playing' || attemptsLeft <= 0}
          title={
            snap.status !== 'playing'
              ? 'متاح أثناء المباراة فقط'
              : attemptsLeft <= 0
                ? 'استنفدت محاولات التخمين الثلاث'
                : undefined
          }
          onClick={onOpenGuess}
        >
          <Target className="h-5 w-5" aria-hidden="true" />
          تخمين الهوية
          <span className="num text-xs opacity-85">({attemptsWord(attemptsLeft)})</span>
        </Button>
      </CardContent>
    </Card>
  );
}
