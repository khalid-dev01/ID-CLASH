'use client';

/**
 * Live game log with auto-scroll. All text is rendered via React text
 * nodes (textContent semantics) — never dangerouslySetInnerHTML.
 */

import { useEffect, useRef } from 'react';
import {
  History,
  Info,
  MessageCircle,
  MessageSquare,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtTimeOfDay } from '@/lib/idclash/format';
import type { LogEntry, LogType } from '@/lib/idclash/types';

const LOG_STYLE: Record<LogType, { icon: LucideIcon; className: string }> = {
  system: { icon: Info, className: 'text-muted-foreground' },
  question: { icon: MessageCircle, className: 'text-amber-400' },
  answer: { icon: MessageSquare, className: 'text-emerald-400' },
  guess: { icon: Target, className: 'text-rose-400' },
  powerup: { icon: Zap, className: 'text-fuchsia-400' },
  win: { icon: Trophy, className: 'text-yellow-400' },
};

function LogRow({ entry }: { entry: LogEntry }) {
  const style = LOG_STYLE[entry.type] ?? LOG_STYLE.system;
  const Icon = style.icon;
  return (
    <div className="flex items-start gap-2">
      <span className="num shrink-0 pt-0.5 text-[10px] text-muted-foreground/70">
        {fmtTimeOfDay(entry.ts)}
      </span>
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${style.className}`} aria-hidden="true" />
      <span className={`min-w-0 flex-1 text-sm leading-relaxed ${style.className === 'text-muted-foreground' ? 'text-muted-foreground' : 'text-foreground/90'}`}>
        {entry.text}
      </span>
    </div>
  );
}

interface LogPanelProps {
  log: LogEntry[];
}

export default function LogPanel({ log }: LogPanelProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" aria-hidden="true" />
          سجل المباراة
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          ref={boxRef}
          className="log-scroll flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3"
          role="log"
          aria-live="polite"
          aria-label="سجل أحداث المباراة"
        >
          {log.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد نشاط بعد</p>
          ) : (
            log.map((entry) => <LogRow key={entry.id} entry={entry} />)
          )}
        </div>
      </CardContent>
    </Card>
  );
}
