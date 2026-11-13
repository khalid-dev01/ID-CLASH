/**
 * ID Clash — realtime game server (socket.io mini-service).
 *
 * Port: 3003 (fixed). The gateway forwards any request carrying the
 * `XTransformPort=3003` query param to this process. The socket.io
 * path stays `/` so the gateway can reach it regardless of request path.
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameEngine } from './game/engine.js';

const PORT = 3003;

const httpServer = createServer();
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const engine = new GameEngine({
  now: () => Date.now(),
  emit: (socketId, event, payload) => io.to(socketId).emit(event, payload),
});

/** Wrap a handler with error isolation + ack delivery. */
const safe = (socketId, fn) => async (payload, ack) => {
  let res;
  try {
    res = await fn(payload ?? {}, socketId);
  } catch (err) {
    console.error('[idclash] handler error:', err);
    res = { ok: false, error: 'حدث خطأ غير متوقع في الخادم' };
  }
  if (typeof ack === 'function') ack(res ?? { ok: true });
};

io.on('connection', (socket) => {
  socket.on('room:create', safe(socket.id, (p, sid) => engine.createRoom(p, sid)));
  socket.on('room:join', safe(socket.id, (p, sid) => engine.joinRoom(p, sid)));
  socket.on('room:rejoin', safe(socket.id, (p, sid) => engine.rejoin(p, sid)));
  socket.on('room:leave', safe(socket.id, (p, sid) => engine.leaveBySocket(sid)));
  socket.on('room:start_prep', safe(socket.id, (p, sid) => engine.startPrep(sid)));
  socket.on('identity:lock', safe(socket.id, (p, sid) => engine.lockIdentity(sid, p)));
  socket.on('question:ask', safe(socket.id, (p, sid) => engine.askQuestion(sid, p)));
  socket.on('answer:submit', safe(socket.id, (p, sid) => engine.submitAnswer(sid, p)));
  socket.on('powerup:use', safe(socket.id, (p, sid) => engine.usePowerup(sid, p)));
  socket.on('guess:submit', safe(socket.id, (p, sid) => engine.submitGuess(sid, p)));

  socket.on('disconnect', () => {
    engine.detachFromCurrentRoom(socket.id);
  });

  socket.on('error', (err) => {
    console.error(`[idclash] socket error (${socket.id}):`, err);
  });
});

// Authoritative timers: global round countdown, 25s turn forfeits, cleanup.
setInterval(() => {
  try {
    engine.tick();
  } catch (err) {
    console.error('[idclash] tick error:', err);
  }
}, 1000);

httpServer.listen(PORT, () => {
  console.log(`[idclash-server] realtime game server listening on :${PORT}`);
});

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0));
});
