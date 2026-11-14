/**
 * ID Clash — realtime backend connection config.
 *
 * This is the single place where the game's backend endpoint is defined
 * (the role a firebase-config.js would traditionally play). The realtime
 * backend is the bundled socket.io mini-service; swapping to another
 * provider only requires changing this file.
 */

export const REALTIME = {
  /** Gateway-relative socket URL (never hardcode a port in the path). */
  socketUrl(): string {
    return `/?XTransformPort=${REALTIME.PORT}`;
  },
  PORT: '3003',
  TRANSPORTS: ['websocket', 'polling'] as const,
  /** Acknowledgement timeout for client -> server actions. */
  ACK_TIMEOUT_MS: 9000,

  EVENTS: {
    STATE: 'room:state',
    CREATE: 'room:create',
    JOIN: 'room:join',
    REJOIN: 'room:rejoin',
    LEAVE: 'room:leave',
    START_PREP: 'room:start_prep',
    LOCK: 'identity:lock',
    ASK: 'question:ask',
    ANSWER: 'answer:submit',
    POWERUP: 'powerup:use',
    GUESS: 'guess:submit',
  },
} as const;
