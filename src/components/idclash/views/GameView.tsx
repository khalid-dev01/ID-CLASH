'use client';

/**
 * Main tactical gameplay view: status bar (code + global timer + leave),
 * turn banner with Q&A, power-up bar, game log, players panel,
 * guess modal and end-of-match overlay.
 */

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/idclash/CopyButton';
import { useCountdown, type OffsetRef } from '@/components/idclash/use-countdown';
import { GlobalTimer } from '@/components/idclash/game/GlobalTimer';
import TurnBanner from '@/components/idclash/game/TurnBanner';
import PowerUpBar from '@/components/idclash/game/PowerUpBar';
import LogPanel from '@/components/idclash/game/LogPanel';
import PlayersPanel from '@/components/idclash/game/PlayersPanel';
import GuessModal from '@/components/idclash/game/GuessModal';
import EndOverlay from '@/components/idclash/game/EndOverlay';
import type { AnswerType, RoomState } from '@/lib/idclash/types';

interface GameViewProps {
  snap: RoomState;
  offsetRef: OffsetRef;
  busy: boolean;
  onLeave: () => Promise<unknown>;
  onAsk: (text: string) => Promise<unknown>;
  onAnswer: (type: AnswerType) => Promise<unknown>;
  onUsePowerup: (cardId: string) => Promise<unknown>;
  onGuess: (name: string) => Promise<unknown>;
}

export default function GameView({
  snap,
  offsetRef,
  busy,
  onLeave,
  onAsk,
  onAnswer,
  onUsePowerup,
  onGuess,
}: GameViewProps) {
  const [guessOpen, setGuessOpen] = useState(false);
  const attemptsLeft = snap.config.guessLimit - snap.me.guessesUsed;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="num rounded-lg border bg-muted/40 px-3 py-1.5 font-mono text-sm font-black tracking-[0.25em]">
            {snap.code}
          </span>
          <CopyButton value={snap.code} label="نسخ" copiedLabel="تم" className="h-9" />
        </div>
        <div className="flex items-center gap-2">
          <GlobalTimer endsAt={snap.endsAt} offsetRef={offsetRef} />
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void onLeave()}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            خروج
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <TurnBanner snap={snap} offsetRef={offsetRef} busy={busy} onAsk={onAsk} onAnswer={onAnswer} />
          <PowerUpBar snap={snap} offsetRef={offsetRef} busy={busy} onUse={onUsePowerup} />
          <LogPanel log={snap.log} />
        </div>
        <aside className="flex flex-col gap-4">
          <PlayersPanel snap={snap} onOpenGuess={() => setGuessOpen(true)} />
        </aside>
      </div>

      {/* Guess modal */}
      <GuessModal
        open={guessOpen}
        onOpenChange={setGuessOpen}
        opponentName={snap.opponent?.name || 'الخصم'}
        attemptsLeft={attemptsLeft}
        guessLimit={snap.config.guessLimit}
        similarityThreshold={snap.config.similarityThreshold}
        busy={busy}
        onGuess={onGuess}
      />

      {/* End overlay */}
      <EndOverlay snap={snap} onLeave={onLeave} />
    </div>
  );
}
