/**
 * ID Clash — shared game constants (server side).
 * Pure data module, no side effects.
 */

export const GAME = {
  /** Seconds per individual action (asking OR answering). */
  TURN_SECONDS: 25,
  /** Max "I don't know" answers per player per match. */
  DONTKNOW_LIMIT: 3,
  /** Max guess attempts per player per match. */
  GUESS_LIMIT: 3,
  /** Similarity percent (normalized Levenshtein) accepted as a correct guess. */
  SIMILARITY_THRESHOLD: 75,
  /** Bonus milliseconds added by the Time Freeze power-up. */
  FREEZE_BONUS_MS: 45 * 1000,
  /** Letter Reveal unlocks after this percent of the original round duration elapsed. */
  LETTER_REVEAL_AFTER_PERCENT: 50,
  /** Disconnect grace window before a forfeit is declared. */
  RECONNECT_GRACE_MS: 60 * 1000,
  /** A room with zero connected sockets is deleted after this TTL. */
  EMPTY_ROOM_TTL_MS: 2 * 60 * 1000,
  /** Ended rooms are deleted after this TTL. */
  ENDED_ROOM_TTL_MS: 10 * 60 * 1000,
  /** Allowed global round durations (minutes). */
  DURATIONS_MIN: [5, 10, 15, 20],
  DEFAULT_DURATION_MIN: 10,
  /** Max log entries kept in memory per room. */
  LOG_MAX: 250,
};

export const LIMITS = {
  NICKNAME_MAX: 20,
  IDENTITY_MAX: 40,
  QUESTION_MAX: 220,
  GUESS_MAX: 60,
  CODE_LENGTH: 4,
};

export const CATEGORIES = [
  'أنمي / كرتون',
  'رياضة / لاعب',
  'أفلام / مسلسلات',
  'شخصية تاريخية / عامة',
];

export const ANSWER_LABELS = {
  yes: 'نعم',
  no: 'لا',
  dontknow: 'لا أعرف',
};

export const POWERUP_TYPES = [
  'double_turn',
  'time_freeze',
  'letter_reveal',
  'veto_shield',
  'steal',
  'category_reveal',
];

/** Arabic names used in server-generated (public) log lines. */
export const POWERUPS = {
  double_turn: { name: 'الضربة المزدوجة' },
  time_freeze: { name: 'تجميد الزمن' },
  letter_reveal: { name: 'تسريب الحرف' },
  veto_shield: { name: 'درع الفيتو' },
  steal: { name: 'القرصنة' },
  category_reveal: { name: 'كشف الفئة' },
};

/** Room code alphabet: no ambiguous glyphs (I, O, 0, 1). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
