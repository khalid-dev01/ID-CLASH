'use client';

/**
 * Turn banner: the core interaction area of the match.
 * Renders the current turn state (ask / answer / waiting) with the
 * 25-second individual turn timer, question composer and answer buttons.
 */

import { useState } from 'react';
import { Check, HelpCircle, Hourglass, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useCountdown, type OffsetRef } from '@/components/idclash/use-countdown';
import { ANSWER_LABELS } from '@/lib/idclash/constants';
import type { AnswerType, RoomState } from '@/lib/idclash/types';

interface TurnBannerProps {
  snap: RoomState;
  offsetRef: OffsetRef;
  busy: boolean;
  onAsk: (text: string) => Promise<unknown>;
  onAnswer: (type: AnswerType) => Promise<unknown>;
}

function TurnTimerBar({
  snap,
  offsetRef,
  tone,
}: {
  snap: RoomState;
  offsetRef: OffsetRef;
  tone: 'mine' | 'neutral';
}) {
  const left = useCountdown(snap.turnEndsAt, offsetRef);
  if (left == null || snap.turnEndsAt == null) return null;
  const totalMs = (snap.config.turnSeconds || 25) * 1000;
  const pct = Math.max(0, Math.min(100, (left / totalMs) * 100));
  const barClass =
    left < 5000 ? '[&>div]:bg-rose-500' : left < 10000 ? '[&>div]:bg-amber-500' : tone === 'mine' ? '[&>div]:bg-emerald-500' : '[&>div]:bg-muted-foreground';

  return (
    <div className="flex items-center gap-3">
      <Progress value={pct} className={`h-2 flex-1 ${barClass}`} aria-hidden="true" />
      <span className="num w-10 text-center text-sm font-black tabular-nums">{Math.ceil(left / 1000)}</span>
    </div>
  );
}

export default function TurnBanner({ snap, offsetRef, busy, onAsk, onAnswer }: TurnBannerProps) {
  const [question, setQuestion] = useState('');
  const { me, opponent, pending, currentTurn, turnPhase, status } = snap;

  if (status !== 'playing') return null;

  const isMyAsk = currentTurn === me.id && turnPhase === 'ask' && !pending;
  const isMyAnswer = !!pending && pending.to === me.id;
  const waitingOppAnswer = !!pending && pending.from === me.id;
  const isOppAsk = !!opponent && currentTurn === opponent.id && turnPhase === 'ask' && !pending;

  const dkLeft = snap.config.dontKnowLimit - me.dontKnowUsed;

  const sendQuestion = async () => {
    const text = question.trim();
    if (!text) return;
    const res = (await onAsk(text)) as { ok?: boolean } | undefined;
    if (res?.ok) setQuestion('');
  };

  /* ---------- my turn: compose a question ---------- */
  if (isMyAsk) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border-2 border-emerald-500/60 bg-emerald-500/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold text-emerald-400">
            <Send className="h-4 w-4" aria-hidden="true" />
            دورك — اطرح سؤالاً مفتوحاً عن شخصية خصمك
          </h2>
          {me.doubleTurnArmed ? (
            <span className="rounded-full border border-fuchsia-500/50 bg-fuchsia-500/10 px-2.5 py-0.5 text-[11px] font-bold text-fuchsia-400">
              الضربة المزدوجة مسلّحة — سؤالك القادم يمنحك دوراً إضافياً
            </span>
          ) : null}
        </div>
        <TurnTimerBar snap={snap} offsetRef={offsetRef} tone="mine" />
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendQuestion();
            }
          }}
          placeholder="اكتب سؤالك هنا... مثال: هل شخصيتك رجل؟ هل تظهر في الأنمي؟"
          rows={2}
          maxLength={220}
          dir="auto"
          aria-label="نص السؤال"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="num text-xs text-muted-foreground">{question.trim().length}/220</span>
          <Button disabled={!question.trim() || busy} onClick={() => void sendQuestion()}>
            <Send className="h-4 w-4" aria-hidden="true" />
            إرسال السؤال
          </Button>
        </div>
      </section>
    );
  }

  /* ---------- opponent asked: answer with 3 buttons ---------- */
  if (isMyAnswer && pending) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border-2 border-amber-500/60 bg-amber-500/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-amber-400">
            سؤال {opponent?.name} إليك — أجب الآن!
          </h2>
        </div>
        <TurnTimerBar snap={snap} offsetRef={offsetRef} tone="mine" />
        <p className="rounded-lg border bg-background/60 p-3 text-base font-semibold leading-relaxed" dir="auto">
          {pending.text}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="lg"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={busy}
            onClick={() => void onAnswer('yes')}
          >
            <Check className="h-5 w-5" aria-hidden="true" />
            {ANSWER_LABELS.yes}
          </Button>
          <Button
            size="lg"
            className="bg-rose-600 text-white hover:bg-rose-700"
            disabled={busy}
            onClick={() => void onAnswer('no')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
            {ANSWER_LABELS.no}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            disabled={busy || dkLeft <= 0}
            title={dkLeft <= 0 ? 'استنفدت محاولات «لا أعرف» الثلاث' : undefined}
            onClick={() => void onAnswer('dontknow')}
          >
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
            {ANSWER_LABELS.dontknow}
            <span className="num text-xs opacity-80">({dkLeft})</span>
          </Button>
        </div>
      </section>
    );
  }

  /* ---------- my question pending: waiting for opponent's answer ---------- */
  if (waitingOppAnswer && pending) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border-2 border-fuchsia-500/50 bg-fuchsia-500/5 p-4">
        <h2 className="font-bold text-fuchsia-400">سؤالك قيد الانتظار</h2>
        <TurnTimerBar snap={snap} offsetRef={offsetRef} tone="neutral" />
        <p className="rounded-lg border bg-background/60 p-3 text-base leading-relaxed" dir="auto">
          {pending.text}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          بانتظار إجابة {opponent?.name}...
        </div>
      </section>
    );
  }

  /* ---------- opponent's turn to ask ---------- */
  if (isOppAsk && opponent) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border-2 border-border bg-muted/30 p-4">
        <h2 className="flex items-center gap-2 font-bold text-muted-foreground">
          <Hourglass className="h-4 w-4" aria-hidden="true" />
          دور {opponent.name} — يفكر في سؤاله...
        </h2>
        <TurnTimerBar snap={snap} offsetRef={offsetRef} tone="neutral" />
      </section>
    );
  }

  return null;
}
