// ==UserScript==
// @name         Rayyan Duplicate Resolver Bot
// @namespace    https://github.com/YOUR-USERNAME/rayyan-dedup-bot
// @version      1.0.0
// @description  Resolves Rayyan duplicate pairs automatically: keeps the left article when similarity >= threshold, otherwise keeps both.
// @author       Cem Kağba
// @license      MIT
// @match        https://new.rayyan.ai/*
// @match        https://rayyan.ai/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULTS = { threshold: 95, pauseMs: 800, waitLimit: 20000 };
  const LS_KEY = 'rayyanDedupBot.settings';

  const load = () => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  };
  const save = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- page helpers ----------
  const root = () =>
    [...document.querySelectorAll('[role="dialog"], .modal, [class*="modal"]')]
      .find((el) => el.offsetParent !== null && /Resolve duplicates/i.test(el.innerText)) || null;

  const isVisible = (el) => el && el.offsetParent !== null && !el.disabled &&
    el.getAttribute('aria-disabled') !== 'true';

  const findButton = (scope, label) =>
    [...scope.querySelectorAll('button, [role="button"], a')]
      .find((b) => b.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === label.toLowerCase() && isVisible(b));

  const getSimilarities = (scope) =>
    [...scope.innerText.matchAll(/Similarity:\s*(\d+(?:[.,]\d+)?)\s*%/gi)]
      .map((m) => parseFloat(m[1].replace(',', '.')));

  const getProgress = (scope) => {
    const m = scope.innerText.match(/([\d,]+)\s*done\s*\|\s*([\d,]+)\s*articles left/i);
    return m ? { done: +m[1].replace(/,/g, ''), left: +m[2].replace(/,/g, '') } : null;
  };

  const signature = (scope) => {
    const t = scope.innerText;
    const p = getProgress(scope);
    return [
      p ? `${p.done}/${p.left}` : '',
      (t.match(/Comparing[^\n]*/i) || [''])[0],
      (t.match(/DOI:\s*\n?\s*(\S+)/i) || ['', ''])[1],
      t.slice(0, 400),
    ].join('|');
  };

  // ---------- control panel ----------
  const panel = document.createElement('div');
  panel.id = 'rayyan-dedup-bot';
  panel.innerHTML = `
    <style>
      #rayyan-dedup-bot{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:260px;
        font:13px/1.4 system-ui,sans-serif;color:#1f2937;background:#fff;border:1px solid #d1d5db;
        border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:12px}
      #rayyan-dedup-bot h4{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;align-items:center}
      #rayyan-dedup-bot label{display:flex;justify-content:space-between;align-items:center;margin:6px 0}
      #rayyan-dedup-bot input[type=number]{width:64px;padding:2px 4px;border:1px solid #d1d5db;border-radius:6px}
      #rayyan-dedup-bot .row{display:flex;gap:6px;margin-top:8px}
      #rayyan-dedup-bot button{flex:1;padding:6px;border:0;border-radius:6px;cursor:pointer;font-weight:600}
      #rdb-start{background:#4f46e5;color:#fff} #rdb-stop{background:#fee2e2;color:#b91c1c}
      #rdb-test{background:#eef2ff;color:#4338ca}
      #rayyan-dedup-bot button:disabled{opacity:.45;cursor:default}
      #rdb-status{margin-top:8px;padding:6px;background:#f9fafb;border-radius:6px;min-height:34px;white-space:pre-line}
      #rdb-min{background:none;border:0;cursor:pointer;font-size:16px;flex:0;padding:0 4px}
    </style>
    <h4>Duplicate Resolver <button id="rdb-min" title="Minimise">–</button></h4>
    <div id="rdb-body">
      <label>Keep left if similarity ≥ <span><input id="rdb-th" type="number" min="0" max="100" step="1"> %</span></label>
      <label>Max actions (0 = no limit) <input id="rdb-max" type="number" min="0" step="1" value="0"></label>
      <div class="row">
        <button id="rdb-test" title="Show the decision for the current pair without clicking">Test</button>
        <button id="rdb-start">Start</button>
        <button id="rdb-stop" disabled>Stop</button>
      </div>
      <div id="rdb-status">Open "Resolve duplicates", then press Start.</div>
    </div>`;
  document.documentElement.appendChild(panel);

  const $ = (id) => panel.querySelector('#' + id);
  const settings = load();
  $('rdb-th').value = settings.threshold;
  $('rdb-th').addEventListener('change', () => {
    const v = Math.min(100, Math.max(0, Number($('rdb-th').value) || DEFAULTS.threshold));
    $('rdb-th').value = v; settings.threshold = v; save(settings);
  });
  $('rdb-min').addEventListener('click', () => {
    const body = $('rdb-body'); const hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none'; $('rdb-min').textContent = hidden ? '–' : '+';
  });

  const status = (msg) => { $('rdb-status').textContent = msg; console.log('[Rayyan bot] ' + msg); };

  let running = false, stopRequested = false;

  const decide = (scope) => {
    const sims = getSimilarities(scope);
    if (!sims.length) return null;
    const sim = Math.min(...sims); // lowest score shown, to stay on the safe side
    return { sim, label: sim >= settings.threshold ? 'Keep left article' : 'Keep both articles' };
  };

  $('rdb-test').addEventListener('click', () => {
    const scope = root();
    if (!scope) return status('Resolve duplicates window not found.');
    const d = decide(scope);
    if (!d) return status('No similarity score visible yet.');
    status(`Test: similarity ${d.sim}% → would click "${d.label}"` +
      (findButton(scope, d.label) ? '' : '\n(button NOT found!)'));
  });

  $('rdb-stop').addEventListener('click', () => { stopRequested = true; status('Stopping…'); });

  $('rdb-start').addEventListener('click', async () => {
    if (running) return;
    running = true; stopRequested = false;
    $('rdb-start').disabled = true; $('rdb-test').disabled = true; $('rdb-stop').disabled = false;

    const max = Number($('rdb-max').value) || Infinity;
    let actions = 0, keptLeft = 0, keptBoth = 0, reason = 'Stopped.';

    try {
      while (!stopRequested && actions < max) {
        // wait for a pair with a similarity score
        let scope = null, d = null; const t0 = Date.now();
        while (Date.now() - t0 < settings.waitLimit && !stopRequested) {
          scope = root(); d = scope && decide(scope);
          if (d) break;
          await sleep(300);
        }
        if (stopRequested) break;
        if (!scope) { reason = 'Resolve duplicates window is not open.'; break; }
        if (!d) { reason = 'No similarity score found.'; break; }

        const btn = findButton(scope, d.label);
        if (!btn) { reason = `Button "${d.label}" not found.`; break; }

        const prog = getProgress(scope);
        const before = signature(scope);
        btn.click();
        actions++; d.sim >= settings.threshold ? keptLeft++ : keptBoth++;
        status(`#${actions}: ${d.sim}% → ${d.label}\nLeft: ${keptLeft} · Both: ${keptBoth}` +
          (prog ? ` · ${prog.left} left` : ''));

        // wait for the next pair to load
        let moved = false; const t1 = Date.now();
        while (Date.now() - t1 < settings.waitLimit && !stopRequested) {
          await sleep(300);
          const s = root();
          if (!s) break;
          if (signature(s) !== before && getSimilarities(s).length) { moved = true; break; }
        }
        if (!moved) {
          reason = prog && prog.left <= 1 ? 'All duplicates seem resolved.'
            : 'Next pair did not load in time — press Start again.';
          break;
        }
        await sleep(settings.pauseMs);
      }
      if (actions >= max) reason = `Reached max actions (${max}).`;
    } catch (e) {
      reason = 'Error: ' + e.message; console.error(e);
    } finally {
      status(`${reason}\nDone ${actions}: ${keptLeft} kept left, ${keptBoth} kept both.`);
      running = false;
      $('rdb-start').disabled = false; $('rdb-test').disabled = false; $('rdb-stop').disabled = true;
    }
  });
})();
