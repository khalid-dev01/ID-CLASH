'use client';

/**
 * Secret identity prep view: free-text character name + category dropdown,
 * lock-in button, dealt power-up preview, opponent status.
 */

import { useState } from 'react';
import { CheckCircle2, Loader2, Lock, LogOut, VenetianMask } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { PowerupChip } from '@/components/idclash/powerup-meta';
import { CATEGORIES } from '@/lib/idclash/constants';
import type { RoomState } from '@/lib/idclash/types';

interface PrepViewProps {
  snap: RoomState;
  busy: boolean;
  onLockIdentity: (name: string, category: string) => Promise<unknown>;
  onLeave: () => Promise<unknown>;
}

export default function PrepView({ snap, busy, onLockIdentity, onLeave }: PrepViewProps) {
  const { me, opponent } = snap;
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const canLock = !me.locked && name.trim().length > 0 && category !== '' && !busy;

  const submit = async () => {
    const res = (await onLockIdentity(name.trim(), category)) as { ok?: boolean } | undefined;
    if (res?.ok) {
      setName('');
      setCategory('');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-3 py-6 sm:px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <VenetianMask className="h-5 w-5 text-amber-500" aria-hidden="true" />
            مرحلة الهوية السرية
          </CardTitle>
          <CardDescription>
            اكتب اسم شخصية سرية واختر فئتها — بلا حد زمني. اجعلها صعبة التخمين!
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!me.locked ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="identity-name">اسم الشخصية السرية</Label>
                <Input
                  id="identity-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canLock) void submit();
                  }}
                  placeholder="مثال: ناروتو، محمد صلاح، والتر وايت، صلاح الدين..."
                  maxLength={40}
                  dir="auto"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">يدعم العربية والإنجليزية — لا يظهر لخصمك إطلاقاً.</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="identity-category">فئة الشخصية</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="identity-category" aria-label="فئة الشخصية السرية">
                    <SelectValue placeholder="اختر الفئة المناسبة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="lg" disabled={!canLock} onClick={() => void submit()}>
                <Lock className="h-5 w-5" aria-hidden="true" />
                تأكيد الهوية (Lock-in)
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void onLeave()}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                خروج من الغرفة
              </Button>
            </>
          ) : (
            <>
              <Alert className="border-emerald-500/40 bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <AlertTitle>تم تثبيت هويتك بنجاح</AlertTitle>
                <AlertDescription>
                  ستبدأ المباراة تلقائياً فور تأكيد خصمك لهويته — حضّر أسئلتك!
                </AlertDescription>
              </Alert>

              <div>
                <p className="mb-2 text-sm font-bold">بطاقات القوة الخاصة بك في هذه المباراة:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {me.hand.length > 0 ? (
                    me.hand.map((c) => <PowerupChip key={c.id} type={c.type} />)
                  ) : (
                    <p className="text-sm text-muted-foreground">جاري توزيع البطاقات...</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                {opponent?.locked ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    أكد {opponent.name} هويته — انطلاق المباراة الآن...
                  </>
                ) : (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    بانتظار تأكيد هوية {opponent?.name || 'الخصم'}...
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
