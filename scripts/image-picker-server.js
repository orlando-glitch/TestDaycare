#!/usr/bin/env node
/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  IMAGE PICKER DEV TOOL                                                  │
 * │                                                                         │
 * │  1. Start this server:  npm run image-picker                            │
 * │  2. In src/_includes/layouts/base.html, uncomment the image-picker      │
 * │     <script> tag near the bottom (search "IMAGE PICKER").               │
 * │  3. Run your normal dev server:  npm start                              │
 * │  4. Click any image on the page — a picker will appear.                 │
 * │  5. Select a replacement — the source file updates automatically.       │
 * │                                                                         │
 * │  To disable: comment the script tag back out in base.html.             │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT          = 3001;
const ROOT          = path.join(__dirname, '..');
const SRC_IMAGES    = path.join(ROOT, 'src', 'assets', 'images');
const SRC_CONTENT   = path.join(ROOT, 'src', 'content');
const IMG_EXTS      = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);

/** Normalize Windows separators to web-style forward slashes */
function toWebPath(p) {
  return p.replace(/\\/g, '/');
}

/** Escape regex metacharacters in user/data-provided strings */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively yield all .html files under a directory */
function* walkHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

/** Build a { '/url/': '/abs/path/to/source.html' } map from front matter permalinks */
function buildUrlMap() {
  const map = {};
  for (const filepath of walkHtml(SRC_CONTENT)) {
    const raw = fs.readFileSync(filepath, 'utf-8');

    // Check for permalink in YAML front matter
    const fmBlock = raw.match(/^---[\r\n]([\s\S]*?)[\r\n]---/);
    if (fmBlock) {
      const permalinkLine = fmBlock[1].match(/^permalink:\s*['"]?([^'"#\r\n]+)['"]?/m);
      if (permalinkLine) {
        let p = permalinkLine[1].trim();
        if (!p.startsWith('/')) p = '/' + p;
        if (!p.endsWith('/'))   p = p + '/';
        map[p] = filepath;
      }
    }

    // Root index
    if (filepath === path.join(SRC_CONTENT, 'index.html')) {
      map['/'] = filepath;
    }
  }
  return map;
}

/** Return sorted list of image paths (relative to src/assets/images/) */
function getImages() {
  const images = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!IMG_EXTS.has(path.extname(entry.name).toLowerCase())) continue;
      const rel = path.relative(SRC_IMAGES, full);
      images.push(toWebPath(rel));
    }
  }

  walk(SRC_IMAGES);
  return images.sort();
}

/** Validate image path relative to src/assets/images/ (allows nested folders) */
function isSafeImageRelPath(relPath) {
  if (typeof relPath !== 'string') return false;
  const cleaned = relPath.trim().replace(/\\/g, '/');
  if (!cleaned || cleaned.startsWith('/')) return false;
  if (cleaned.includes('..') || cleaned.includes('//')) return false;
  // Allow alnum, underscore, dash, dot, space, and forward slashes.
  return /^[\w\-. /]+$/.test(cleaned);
}

/** Validate image reference path (/assets/images/<path>) from page source */
function isSafeOldImageRef(oldImageRef) {
  if (typeof oldImageRef !== 'string') return false;
  const cleaned = oldImageRef.trim();
  if (!cleaned.startsWith('/assets/images/')) return false;
  const rel = cleaned.slice('/assets/images/'.length).replace(/\\/g, '/');
  if (!rel || rel.includes('..') || rel.includes('//')) return false;
  return /^[\w\-. /]+$/.test(rel);
}

/** Validate that filepath stays inside SRC_CONTENT */
function isInsideSrcContent(filepath) {
  const rel = path.relative(SRC_CONTENT, filepath);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Replace every /assets/images/<oldImagePathNoExt>.<any-ext> occurrence in the
 * source file with /assets/images/<newImageRelPath>.
 */
function swapImageInFile(sourceFile, oldImageRefNoExt, newImageRelPath, pictureInstanceIndex, clickedImgAlt) {
  const instanceIndex = Number.isInteger(pictureInstanceIndex) ? pictureInstanceIndex : 0;

  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Source file not found: ${path.relative(ROOT, sourceFile)}`);
  }
  if (!isInsideSrcContent(sourceFile)) {
    throw new Error('Security: target file is outside src/content/');
  }
  if (!isSafeOldImageRef(oldImageRefNoExt)) throw new Error('Invalid oldImageRefNoExt characters');
  if (!isSafeImageRelPath(newImageRelPath)) throw new Error('Invalid newImageRelPath characters');
  if (instanceIndex < 0) {
    throw new Error('Invalid pictureInstanceIndex');
  }

  // Verify new image actually exists in our images folder
  const normalizedNewRel = toWebPath(newImageRelPath);
  const absoluteNewImage = path.resolve(SRC_IMAGES, normalizedNewRel);
  const relativeBack = path.relative(SRC_IMAGES, absoluteNewImage);
  if (relativeBack.startsWith('..') || path.isAbsolute(relativeBack) || !fs.existsSync(absoluteNewImage)) {
    throw new Error(`Image not found in src/assets/images/: ${normalizedNewRel}`);
  }

  const content = fs.readFileSync(sourceFile, 'utf-8');

  // First try exact path match: /assets/images/<oldImagePathNoExt>.<ext>
  const exactRegex = new RegExp(
    escapeRegExp(oldImageRefNoExt) + '\\.[a-zA-Z0-9]+',
    'g'
  );

  const replacement = `/assets/images/${normalizedNewRel}`;
  const oldLeafBase = path.posix.basename(oldImageRefNoExt);
  const fallbackRegex = new RegExp(
    '/assets/images/(?:[^/\\s"\'()]+/)*' + escapeRegExp(oldLeafBase) + '\\.[a-zA-Z0-9]+',
    'g'
  );

  /** Return unique <picture> block ranges containing regex matches */
  function getPictureBlocksForRegex(regex) {
    const ranges = [];
    const scanner = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    let match;
    while ((match = scanner.exec(content)) !== null) {
      const idx = match.index;
      const start = content.lastIndexOf('<picture', idx);
      const closeStart = content.indexOf('</picture>', idx);
      if (start === -1 || closeStart === -1) continue;
      const end = closeStart + '</picture>'.length;
      const prev = ranges[ranges.length - 1];
      if (!prev || prev.start !== start || prev.end !== end) {
        ranges.push({ start, end });
      }
      if (scanner.lastIndex === match.index) scanner.lastIndex += 1;
    }
    return ranges;
  }

  // Prefer exact-path matches; if none, fall back to leaf-filename matching.
  let activeRegex = exactRegex;
  let pictureBlocks = getPictureBlocksForRegex(exactRegex);
  if (pictureBlocks.length === 0) {
    activeRegex = fallbackRegex;
    pictureBlocks = getPictureBlocksForRegex(fallbackRegex);
  }

  if (pictureBlocks.length === 0) {
    throw new Error(`Pattern "${oldImageRefNoExt}.<ext>" not found in source file (exact or basename fallback). ` +
      'Try clicking the image again or check the source manually.');
  }

  let resolvedIndex = instanceIndex;

  // Optional disambiguation for repeated images: match the clicked img alt text.
  const altHint = typeof clickedImgAlt === 'string' ? clickedImgAlt.trim() : '';
  if (altHint && pictureBlocks.length > 1) {
    const escapedAlt = altHint.replace(/"/g, '&quot;');
    const altMatches = pictureBlocks
      .map((range, idx) => ({
        idx,
        block: content.slice(range.start, range.end)
      }))
      .filter(({ block }) =>
        block.includes(`alt="${altHint}"`) ||
        block.includes(`alt='${altHint}'`) ||
        block.includes(`alt="${escapedAlt}"`) ||
        block.includes(`alt='${escapedAlt}'`)
      )
      .map(({ idx }) => idx);

    if (altMatches.length === 1) {
      resolvedIndex = altMatches[0];
    }
  }

  if (resolvedIndex >= pictureBlocks.length) {
    throw new Error(
      `Picture instance ${resolvedIndex + 1} is out of range for "${oldImageRefNoExt}". ` +
      `Found ${pictureBlocks.length} matching picture block(s).`
    );
  }

  const target = pictureBlocks[resolvedIndex];
  const before = content.slice(0, target.start);
  const block  = content.slice(target.start, target.end);
  const after  = content.slice(target.end);

  const blockRegex = new RegExp(activeRegex.source, activeRegex.flags.includes('g') ? activeRegex.flags : activeRegex.flags + 'g');
  const matchCount = (block.match(blockRegex) || []).length;
  const replacedBlock = block.replace(blockRegex, replacement);
  if (replacedBlock === block || matchCount === 0) {
    throw new Error(`Could not swap image in selected picture block for "${oldImageRefNoExt}".`);
  }

  const updated = before + replacedBlock + after;

  fs.writeFileSync(sourceFile, updated, 'utf-8');
  return { replacements: matchCount, resolvedIndex };
}

// ─── Client script (served at /image-picker-client.js) ──────────────────────

const CLIENT_SCRIPT = /* js */ `
/* ===== Image Picker Dev Tool — loaded from image-picker-server.js ===== */
(function () {
  'use strict';

  const SERVER = 'http://localhost:3001';
  let enabled  = localStorage.getItem('imgPickerOn') === 'true';

  // ── State ─────────────────────────────────────────────────────────────────
  let overlay        = null;
  let activePicture  = null;
  let activeOldImageRefNoExt = null;
  let activePictureInstanceIndex = 0;
  let activeClickedImgAlt = '';

  function getPictureOldImageRefNoExt(picture) {
    if (!picture) return null;
    const img = picture.querySelector('img');
    if (!img) return null;

    // Prefer the img src; fall back to first source srcset
    let src = img.getAttribute('src') || '';
    if (!src) {
      const firstSrc = picture.querySelector('source');
      src = (firstSrc?.getAttribute('srcset') || '').split(',')[0].trim().split(' ')[0];
    }

    const cleanSrc = src.split('?')[0];
    const marker = '/assets/images/';
    const markerIdx = cleanSrc.indexOf(marker);
    if (markerIdx === -1) return null;

    const relWithExt = cleanSrc.slice(markerIdx + marker.length);
    if (!relWithExt) return null;

    // Strip 8-char hex hash appended by image pipeline, e.g. photo-a1b2c3d4.jpg
    const hashMatch = relWithExt.match(/^(.+)-[0-9a-f]{8}\.(jpe?g|png|avif|webp|gif|svg)$/i);
    const relNoExt = (hashMatch ? hashMatch[1] : relWithExt.replace(/\.[^.]+$/, ''));
    return marker + relNoExt;
  }

  // ── Toggle button ─────────────────────────────────────────────────────────
  const btn = Object.assign(document.createElement('button'), { id: 'img-picker-btn' });
  btn.style.cssText = [
    'position:fixed;bottom:16px;right:16px;z-index:2147483647',
    'padding:8px 14px;border:none;border-radius:8px;cursor:pointer',
    'font:600 13px/1.4 system-ui,sans-serif',
    'box-shadow:0 2px 10px rgba(0,0,0,.35);transition:background .2s,transform .1s',
  ].join(';');
  document.body.appendChild(btn);
  syncBtn();

  btn.addEventListener('click', () => {
    enabled = !enabled;
    localStorage.setItem('imgPickerOn', enabled);
    syncBtn();
    applyHighlights();
  });

  function syncBtn() {
    btn.textContent = enabled ? '🖼 Picker ON' : '🖼 Picker';
    btn.style.background = enabled ? '#2563eb' : '#475569';
    btn.style.color = '#fff';
  }

  // ── Highlight pictures ────────────────────────────────────────────────────
  function applyHighlights() {
    document.querySelectorAll('picture, picture img').forEach(el => {
      if (enabled) {
        el.style.outline       = '2px dashed #3b82f6';
        el.style.outlineOffset = '2px';
        el.style.cursor        = 'pointer';
      } else {
        el.style.outline       = '';
        el.style.outlineOffset = '';
        el.style.cursor        = '';
      }
    });
  }
  applyHighlights();

  // Re-apply after navigations / dynamic content if any
  const mo = new MutationObserver(() => { if (enabled) applyHighlights(); });
  mo.observe(document.body, { childList: true, subtree: true });

  // ── Click intercept ───────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    if (!enabled) return;
    const picture = e.target.closest('picture');
    if (!picture) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const oldImageRefNoExt = getPictureOldImageRefNoExt(picture);
    if (!oldImageRefNoExt) return;

    const clickedImgAlt = (picture.querySelector('img')?.getAttribute('alt') || '').trim();

    const samePictures = Array.from(document.querySelectorAll('picture'))
      .filter(p => getPictureOldImageRefNoExt(p) === oldImageRefNoExt);
    const instanceIndex = Math.max(0, samePictures.indexOf(picture));

    activePicture = picture;
    activeOldImageRefNoExt = oldImageRefNoExt;
    activePictureInstanceIndex = instanceIndex;
    activeClickedImgAlt = clickedImgAlt;
    openPicker(oldImageRefNoExt);
  }, true);

  // ── Picker modal ──────────────────────────────────────────────────────────
  async function openPicker(currentImageRefNoExt) {
    // Replace any existing modal UI but keep active selection context.
    if (overlay) { overlay.remove(); overlay = null; }

    let images;
    try {
      const r = await fetch(SERVER + '/api/images');
      if (!r.ok) throw new Error('Server responded ' + r.status);
      images = await r.json();
    } catch (err) {
      alert('Image picker server is not running.\\nStart it with: npm run image-picker');
      return;
    }

    overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed;inset:0;background:rgba(0,0,0,.65)',
      'z-index:2147483646;display:flex;align-items:center;justify-content:center',
      'animation:ipFadeIn .15s ease',
    ].join(';');

    // Inject keyframes once
    if (!document.getElementById('ip-kf')) {
      const style = document.createElement('style');
      style.id = 'ip-kf';
      style.textContent = '@keyframes ipFadeIn{from{opacity:0}to{opacity:1}}';
      document.head.appendChild(style);
    }

    const modal = document.createElement('div');
    modal.style.cssText = [
      'background:#1e1e2e;color:#e2e8f0;border-radius:14px;padding:24px',
      'width:min(1100px,94vw);height:min(86vh,820px);display:flex;flex-direction:column;overflow:hidden',
      'font-family:system-ui,sans-serif;box-shadow:0 12px 50px rgba(0,0,0,.7)',
    ].join(';');

    modal.innerHTML = \`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;gap:12px">
        <div>
          <div style="font-size:15px;font-weight:700;margin-bottom:3px">Replace image</div>
          <div style="font-size:12px;color:#94a3b8">Current: <code style="color:#93c5fd">\${currentImageRefNoExt}</code>
            &nbsp;·&nbsp; Replaces only this selected picture</div>
        </div>
        <button id="ip-x" style="background:none;border:none;color:#94a3b8;font-size:22px;
          cursor:pointer;line-height:1;padding:0;flex-shrink:0">✕</button>
      </div>
      <div id="ip-grid" style="
        flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding-right:8px;padding-bottom:2px;
        display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
        grid-auto-rows:minmax(188px,auto);gap:12px;align-content:start
      "></div>
    \`;

    const grid = modal.querySelector('#ip-grid');

    images.forEach(function (name) {
      const relNoExt = name.replace(/\\.[^.]+$/, '');
      const isActive = '/assets/images/' + relNoExt === currentImageRefNoExt;
      const card = document.createElement('div');
      card.title = name;
      card.style.cssText = [
        'border-radius:10px;overflow:hidden;cursor:pointer',
        'border:2px solid ' + (isActive ? '#3b82f6' : 'transparent'),
        'display:flex;flex-direction:column;min-height:188px',
        'min-width:0',
        'background:#2d2d3f;transition:border-color .15s,transform .15s,box-shadow .15s',
      ].join(';');
      card.innerHTML = \`
        <div style="height:150px;overflow:hidden;background:#1a1a2e">
          <img src="\${SERVER}/src-images/\${encodeURIComponent(name)}"
               style="width:100%;height:100%;object-fit:cover;display:block"
               loading="lazy" decoding="async"
               onerror="this.parentNode.style.background='#374151';this.remove()">
        </div>
        <div style="padding:6px 8px;font-size:11px;color:#94a3b8;word-break:break-all;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${name}</div>
      \`;

      card.addEventListener('mouseenter', function () {
        card.style.borderColor = isActive ? '#60a5fa' : '#3b82f6';
        card.style.transform   = 'scale(1.03)';
        card.style.boxShadow   = '0 4px 14px rgba(59,130,246,.35)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.borderColor = isActive ? '#3b82f6' : 'transparent';
        card.style.transform   = '';
        card.style.boxShadow   = '';
      });
      card.addEventListener('click', function () { selectImage(name, currentImageRefNoExt); });
      grid.appendChild(card);
    });

    modal.querySelector('#ip-x').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // ── Select & swap ─────────────────────────────────────────────────────────
  async function selectImage(newImageRelPath, oldImageRefNoExt) {
    const pageUrl    = window.location.pathname;
    const pictureRef = activePicture; // capture before closeModal resets it
    const pictureInstanceIndex = activePictureInstanceIndex;
    const clickedImgAlt = activeClickedImgAlt;
    let result;
    try {
      const r = await fetch(SERVER + '/api/swap', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pageUrl, oldImageRefNoExt, newImageRelPath, pictureInstanceIndex, clickedImgAlt }),
      });
      result = await r.json();
    } catch (err) {
      alert('Server error: ' + err.message);
      return;
    }

    if (result.success) {
      closeModal();
      // Flash green to confirm, then reload
      if (pictureRef) {
        pictureRef.style.outline = '3px solid #22c55e';
        pictureRef.style.outlineOffset = '2px';
      }
      setTimeout(function () { window.location.reload(); }, 700);
    } else {
      alert('Swap failed: ' + result.error);
    }
  }

  function closeModal() {
    if (overlay) { overlay.remove(); overlay = null; }
    activePicture = null;
    activeOldImageRefNoExt = null;
    activePictureInstanceIndex = 0;
    activeClickedImgAlt = '';
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
})();
`;

// ─── HTTP server ──────────────────────────────────────────────────────────────

// Build URL→source-file map once at startup (rebuild on each request to pick up new files)
let urlMap = {};
try { urlMap = buildUrlMap(); } catch (e) { /* empty content dir is OK */ }

const server = http.createServer(function (req, res) {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // Refresh map for each swap so new pages are picked up without restarting
  if (req.method === 'POST') {
    try { urlMap = buildUrlMap(); } catch (_) {}
  }

  // ── CORS (localhost only) ────────────────────────────────────────────────
  const origin = req.headers.origin || '';
  if (origin && !origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  res.setHeader('Access-Control-Allow-Origin',  origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // ── Serve client JS ──────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/image-picker-client.js') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(200);
    return res.end(CLIENT_SCRIPT);
  }

  // ── GET /api/images ──────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/images') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    return res.end(JSON.stringify(getImages()));
  }

  // ── GET /src-images/<path> — thumbnail previews ──────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/src-images/')) {
    const raw = decodeURIComponent(pathname.slice('/src-images/'.length));
    const relPath = toWebPath(raw);
    if (!isSafeImageRelPath(relPath)) { res.writeHead(400); return res.end('Bad request'); }

    const filepath = path.resolve(SRC_IMAGES, relPath);
    const relBack = path.relative(SRC_IMAGES, filepath);
    if (relBack.startsWith('..') || path.isAbsolute(relBack)) {
      res.writeHead(400);
      return res.end('Bad request');
    }
    if (!fs.existsSync(filepath)) { res.writeHead(404); return res.end('Not found'); }

    const ext = path.extname(filepath).toLowerCase().slice(1);
    const mime = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
                   webp:'image/webp', avif:'image/avif', gif:'image/gif',
                   svg:'image/svg+xml' };
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.writeHead(200);
    return res.end(fs.readFileSync(filepath));
  }

  // ── POST /api/swap ────────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/swap') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      const send = (code, payload) => {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(code);
        res.end(JSON.stringify(payload));
      };

      try {
        const { pageUrl, oldImageRefNoExt, newImageRelPath, pictureInstanceIndex, clickedImgAlt } = JSON.parse(body);
        if (!pageUrl || !oldImageRefNoExt || !newImageRelPath) throw new Error('Missing parameters');
        const normalizedPictureIndex = Number.isInteger(pictureInstanceIndex) ? pictureInstanceIndex : 0;

        // Normalize URL
        let normalUrl = pageUrl;
        if (!normalUrl.endsWith('/')) normalUrl += '/';

        const sourceFile = urlMap[normalUrl];
        if (!sourceFile) {
          throw new Error(
            `Could not map URL "${pageUrl}" to a source file.\n` +
            `Known URLs: ${Object.keys(urlMap).slice(0,8).join(', ')}`
          );
        }

        const swapResult = swapImageInFile(
          sourceFile,
          oldImageRefNoExt,
          newImageRelPath,
          normalizedPictureIndex,
          clickedImgAlt
        );
        const count = swapResult.replacements;
        const resolvedIndex = swapResult.resolvedIndex;
        const rel   = path.relative(ROOT, sourceFile).replace(/\\/g, '/');
        console.log(
          `✅  Swapped  "${oldImageRefNoExt}" → "/assets/images/${newImageRelPath}" ` +
          `(${count} occurrence${count!==1?'s':''}) in ${rel} ` +
          `(requested picture ${normalizedPictureIndex + 1}, resolved picture ${resolvedIndex + 1})`
        );
        send(200, {
          success: true,
          sourceFile: rel,
          replacements: count,
          requestedPictureInstance: normalizedPictureIndex,
          resolvedPictureInstance: resolvedIndex
        });
      } catch (err) {
        console.error('❌  Swap failed:', err.message);
        send(400, { success: false, error: err.message });
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  const images = getImages();
  console.log('\n┌──────────────────────────────────────────────────────┐');
  console.log('│  🖼   Image Picker Server                             │');
  console.log('├──────────────────────────────────────────────────────┤');
  console.log(`│  Listening on  http://127.0.0.1:${PORT}                  │`);
  console.log(`│  Images found: ${String(images.length).padEnd(3)} in src/assets/images/         │`);
  console.log('├──────────────────────────────────────────────────────┤');
  console.log('│  Next step: uncomment the <script> tag in            │');
  console.log('│  src/_includes/layouts/base.html  (search IMAGE PICKER)│');
  console.log('└──────────────────────────────────────────────────────┘\n');

  if (images.length > 0) {
    console.log('  Available images:');
    images.forEach(f => console.log('   •', f));
    console.log();
  }
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Port ${PORT} is already in use. Stop the other process or change PORT at the top of this file.\n`);
  } else {
    console.error('\n❌  Server error:', err.message, '\n');
  }
  process.exit(1);
});
