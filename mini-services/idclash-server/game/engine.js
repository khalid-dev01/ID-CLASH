/**
 * ID Clash — authoritative game engine (server side).
 *
 * Owns ALL room state in memory and pushes sanitized per-player state
 * snapshots over socket.io (the Firestore `onSnapshot` equivalent).
 * The client never receives secret data (opponent identity, opponent cards).
 */

import { randomUUID } from 'crypto';
import {
  GAME,
  LIMITS,
  CATEGORIES,
  ANSWER_LABELS,
  POWERUPS,
  POWERUP_TYPES,
  CODE_ALPHABET,
} from './constants.js';
import { similarityPercent } from './matching.js';

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const cleanText = (v, max) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : '';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const firstGrapheme = (s) => Array.from(String(s || '').trim())[0] || '';

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export class GameEngine {
  /**
   * @param {{ now?: () => number, emit: (socketId: string, event: string, payload: unknown) => void }} deps
   */
  constructor({ now = () => Date.now(), emit }) {
    this.now = now;
    this.emit = emit;
    /** @type {Map<string, object>} code -> room */
    this.rooms = new Map();
    /** @type {Map<string, {code: string, playerId: string}>} socketId -> identity */
    this.socketMap = new Map();
  }

  /* ---------------- lookups ---------------- */

  roomOf(socketId) {
    const ref = this.socketMap.get(socketId);
    if (!ref) return null;
    const room = this.rooms.get(ref.code);
    if (!room || !room.players.has(ref.playerId)) return null;
    return { room, playerId: ref.playerId };
  }

  otherPid(room, pid) {
    return room.order.find((p) => p !== pid) || null;
  }

  playerName(room, pid) {
    return room.players.get(pid)?.name || '؟';
  }

  genCode() {
    for (let attempt = 0; attempt < 64; attempt++) {
      let code = '';
      for (let i = 0; i < LIMITS.CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return randomUUID().slice(0, LIMITS.CODE_LENGTH).toUpperCase();
  }

  /* ---------------- logging ---------------- */

  pushLog(room, type, text, by = null) {
    room.seq = (room.seq || 0) + 1;
    room.log.push({ id: `l${room.seq}`, ts: this.now(), type, text, by });
    if (room.log.length > GAME.LOG_MAX) {
      room.log.splice(0, room.log.length - GAME.LOG_MAX);
    }
    room.lastActivity = this.now();
  }

  /* ---------------- broadcast ---------------- */

  broadcast(room) {
    for (const pid of room.order) {
      const player = room.players.get(pid);
      if (!player) continue;
      const snapshot = this.snapshotFor(room, pid);
      for (const sid of player.sockets) {
        this.emit(sid, 'room:state', snapshot);
      }
    }
  }

  /* ---------------- lifecycle ---------------- */

  detachFromCurrentRoom(socketId) {
    const ref = this.socketMap.get(socketId);
    if (!ref) return;
    this.socketMap.delete(socketId);
    const room = this.rooms.get(ref.code);
    const player = room?.players.get(ref.playerId);
    if (room && player) {
      player.sockets.delete(socketId);
      if (player.sockets.size === 0 && player.connected) {
        player.connected = false;
        player.disconnectedAt = this.now();
        if (room.status === 'playing') {
          this.pushLog(room, 'system', `فقد ${player.name} الاتصال — لديه ${Math.round(GAME.RECONNECT_GRACE_MS / 1000)} ثانية لإعادة الاتصال وإلا تُحتسب خسارة بالانسحاب.`);
        } else {
          this.pushLog(room, 'system', `انقطع اتصال ${player.name}.`);
        }
        this.broadcast(room);
      }
    }
  }

  attachSocket(room, pid, socketId) {
    const player = room.players.get(pid);
    if (!player) return false;
    player.sockets.add(socketId);
    player.connected = true;
    player.disconnectedAt = null;
    room.emptySince = null;
    this.socketMap.set(socketId, { code: room.code, playerId: pid });
    return true;
  }

  /* ---------------- public actions ---------------- */

  createRoom(payload, socketId) {
    const name = cleanText(payload.name, LIMITS.NICKNAME_MAX);
    if (name.length < 2) return { ok: false, error: 'أدخل اسم لاعب صحيحاً (حرفان على الأقل)' };

    const durMin = GAME.DURATIONS_MIN.includes(Number(payload.durationMin))
      ? Number(payload.durationMin)
      : GAME.DEFAULT_DURATION_MIN;

    this.detachFromCurrentRoom(socketId);

    const code = this.genCode();
    const pid = randomUUID();
    const t = this.now();

    const room = {
      code,
      status: 'waiting',
      hostId: pid,
      createdAt: t,
      lastActivity: t,
      endedAt: null,
      originalDurationMs: durMin * 60 * 1000,
      durationMs: durMin * 60 * 1000,
      durationMin: durMin,
      startedAt: null,
      endsAt: null,
      players: new Map([
        [pid, {
          id: pid,
          name,
          sockets: new Set([socketId]),
          connected: true,
          disconnectedAt: null,
          joinedAt: t,
        }],
      ]),
      order: [pid],
      identities: new Map(),
      locked: new Set(),
      hands: new Map(),
      intel: new Map(),
      powerPool: shuffle(POWERUP_TYPES),
      currentTurn: null,
      turnPhase: null,
      turnEndsAt: null,
      pending: null,
      pendingSeq: 0,
      dontKnow: new Map(),
      guesses: new Map(),
      doubleTurnBy: null,
      log: [],
      seq: 0,
      winner: null,
      endReason: null,
      emptySince: null,
    };

    this.rooms.set(code, room);
    this.attachSocket(room, pid, socketId);
    this.pushLog(room, 'system', `أنشأ ${name} الغرفة — شارك الكود مع صديقك لتبدأ المعركة!`);
    this.broadcast(room);
    return { ok: true, code, playerId: pid };
  }

  joinRoom(payload, socketId) {
    const code = cleanText(payload.code, 8).toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'لا توجد غرفة بهذا الكود — تحقق منه وحاول مجدداً' };

    // Rejoin path (same player returning on a fresh socket).
    if (payload.playerId && room.players.has(payload.playerId)) {
      const wasOff = !room.players.get(payload.playerId).connected;
      this.detachFromCurrentRoom(socketId);
      this.attachSocket(room, payload.playerId, socketId);
      if (wasOff) {
        this.pushLog(room, 'system', `عاد ${room.players.get(payload.playerId).name} إلى المباراة.`);
        this.broadcast(room);
      } else {
        this.emit(socketId, 'room:state', this.snapshotFor(room, payload.playerId));
      }
      return { ok: true, code: room.code, playerId: payload.playerId };
    }

    if (room.status !== 'waiting') {
      return { ok: false, error: 'المباراة انطلقت بالفعل ولا يمكن الانضمام إليها' };
    }
    if (room.players.size >= 2) {
      return { ok: false, error: 'الغرفة ممتلئة — الحد الأقصى لاعبَين فقط (وضع 1 ضد 1)' };
    }

    const name = cleanText(payload.name, LIMITS.NICKNAME_MAX);
    if (name.length < 2) return { ok: false, error: 'أدخل اسم لاعب صحيحاً (حرفان على الأقل)' };

    this.detachFromCurrentRoom(socketId);

    const pid = randomUUID();
    room.players.set(pid, {
      id: pid,
      name,
      sockets: new Set([socketId]),
      connected: true,
      disconnectedAt: null,
      joinedAt: this.now(),
    });
    room.order.push(pid);
    this.attachSocket(room, pid, socketId);
    this.pushLog(room, 'system', `انضم ${name} إلى الغرفة! يستطيع المضيف بدء مرحلة إعداد الهوية الآن.`);
    this.broadcast(room);
    return { ok: true, code: room.code, playerId: pid };
  }

  rejoin(payload, socketId) {
    const code = cleanText(payload.code, 8).toUpperCase();
    const room = this.rooms.get(code);
    const pid = cleanText(payload.playerId, 64);
    if (!room || !pid || !room.players.has(pid)) {
      return { ok: false, error: 'انتهت صلاحية الغرفة أو لم تعد موجودة' };
    }
    const wasOff = !room.players.get(pid).connected;
    this.detachFromCurrentRoom(socketId);
    this.attachSocket(room, pid, socketId);
    if (wasOff) {
      this.pushLog(room, 'system', `عاد ${room.players.get(pid).name} إلى المباراة.`);
      this.broadcast(room);
    } else {
      this.emit(socketId, 'room:state', this.snapshotFor(room, pid));
    }
    return { ok: true, code: room.code, playerId: pid };
  }

  leaveBySocket(socketId) {
    const ref = this.roomOf(socketId);
    if (!ref) return { ok: true };
    this.socketMap.delete(socketId);
    ref.room.players.get(ref.playerId)?.sockets.delete(socketId);
    this.removePlayer(ref.room, ref.playerId, 'leave');
    return { ok: true };
  }

  removePlayer(room, pid, reason) {
    const player = room.players.get(pid);
    if (!player) return;
    const name = player.name;
    const otherPid = this.otherPid(room, pid);

    if (room.status === 'playing') {
      if (otherPid) {
        this.endGame(room, otherPid, 'forfeit');
        this.pushLog(room, 'system', `غادر ${name} المباراة${reason === 'disconnect' ? ' بعد الانقطاع الطويل' : ''} — فاز ${this.playerName(room, otherPid)} بالانسحاب.`);
      } else {
        room.status = 'ended';
        room.endedAt = this.now();
      }
      this.broadcast(room);
      return;
    }

    this.pushLog(room, 'system', `غادر ${name} الغرفة.`);
    room.players.delete(pid);
    room.order = room.order.filter((p) => p !== pid);
    room.locked.delete(pid);
    room.identities.delete(pid);
    room.hands.delete(pid);
    room.intel.delete(pid);
    room.dontKnow.delete(pid);
    room.guesses.delete(pid);

    // A prep room with a missing player rolls back to the waiting lobby.
    if (room.status === 'prep') {
      room.status = 'waiting';
      room.identities.clear();
      room.locked.clear();
      room.hands.clear();
      room.intel.clear();
      room.powerPool = shuffle(POWERUP_TYPES);
      this.pushLog(room, 'system', 'أُلغيت مرحلة الإعداد — عادت الغرفة إلى وضع الانتظار.');
    }

    if (room.order.length === 1 && room.hostId === pid) {
      room.hostId = room.order[0];
      this.pushLog(room, 'system', `أصبح ${this.playerName(room, room.order[0])} مضيف الغرفة.`);
    }

    if (room.order.length === 0) {
      this.rooms.delete(room.code);
      return;
    }
    this.broadcast(room);
  }

  startPrep(socketId) {
    const ref = this.roomOf(socketId);
    if (!ref) return { ok: false, error: 'لست في أي غرفة' };
    const { room, playerId } = ref;

    if (room.status !== 'waiting') return { ok: false, error: 'الغرفة ليست في وضع الانتظار' };
    if (room.hostId !== playerId) return { ok: false, error: 'بدء المباراة من صلاحيات المضيف فقط' };
    if (room.players.size !== 2) return { ok: false, error: 'يجب أن يضم الفريق لاعبَين قبل البدء' };

    room.status = 'prep';
    this.pushLog(room, 'system', 'بدأ المضيف مرحلة إعداد الهوية السرية — اختار كل لاعب شخصيته وفئته الآن!');
    this.broadcast(room);
    return { ok: true };
  }

  lockIdentity(socketId, payload) {
    const ref = this.roomOf(socketId);
    if (!ref) return { ok: false, error: 'لست في أي غرفة' };
    const { room, playerId } = ref;

    if (room.status !== 'prep') return { ok: false, error: 'مرحلة الإعداد غير مفتوحة حالياً' };
    if (room.locked.has(playerId)) return { ok: false, error: 'لقد أكدت هويتك بالفعل' };

    const name = cleanText(payload.name, LIMITS.IDENTITY_MAX);
    const category = cleanText(payload.category, 60);
    if (name.length < 1) return { ok: false, error: 'اكتب اسم الشخصية السرية أولاً' };
    if (!CATEGORIES.includes(category)) return { ok: false, error: 'اختر فئة صحيحة من القائمة' };

    room.identities.set(playerId, { name, category });
    room.locked.add(playerId);

    // Deal 2 unique power-ups from the shared pool (4 distinct cards across both players).
    const dealt = room.powerPool.splice(0, 2).map((type) => ({ id: randomUUID(), type, used: false }));
    room.hands.set(playerId, dealt);

    this.pushLog(room, 'system', `أكد ${this.playerName(room, playerId)} هويته السرية وتسلّم بطاقتَي قوة.`);
    room.lastActivity = this.now();

    if (room.locked.size === 2) this.startPlaying(room);
    this.broadcast(room);
    return { ok: true };
  }

  startPlaying(room) {
    room.status = 'playing';
    room.startedAt = this.now();
    room.endsAt = room.startedAt + room.durationMs;
    room.pending = null;
    room.doubleTurnBy = null;

    const first = room.order[Math.floor(Math.random() * room.order.length)];
    this.setTurn(room, first, 'ask');
    this.pushLog(room, 'system', `انطلقت المباراة! سؤال البداية لـ ${this.playerName(room, first)}. لكل لاعب ${GAME.GUESS_LIMIT} محاولات تخمين و${GAME.DONTKNOW_LIMIT} إجابات «لا أعرف». حظاً موفقاً!`);
  }

  setTurn(room, pid, phase) {
    room.currentTurn = pid;
    room.turnPhase = phase;
    room.turnEndsAt = this.now() + GAME.TURN_SECONDS * 1000;
  }

  askQuestion(socketId, payload) {
    const ref = this.roomOf(socketId);
    if (!ref) return { ok: false, error: 'لست في أي غرفة' };
    const { room, playerId } = ref;

    if (room.status !== 'playing') return { ok: false, error: 'المباراة ليست جارية' };
    if (room.currentTurn !== playerId || room.turnPhase !== 'ask') return { ok: false, error: 'ليس دورك الآن لطرح السؤال' };
    if (room.pending) return { ok: false, error: 'يوجد سؤال معلق بالفعل' };

    const text = cleanText(payload.text, LIMITS.QUESTION_MAX);
    if (!text) return { ok: false, error: 'اكتب سؤالك أولاً' };

    room.pendingSeq += 1;
    room.pending = {
      id: `q${room.pendingSeq}`,
      from: playerId,
      to: this.otherPid(room, playerId),
      text,
      askedAt: this.now(),
    };
    room.turnPhase = 'answer';
    room.turnEndsAt = this.now() + GAME.TURN_SECONDS * 1000;

    this.pushLog(room, 'question', `${this.playerName(room, playerId)} يسأل: ${text}`, playerId);
    this.broadcast(room);
    return { ok: true };
  }

  submitAnswer(socketId, payload) {
    const ref = this.roomOf(socketId);
    if (!ref) return { ok: false, error: 'لست في أي غرفة' };
    const { room, playerId } = ref;

    if (room.status !== 'playing') return { ok: false, error: 'المباراة ليست جارية' };
    if (!room.pending || room.pending.to !== playerId) return { ok: false, error: 'لا يوجد سؤال معلق موجّه إليك' };

    const type = payload.type;
    if (!ANSWER_LABELS[type]) return { ok: false, error: 'نوع إجابة غير صحيح' };

    if (type === 'dontknow') {
      const used = room.dontKnow.get(playerId) || 0;
      if (used >= GAME.DONTKNOW_LIMIT) {
        return { ok: false, error: `استنفدت محاولات «لا أعرف» — الحد الأقصى ${GAME.DONTKNOW_LIMIT} مرات` };
      }
      room.dontKnow.set(playerId, used + 1);
    }

    const asker = room.pending.from;
    room.pending = null;
    this.pushLog(room, 'answer', `${this.playerName(room, playerId)}: ${ANSWER_LABELS[type]}`, playerId);

    if (room.doubleTurnBy === asker) {
      room.doubleTurnBy = null;
      this.setTurn(room, asker, 'ask');
      this.pushLog(room, 'system', `الضربة المزدوجة تفعّلت — يحتفظ ${this.playerName(room, asker)} بالدور لسؤال ثانٍ متتالٍ!`);
    } else {
      this.setTurn(room, playerId, 'ask');
    }

    this.broadcast(room);
    return { ok: true };
  }

  /* ---------------- power-ups ---------------- */

  usePowerup(socketId, payload) {
    const ref = this.roomOf(socketId);
    if (!ref) return { ok: false, error: 'لست في أي غرفة' };
    const { room, playerId } = ref;
    const player = room.players.get(playerId);

    if (room.status !== 'playing') return { ok: false, error: 'بطاقات القوة تعمل أثناء المباراة فقط' };

    const hand = room.hands.get(playerId) || [];
    const card = hand.find((c) => c.id === payload.cardId && !c.used);
    if (!card) return { ok: false, error: 'البطاقة غير متاحة أو مستخدمة بالفعل' };

    const otherPid = this.otherPid(room, playerId);
    const oppIdentity = otherPid ? room.identities.get(otherPid) : null;
    const myIntel = room.intel.get(playerId) || {};
    const err = (msg) => ({ ok: false, error: msg });

    switch (card.type) {
      case 'double_turn': {
        const myAskTurn = room.currentTurn === playerId && room.turnPhase === 'ask' && !room.pending;
        if (!myAskTurn) return err('الضربة المزدوجة تُستخدم في دورك قبل طرح السؤال');
        room.doubleTurnBy = playerId;
        this.pushLog(room, 'powerup', `فعّل ${player.name} «الضربة المزدوجة» — بعد إجابة الخصم سيبقى الدور له لسؤال ثانٍ متتالٍ!`, playerId);
        break;
      }
      case 'time_freeze': {
        room.endsAt += GAME.FREEZE_BONUS_MS;
        this.pushLog(room, 'powerup', `استخدم ${player.name} «تجميد الزمن» — أضاف 45 ثانية إلى المؤقت العام للجولة!`, playerId);
        break;
      }
      case 'letter_reveal': {
        if (!room.startedAt || !oppIdentity) return err('المعلومات غير متاحة الآن');
        const elapsed = this.now() - room.startedAt;
        const needed = room.originalDurationMs * (GAME.LETTER_REVEAL_AFTER_PERCENT / 100);
        if (elapsed < needed) {
          return err(`تسريب الحرف يتاح بعد مرور ${GAME.LETTER_REVEAL_AFTER_PERCENT}% من مدة الجولة فقط`);
        }
        myIntel.letter = firstGrapheme(oppIdentity.name);
        room.intel.set(playerId, myIntel);
        this.pushLog(room, 'powerup', `استخدم ${player.name} «تسريب الحرف» — كُشف له الحرف الأول من شخصية خصمه!`, playerId);
        break;
      }
      case 'veto_shield': {
        if (!room.pending || room.pending.to !== playerId) {
          return err('درع الفيتو يعمل فقط عندما يوجد سؤال معلق موجّه إليك');
        }
        room.pending = null;
        this.setTurn(room, playerId, 'ask');
        this.pushLog(room, 'powerup', `رفض ${player.name} السؤال بواسطة «درع الفيتو» — أُلغي السؤال وعاد الدور إليه!`, playerId);
        break;
      }
      case 'steal': {
        const oppHand = (otherPid && room.hands.get(otherPid)) || [];
        const unused = oppHand.filter((c) => !c.used);
        if (!unused.length) return err('لا توجد بطاقات غير مستخدمة لدى الخصم لسرقتها');
        const victim = unused[Math.floor(Math.random() * unused.length)];
        room.hands.set(otherPid, oppHand.filter((c) => c.id !== victim.id));
        hand.push(victim);
        this.pushLog(room, 'powerup', `نفّذ ${player.name} «القرصنة» وسرق بطاقة قوة عشوائية من خصمه!`, playerId);
        break;
      }
      case 'category_reveal': {
        if (!oppIdentity) return err('المعلومات غير متاحة الآن');
        myIntel.category = oppIdentity.category;
        room.intel.set(playerId, myIntel);
        this.pushLog(room, 'powerup', `استخدم ${player.name} «كشف الفئة» — عرف الفئة التي تنتمي إليها شخصية خصمه!`, playerId);
        break;
      }
      default:
        return err('بطاقة مجهولة');
    }

    card.used = true;
    room.lastActivity = this.now();
    this.broadcast(room);
    return { ok: true };
  }

  /* ---------------- guessing ---------------- */

  submitGuess(socketId, payload) {
    const ref = this.roomOf(socketId);
    if (!ref) return { ok: false, error: 'لست في أي غرفة' };
    const { room, playerId } = ref;

    if (room.status !== 'playing') return { ok: false, error: 'المباراة ليست جارية' };
    const used = room.guesses.get(playerId) || 0;
    if (used >= GAME.GUESS_LIMIT) {
      return { ok: false, error: `استنفدت محاولات التخمين الثلاث` };
    }

    const guess = cleanText(payload.name, LIMITS.GUESS_MAX);
    if (!guess) return { ok: false, error: 'اكتب اسم الشخصية التي تخمّنها' };

    const otherPid = this.otherPid(room, playerId);
    const oppIdentity = otherPid ? room.identities.get(otherPid) : null;
    if (!oppIdentity) return { ok: false, error: 'لا توجد هوية للتخمين عليها' };

    const sim = similarityPercent(guess, oppIdentity.name);

    if (sim >= GAME.SIMILARITY_THRESHOLD) {
      this.pushLog(room, 'guess', `خمّن ${this.playerName(room, playerId)} بشكل صحيح: «${guess}» — نسبة التطابق ${sim}% — فوز فوري!`, playerId);
      this.endGame(room, playerId, 'guess');
      this.broadcast(room);
      return { ok: true, correct: true, similarity: sim };
    }

    room.guesses.set(playerId, used + 1);
    const remaining = GAME.GUESS_LIMIT - (used + 1);
    this.pushLog(room, 'guess', `خمّن ${this.playerName(room, playerId)} خطأً: «${guess}» (نسبة التطابق ${sim}%) — تبقّى له ${remaining === 1 ? 'محاولة واحدة' : `${remaining} محاولات`}.`, playerId);

    if (room.doubleTurnBy === playerId) room.doubleTurnBy = null;
    room.pending = null;
    if (otherPid) this.setTurn(room, otherPid, 'ask');

    room.lastActivity = this.now();
    this.broadcast(room);
    return { ok: true, correct: false, similarity: sim, remaining };
  }

  /* ---------------- end / win ---------------- */

  endGame(room, winnerPid, reason) {
    if (room.status === 'ended') return;
    room.status = 'ended';
    room.winner = winnerPid;
    room.endReason = reason;
    room.endedAt = this.now();
    room.pending = null;
    room.turnEndsAt = null;

    const revealText = room.order
      .map((pid) => {
        const idn = room.identities.get(pid);
        const n = this.playerName(room, pid);
        return idn ? `شخصية ${n}: «${idn.name}» (${idn.category})` : `لم يكمل ${n} إعداد هويته`;
      })
      .join(' — ');
    this.pushLog(room, 'system', `انتهت المباراة! ${revealText}`);

    if (winnerPid) {
      if (reason === 'guess') {
        this.pushLog(room, 'win', `الفائز: ${this.playerName(room, winnerPid)} — تمكن من تخمين هوية خصمه بنجاح! مبروك!`);
      } else if (reason === 'forfeit') {
        this.pushLog(room, 'win', `الفائز: ${this.playerName(room, winnerPid)} بالانسحاب — غادر الخصم المباراة.`);
      }
    } else {
      this.pushLog(room, 'system', 'انتهت المباراة بالتعادل — انتهى وقت الجولة قبل نجاح أي تخمين.');
    }
    room.lastActivity = this.now();
  }

  /* ---------------- tick (timers + cleanup) ---------------- */

  tick() {
    const t = this.now();
    for (const room of [...this.rooms.values()]) {
      // Room with no connected sockets -> TTL cleanup.
      const hasSockets = [...room.players.values()].some((p) => p.sockets.size > 0);
      if (!hasSockets) {
        room.emptySince = room.emptySince || t;
        if (t - room.emptySince > GAME.EMPTY_ROOM_TTL_MS) {
          this.rooms.delete(room.code);
          continue;
        }
      } else {
        room.emptySince = null;
      }

      // Ended rooms expire after TTL.
      if (room.status === 'ended' && room.endedAt && t - room.endedAt > GAME.ENDED_ROOM_TTL_MS) {
        this.rooms.delete(room.code);
        continue;
      }

      // Global round timer.
      if (room.status === 'playing' && room.endsAt && t >= room.endsAt) {
        this.pushLog(room, 'system', 'انتهى وقت الجولة!');
        this.endGame(room, null, 'time');
        this.broadcast(room);
        continue;
      }

      // Individual turn timer (25s per action).
      if (room.status === 'playing' && room.turnEndsAt && t >= room.turnEndsAt) {
        if (room.turnPhase === 'ask') {
          const pid = room.currentTurn;
          const other = this.otherPid(room, pid);
          if (other) {
            this.pushLog(room, 'system', `لم يطرح ${this.playerName(room, pid)} سؤالاً في الوقت المحدد — انتقل الدور إلى ${this.playerName(room, other)}.`);
            this.setTurn(room, other, 'ask');
            this.broadcast(room);
          }
        } else if (room.pending) {
          const asker = room.pending.from;
          const answerer = room.pending.to;
          room.pending = null;
          this.pushLog(room, 'system', `لم يجب ${this.playerName(room, answerer)} في الوقت المحدد — أُلغي السؤال وعاد الدور إلى ${this.playerName(room, asker)}.`);
          this.setTurn(room, asker, 'ask');
          this.broadcast(room);
        }
      }

      // Disconnect grace -> forfeit / removal.
      for (const pid of [...room.players.keys()]) {
        const p = room.players.get(pid);
        if (!p || p.connected || !p.disconnectedAt) continue;
        if (t - p.disconnectedAt <= GAME.RECONNECT_GRACE_MS) continue;

        if (room.status === 'playing') {
          const other = this.otherPid(room, pid);
          if (other) {
            this.endGame(room, other, 'forfeit');
            this.pushLog(room, 'system', `فقد ${p.name} الاتصال لمدة طويلة — فاز ${this.playerName(room, other)} بالانسحاب.`);
            this.broadcast(room);
          }
        } else {
          this.removePlayer(room, pid, 'disconnect');
        }
        break; // room may have been mutated; next tick handles the rest
      }
    }
  }

  /* ---------------- snapshot (per viewer, secrets stripped) ---------------- */

  snapshotFor(room, viewerPid) {
    const otherPid = this.otherPid(room, viewerPid);
    const me = room.players.get(viewerPid);
    const opp = otherPid ? room.players.get(otherPid) : null;
    const meIdentityLocked = room.locked.has(viewerPid);
    const letterUnlocksAt = room.startedAt
      ? room.startedAt + room.originalDurationMs * (GAME.LETTER_REVEAL_AFTER_PERCENT / 100)
      : null;

    return {
      serverTime: this.now(),
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      durationMin: room.durationMin,
      config: {
        turnSeconds: GAME.TURN_SECONDS,
        dontKnowLimit: GAME.DONTKNOW_LIMIT,
        guessLimit: GAME.GUESS_LIMIT,
        similarityThreshold: GAME.SIMILARITY_THRESHOLD,
        letterRevealAfterPercent: GAME.LETTER_REVEAL_AFTER_PERCENT,
      },
      players: room.order.map((pid) => {
        const p = room.players.get(pid);
        return {
          id: pid,
          name: p?.name || '؟',
          isHost: pid === room.hostId,
          connected: p?.connected ?? false,
          locked: room.locked.has(pid),
        };
      }),
      opponent: opp
        ? {
            id: opp.id,
            name: opp.name,
            connected: opp.connected,
            locked: room.locked.has(opp.id),
            dontKnowUsed: room.dontKnow.get(opp.id) || 0,
            guessesUsed: room.guesses.get(opp.id) || 0,
            handCount: (room.hands.get(opp.id) || []).filter((c) => !c.used).length,
          }
        : null,
      me: {
        id: viewerPid,
        name: me?.name || '؟',
        isHost: viewerPid === room.hostId,
        connected: me?.connected ?? false,
        locked: meIdentityLocked,
        dontKnowUsed: room.dontKnow.get(viewerPid) || 0,
        guessesUsed: room.guesses.get(viewerPid) || 0,
        hand: (room.hands.get(viewerPid) || [])
          .filter((c) => !c.used)
          .map((c) => ({ id: c.id, type: c.type, used: c.used })),
        intel: room.intel.get(viewerPid) || {},
        doubleTurnArmed: room.doubleTurnBy === viewerPid,
      },
      currentTurn: room.currentTurn,
      turnPhase: room.turnPhase,
      turnEndsAt: room.turnEndsAt,
      pending: room.pending
        ? { id: room.pending.id, from: room.pending.from, to: room.pending.to, text: room.pending.text, askedAt: room.pending.askedAt }
        : null,
      startedAt: room.startedAt,
      endsAt: room.endsAt,
      letterRevealUnlocksAt: letterUnlocksAt,
      log: room.log.slice(-120),
      winner: room.winner,
      endReason: room.endReason,
      revealed:
        room.status === 'ended'
          ? room.order.map((pid) => {
              const idn = room.identities.get(pid);
              return {
                pid,
                name: this.playerName(room, pid),
                character: idn?.name ?? null,
                category: idn?.category ?? null,
              };
            })
          : null,
    };
  }
}
