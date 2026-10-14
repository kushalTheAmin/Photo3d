import dns from 'node:dns';
import net from 'node:net';
import { config } from './config.js';

/** Returns true for loopback, private, link-local, CGNAT, multicast and reserved ranges. */
export function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

/**
 * dns.lookup replacement handed to http(s).request. Because it runs on every
 * connection (including each redirect hop), it also defeats DNS rebinding.
 */
export function guardedLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family || 4 }];
    if (!config.allowPrivateNetworks) {
      const blocked = list.find((entry) => isPrivateAddress(entry.address));
      if (blocked) {
        const error = new Error(`Blocked private network address ${blocked.address} for ${hostname}`);
        error.code = 'EPRIVATE';
        return callback(error);
      }
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

export function assertFetchableUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    const error = new Error('Invalid URL');
    error.code = 'EBADURL';
    throw error;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    const error = new Error(`Unsupported protocol ${url.protocol}`);
    error.code = 'EBADURL';
    throw error;
  }
  if (!config.allowPrivateNetworks && net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ''))) {
    const error = new Error(`Blocked private network address ${url.hostname}`);
    error.code = 'EPRIVATE';
    throw error;
  }
  return url;
}
