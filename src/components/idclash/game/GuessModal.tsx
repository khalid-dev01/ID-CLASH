'use client';

/**
 * Guess modal: type the opponent's secret identity, server-side fuzzy
 * matching (normalized Arabic + Levenshtein >= 75%).
 */

import { useState } from 'react';
import { Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { attemptsWord } from '@/lib/idclash/constants';

interface GuessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opponentName: string;
  attemptsLeft: number;
  guessLimit: number;
  similarityThreshold: number;
  busy: boolean;
  onGuess: (name: string) => Promise<unknown>;
}

export default function GuessModal({
  open,
  onOpenChange,
  opponentName,
  attemptsLeft,
  guessLimit,
  similarityThreshold,
  busy,
  onGuess,
}: GuessModalProps) {
  const [value, setValue] = useState('');

  // Reset the draft whenever the dialog closes (no effect needed).
  const handleOpenChange = (next: boolean) => {
    if (!next) setValue('');
    onOpenChange(next);
  };

  const confirm = async () => {
    const v = value.trim();
    if (!v) return;
    const res = (await onGuess(v)) as { ok?: boolean } | undefined;
    if (res?.ok) handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-rose-500" aria-hidden="true" />
            تخمين هوية {opponentName}
          </DialogTitle>
          <DialogDescription>
            اكتب اسم الشخصية التي تعتقد أنها سرّ خصمك. يُقبل التخمين عند نسبة تطابق{' '}
            <span className="num font-bold">{similarityThreshold}%</span> أو أكثر — التخمين الخاطئ
            يكلفك محاولة ويمرر الدور إلى الخصم.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim() && !busy) void confirm();
            }}
            placeholder="اكتب اسم الشخصية..."
            maxLength={60}
            dir="auto"
            autoFocus
            aria-label="اسم الشخصية المخمَّنة"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>المحاولات المتبقية:</span>
            <span className="flex items-center gap-1" aria-label={`${attemptsLeft} محاولات متبقية`}>
              {Array.from({ length: guessLimit }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full ${i < attemptsLeft ? 'bg-rose-500' : 'bg-muted-foreground/30'}`}
                  aria-hidden="true"
                />
              ))}
              <span className="num ms-1">({attemptsWord(attemptsLeft)})</span>
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            className="bg-rose-600 text-white hover:bg-rose-700"
            disabled={!value.trim() || busy || attemptsLeft <= 0}
            onClick={() => void confirm()}
          >
            <Target className="h-4 w-4" aria-hidden="true" />
            تأكيد التخمين
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
