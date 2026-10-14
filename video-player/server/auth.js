import crypto from 'node:crypto';

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Optional HTTP Basic Auth for public deployments (any username, password =
 * APP_PASSWORD). The browser caches the credentials and re-sends them on every
 * same-origin request, so media, proxied segments and sandboxed pages all work.
 */
export function basicAuth(password) {
  return (req, res, next) => {
    if (req.path === '/api/health') return next();
    const header = req.headers.authorization ?? '';
    if (header.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const supplied = decoded.slice(decoded.indexOf(':') + 1);
      if (safeEqual(supplied, password)) return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Universal Play", charset="UTF-8"');
    res.status(401).send('Password required');
  };
}
