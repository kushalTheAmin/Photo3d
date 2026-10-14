/**
 * Runs inside the proxied, sandboxed page (opaque origin). It cannot touch the
 * parent app; it only reports media URLs and navigation intents via postMessage.
 * Serialized with Function.prototype.toString, so it must stay self-contained.
 */
function uvpSniffer() {
  if (window.__uvpSnifferInstalled) return;
  window.__uvpSnifferInstalled = true;

  var MEDIA_RE = /\.(m3u8|mpd|mp4|m4v|webm|ogv|mov|mkv)(?=$|[?#&])/i;
  var HINT_RE = /(mime=video|format=m3u8|\/manifest\/(hls|dash)|\/playlist\.m3u8|type=m3u8)/i;
  var SEGMENT_RE = /\.(ts|m4s|aac|vtt|webvtt|key)(?=$|[?#])/i;
  var seen = {};
  var queue = [];
  var flushTimer = null;

  function post(message) {
    message.__uvp = true;
    try {
      window.parent.postMessage(message, '*');
    } catch (err) {
      /* parent unreachable */
    }
  }

  function kindOf(url) {
    var match = url.match(MEDIA_RE);
    if (match) {
      var ext = match[1].toLowerCase();
      if (ext === 'm3u8') return 'hls';
      if (ext === 'mpd') return 'dash';
      return 'video';
    }
    if (/m3u8|hls/i.test(url) && HINT_RE.test(url)) return 'hls';
    if (/dash|mpd/i.test(url) && HINT_RE.test(url)) return 'dash';
    if (HINT_RE.test(url)) return 'video';
    return null;
  }

  function report(rawUrl, source, forcedKind) {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    var url;
    try {
      url = new URL(rawUrl, document.baseURI).href;
    } catch (err) {
      return;
    }
    if (!/^https?:/i.test(url) || SEGMENT_RE.test(url)) return;
    var kind = forcedKind || kindOf(url);
    if (!kind || seen[url]) return;
    seen[url] = true;
    queue.push({ url: url, kind: kind, source: source });
    if (!flushTimer) {
      flushTimer = setTimeout(function () {
        flushTimer = null;
        var items = queue;
        queue = [];
        post({ type: 'media-found', items: items, pageUrl: document.baseURI, title: document.title });
      }, 120);
    }
  }

  function scanDom() {
    var nodes = document.querySelectorAll('video, audio, source, video track');
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var tag = node.tagName.toLowerCase();
      if (tag === 'track') continue;
      var src = node.currentSrc || node.src || node.getAttribute('src') || node.getAttribute('data-src');
      if (src && src.indexOf('blob:') !== 0) report(src, '<' + tag + '> element', kindOf(src) || 'video');
    }
    var metas = document.querySelectorAll('meta[property^="og:video"], meta[name="twitter:player:stream"]');
    for (var j = 0; j < metas.length; j += 1) report(metas[j].getAttribute('content'), 'meta tag');
    var links = document.querySelectorAll('a[href]');
    for (var k = 0; k < links.length; k += 1) {
      var href = links[k].getAttribute('href');
      if (href && MEDIA_RE.test(href)) report(href, 'link');
    }
    var blobVideos = 0;
    var videos = document.querySelectorAll('video');
    for (var v = 0; v < videos.length; v += 1) if ((videos[v].currentSrc || '').indexOf('blob:') === 0) blobVideos += 1;
    post({ type: 'page-info', title: document.title, pageUrl: document.baseURI, videoCount: videos.length, mseVideoCount: blobVideos });
  }

  var originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      report(String(url), 'XHR request');
    } catch (err) {
      /* ignore */
    }
    return originalOpen.apply(this, arguments);
  };

  if (window.fetch) {
    var originalFetch = window.fetch;
    window.fetch = function (input) {
      try {
        report(typeof input === 'string' ? input : input && input.url, 'fetch() request');
      } catch (err) {
        /* ignore */
      }
      return originalFetch.apply(this, arguments);
    };
  }

  if (window.PerformanceObserver) {
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i += 1) report(entries[i].name, 'network activity');
      }).observe({ type: 'resource', buffered: true });
    } catch (err) {
      /* unsupported */
    }
  }

  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;
      while (target && target.tagName !== 'A') target = target.parentElement;
      if (!target || !target.href || event.defaultPrevented) return;
      var href = target.href;
      if (!/^https?:/i.test(href)) return;
      var current = document.baseURI.split('#')[0];
      if (href.split('#')[0] === current && href.indexOf('#') !== -1) return;
      event.preventDefault();
      post({ type: 'navigate', url: href });
    },
    true,
  );

  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target;
      if (!form || (form.method || 'get').toLowerCase() !== 'get') return;
      try {
        var action = new URL(form.getAttribute('action') || document.baseURI, document.baseURI);
        var data = new FormData(form);
        data.forEach(function (value, key) {
          if (typeof value === 'string') action.searchParams.append(key, value);
        });
        event.preventDefault();
        post({ type: 'navigate', url: action.href });
      } catch (err) {
        /* let the browser handle it */
      }
    },
    true,
  );

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || !event.data || event.data.__uvpHost !== true) return;
    if (event.data.type === 'scan') {
      seen = {};
      scanDom();
      if (window.performance && performance.getEntriesByType) {
        var entries = performance.getEntriesByType('resource');
        for (var i = 0; i < entries.length; i += 1) report(entries[i].name, 'network activity');
      }
    }
  });

  var observer = new MutationObserver(function () {
    if (observer.pending) return;
    observer.pending = true;
    setTimeout(function () {
      observer.pending = false;
      scanDom();
    }, 400);
  });

  function start() {
    scanDom();
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  post({ type: 'ready', pageUrl: document.baseURI });
}

export const snifferScript = `(${uvpSniffer.toString()})();`;
