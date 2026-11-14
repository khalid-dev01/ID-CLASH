'use client';

/**
 * Lobby view: nickname + create room / join room.
 */

import { useState } from 'react';
import { Clock, LogIn, Plus, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CATEGORIES, DEFAULT_DURATION_MIN, DURATION_OPTIONS } from '@/lib/idclash/constants';

const NICKNAME_KEY = 'idclash:nickname';

interface LobbyViewProps {
  busy: boolean;
  onCreateRoom: (name: string, durationMin: number) => Promise<unknown>;
  onJoinRoom: (name: string, code: string) => Promise<unknown>;
}

const RULES = [
  'اختر لاعباً آخر وشاركا الغرفة بكود من 4 أحرف.',
  'يخفي كل لاعب شخصية سرية واختيار فئتها في مرحلة الإعداد.',
  'تبادلا الأسئلة المفتوحة والإجابات: نعم، لا، أو لا أعرف (3 مرات كحد أقصى).',
  'استخدم بطاقات القوة الست بذكاء: دور مزدوج، تجميد زمن، تسريب حرف، فيتو، قرصنة وكشف فئة.',
  'خمّن هوية خصمك (3 محاولات، تُقبل عند تطابق 75% أو أكثر) قبل انتهاء وقت الجولة.',
];

export default function LobbyView({ busy, onCreateRoom, onJoinRoom }: LobbyViewProps) {
  // Lazy init reads the persisted nickname on the client; SSR renders empty.
  const [nickname, setNickname] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(NICKNAME_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [duration, setDuration] = useState(String(DEFAULT_DURATION_MIN));
  const [code, setCode] = useState('');
  const { toast } = useToast();

  const persistNickname = (value: string) => {
    setNickname(value);
    try {
      window.localStorage.setItem(NICKNAME_KEY, value);
    } catch {
      /* storage unavailable */
    }
  };

  const validateNickname = (): string | null => {
    const n = nickname.trim();
    if (n.length < 2) {
      toast({ title: 'الاسم مطلوب', description: 'اكتب اسم لاعب من حرفين على الأقل قبل المتابعة.', variant: 'destructive' });
      return null;
    }
    return n.slice(0, 20);
  };

  const handleCreate = async () => {
    const n = validateNickname();
    if (!n) return;
    await onCreateRoom(n, Number(duration));
  };

  const handleJoin = async () => {
    const n = validateNickname();
    if (!n) return;
    const c = code.trim().toUpperCase();
    if (c.length !== 4) {
      toast({ title: 'كود غير مكتمل', description: 'كود الغرفة يتكون من 4 أحرف إنجليزية وأرقام.', variant: 'destructive' });
      return;
    }
    await onJoinRoom(n, c);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-3 py-6 sm:px-4 sm:py-8">
      {/* Hero */}
      <section className="flex flex-col items-center gap-3 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
          <Swords className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">ID Clash</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          لعبة استنتاج ثنائية في الوقت الفعلي — أخفِ شخصيتك السرية، اطرح أسئلتك بذكاء، واستخدم بطاقات
          القوة لتخمين هوية خصمك قبل انتهاء الوقت.
        </p>
      </section>

      {/* Nickname */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:p-6">
          <Label htmlFor="nickname">اسم اللاعب</Label>
          <Input
            id="nickname"
            suppressHydrationWarning
            value={nickname}
            onChange={(e) => persistNickname(e.target.value)}
            placeholder="اكتب اسمك هنا..."
            maxLength={20}
            dir="auto"
            autoComplete="off"
          />
        </CardContent>
      </Card>

      {/* Create / Join */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-emerald-500" aria-hidden="true" />
              إنشاء غرفة جديدة
            </CardTitle>
            <CardDescription>أنشئ غرفة وشارك الكود مع صديقك للانضمام.</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="duration" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                مدة الجولة
              </Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger id="duration" aria-label="مدة الجولة بالدقائق">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} دقائق
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="lg" disabled={busy} onClick={handleCreate}>
              إنشاء الغرفة
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <LogIn className="h-5 w-5 text-amber-500" aria-hidden="true" />
              الانضمام إلى غرفة
            </CardTitle>
            <CardDescription>أدخل كود الغرفة المكوّن من 4 أحرف.</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="room-code" className="text-xs text-muted-foreground">
                كود الغرفة
              </Label>
              <Input
                id="room-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleJoin();
                }}
                placeholder="XXXX"
                className="num text-center font-mono text-2xl font-black tracking-[0.5em]"
                inputMode="text"
                autoComplete="off"
                aria-label="كود الغرفة"
              />
            </div>
            <Button size="lg" variant="secondary" disabled={busy} onClick={handleJoin}>
              انضمام
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* How to play */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">كيف تُلعب؟</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2">
            {RULES.map((rule, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                <span className="num mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600/15 text-xs font-bold text-emerald-400">
                  {i + 1}
                </span>
                {rule}
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            الفئات المتاحة للشخصيات: {CATEGORIES.join(' · ')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
