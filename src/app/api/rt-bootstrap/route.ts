import { NextResponse } from 'next/server';
import net from 'net';
import { spawn } from 'child_process';
import { existsSync, openSync } from 'fs';
import path from 'path';

/**
 * Realtime service bootstrap (internal).
 *
 * Idempotently ensures the ID Clash socket.io mini-service is running on
 * port 3003. Spawned detached from the Next.js server process so it is
 * supervised by the platform-managed runtime and survives across requests.
 * Safe to call repeatedly (cheap TCP probe when already up).
 */

const SERVICE_PORT = 3003;
const SERVICE_DIR = path.join(process.cwd(), 'mini-services', 'idclash-server');
const PROBE_TIMEOUT_MS = 700;
const START_WAIT_MS = 8000;

function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Module-level guard: only one spawn attempt at a time per Next.js process.
let spawning = false;

export async function GET() {
  try {
    let ready = await isPortOpen(SERVICE_PORT);

    if (!ready && !spawning && existsSync(path.join(SERVICE_DIR, 'index.js'))) {
      spawning = true;
      try {
        // Pipe service stdout/stderr into its own log file for observability.
        const logFd = openSync(path.join(SERVICE_DIR, 'dev.log'), 'a');
        const child = spawn('bun', ['run', 'dev'], {
          cwd: SERVICE_DIR,
          detached: true,
          stdio: ['ignore', logFd, logFd],
          env: { ...process.env, IDCLASH_PORT: String(SERVICE_PORT) },
        });
        child.unref();

        const deadline = Date.now() + START_WAIT_MS;
        while (Date.now() < deadline) {
          await sleep(250);
          if (await isPortOpen(SERVICE_PORT)) break;
        }
      } finally {
        spawning = false;
      }
      ready = await isPortOpen(SERVICE_PORT);
    }

    return NextResponse.json({ ok: true, ready, port: SERVICE_PORT });
  } catch (err) {
    return NextResponse.json(
      { ok: false, ready: false, error: err instanceof Error ? err.message : 'bootstrap failed' },
      { status: 500 },
    );
  }
}
