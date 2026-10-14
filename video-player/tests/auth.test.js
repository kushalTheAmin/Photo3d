// @vitest-environment node
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { basicAuth } from '../server/auth.js';

describe('basicAuth', () => {
  let server;
  let base;
  beforeAll(async () => {
    const app = express();
    app.use(basicAuth('s3cret'));
    app.get('/api/health', (_req, res) => res.json({ ok: true }));
    app.get('/', (_req, res) => res.send('home'));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(() => server?.close());

  const auth = (user, pass) => ({ authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` });

  it('challenges requests without credentials', async () => {
    const response = await fetch(`${base}/`);
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toMatch(/^Basic/);
  });
  it('rejects a wrong password and accepts the right one with any username', async () => {
    expect((await fetch(`${base}/`, { headers: auth('me', 'nope') })).status).toBe(401);
    expect((await fetch(`${base}/`, { headers: auth('anyone', 's3cret') })).status).toBe(200);
  });
  it('leaves the health check open for the hosting platform', async () => {
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
  });
});
