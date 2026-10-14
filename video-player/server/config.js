import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Minimal .env loader (KEY=VALUE lines); real environment variables win. */
function loadDotEnv() {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || line.trimStart().startsWith('#')) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

loadDotEnv();

export const config = {
  port: Number(process.env.PORT ?? 8787),
  production: process.env.NODE_ENV === 'production',
  allowPrivateNetworks: process.env.ALLOW_PRIVATE_NETWORKS === '1',
  maxTextBytes: Number(process.env.MAX_TEXT_BYTES ?? 8 * 1024 * 1024),
  upstreamTimeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 20000),
  maxRedirects: 6,
  defaultUserAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};
