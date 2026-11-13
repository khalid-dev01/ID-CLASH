/**
 * ID Clash — client-side game constants and Arabic UI copy.
 */

import type { AnswerType, PowerupType } from './types';

export const CATEGORIES = [
  'أنمي / كرتون',
  'رياضة / لاعب',
  'أفلام / مسلسلات',
  'شخصية تاريخية / عامة',
] as const;

export const DURATION_OPTIONS = [5, 10, 15, 20] as const;
export const DEFAULT_DURATION_MIN = 10;

export const ANSWER_LABELS: Record<AnswerType, string> = {
  yes: 'نعم',
  no: 'لا',
  dontknow: 'لا أعرف',
};

export interface PowerupMeta {
  name: string;
  desc: string;
}

export const POWERUP_META: Record<PowerupType, PowerupMeta> = {
  double_turn: {
    name: 'الضربة المزدوجة',
    desc: 'بعد أن يجيب خصمك عن سؤالك، يبقى الدور لك لطرح سؤال ثانٍ متتالٍ.',
  },
  time_freeze: {
    name: 'تجميد الزمن',
    desc: 'يضيف 45 ثانية إضافية إلى المؤقت العام للجولة.',
  },
  letter_reveal: {
    name: 'تسريب الحرف',
    desc: 'يكشف الحرف الأول من اسم شخصية خصمك. لا يعمل إلا بعد مرور نصف مدة الجولة.',
  },
  veto_shield: {
    name: 'درع الفيتو',
    desc: 'يرفض سؤالاً معلقاً موجهاً إليك دون إجابة، ويعيد الدور إليك فوراً.',
  },
  steal: {
    name: 'القرصنة',
    desc: 'يسرق بطاقة قوة عشوائية غير مستخدمة من خصمك ويضيفها إلى بطاقاتك.',
  },
  category_reveal: {
    name: 'كشف الفئة',
    desc: 'يكشف الفئة التي تنتمي إليها شخصية خصمك السرية.',
  },
};

/** Arabic plurals helper for remaining attempts. */
export function attemptsWord(n: number): string {
  if (n === 1) return 'محاولة واحدة';
  if (n === 2) return 'محاولتان';
  return `${n} محاولات`;
}
