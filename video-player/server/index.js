import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { basicAuth } from './auth.js';
import { config } from './config.js';
import { handleOEmbed, handlePage, handleProbe, handleProxy, handleSniff } from './routes.js';

export function createApp({ serveStatic = true } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  if (config.appPassword) app.use(basicAuth(config.appPassword));

  app.options('/api/*', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, If-Range, If-None-Match, If-Modified-Since, Content-Type');
    res.sendStatus(204);
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, allowPrivateNetworks: config.allowPrivateNetworks }));
  app.get('/api/probe', handleProbe);
  app.get('/api/sniff', handleSniff);
  app.get('/api/page', handlePage);
  app.get('/api/oembed', handleOEmbed);
  app.get('/api/p/*', handleProxy);
  app.head('/api/p/*', handleProxy);

  const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (serveStatic && fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  } else if (config.production) {
    console.warn('[uvp] dist/ not found — run "npm run build" before "npm start".');
  }

  return app;
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  createApp().listen(config.port, () => {
    console.log(`[uvp] proxy server listening on http://localhost:${config.port}`);
    if (config.allowPrivateNetworks) console.log('[uvp] private network access ENABLED');
    if (config.appPassword) console.log('[uvp] password protection ENABLED');
  });
}
