// Rayyan duplicate-resolver bot
// Rule: similarity >= THRESHOLD  -> "Keep left article"
//       similarity <  THRESHOLD  -> "Keep both articles"
//
// HOW TO USE
// 1. In Rayyan, open the "Resolve duplicates" window (Overview -> Continue resolving).
// 2. Press F12 -> Console tab. (If Chrome blocks pasting, type: allow pasting  and press Enter.)
// 3. Paste this whole script and press Enter.
// 4. To stop at any time, type in the console:  rayyanBotStop = true
//
// Tip: run once with DRY_RUN = true to see what it WOULD click, then set it to false.

(async () => {
  const THRESHOLD   = 95;       // % similarity needed to keep only the left article
  const DRY_RUN     = false;    // true = only log decisions, click nothing
  const MAX_ACTIONS = Infinity; // e.g. 20 to test on a small batch first
  const PAUSE_MS    = 800;      // pause between pairs (don't go too fast)
  const WAIT_LIMIT  = 20000;    // max ms to wait for the next pair to load

  window.rayyanBotStop = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const root = () =>
    [...document.querySelectorAll('[role="dialog"], .modal, [class*="modal"]')]
      .find((el) => el.offsetParent !== null && /Resolve duplicates/i.test(el.innerText)) ||
    document.body;

  const isVisible = (el) => el && el.offsetParent !== null && !el.disabled &&
    el.getAttribute('aria-disabled') !== 'true';

  const findButton = (label) =>
    [...root().querySelectorAll('button, [role="button"], a')]
      .find((b) => b.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === label.toLowerCase() && isVisible(b));

  const getSimilarities = () =>
    [...root().innerText.matchAll(/Similarity:\s*(\d+(?:[.,]\d+)?)\s*%/gi)]
      .map((m) => parseFloat(m[1].replace(',', '.')));

  const getProgress = () => {
    const m = root().innerText.match(/([\d,]+)\s*done\s*\|\s*([\d,]+)\s*articles left/i);
    return m ? { done: +m[1].replace(/,/g, ''), left: +m[2].replace(/,/g, '') } : null;
  };

  // Fingerprint of the pair currently shown, used to detect when the next pair has loaded
  const signature = () => {
    const t = root().innerText;
    const p = getProgress();
    return [
      p ? `${p.done}/${p.left}` : '',
      (t.match(/Comparing[^\n]*/i) || [''])[0],
      (t.match(/DOI:\s*\n?\s*(\S+)/i) || ['', ''])[1],
      t.slice(0, 400),
    ].join('|');
  };

  const waitForChange = async (oldSig) => {
    const start = Date.now();
    while (Date.now() - start < WAIT_LIMIT) {
      await sleep(300);
      if (window.rayyanBotStop) return false;
      if (signature() !== oldSig && getSimilarities().length) return true;
      if (!/Resolve duplicates/i.test(root().innerText)) return false; // window closed
    }
    return false;
  };

  const waitForSimilarity = async () => {
    const start = Date.now();
    while (Date.now() - start < WAIT_LIMIT) {
      const s = getSimilarities();
      if (s.length) return s;
      await sleep(300);
    }
    return [];
  };

  let actions = 0, keptLeft = 0, keptBoth = 0;
  console.log(`%c[Rayyan bot] started — threshold ${THRESHOLD}%${DRY_RUN ? ' (DRY RUN)' : ''}`, 'color:#4f46e5;font-weight:bold');

  while (!window.rayyanBotStop && actions < MAX_ACTIONS) {
    const sims = await waitForSimilarity();
    if (!sims.length) { console.warn('[Rayyan bot] No similarity score found — stopping. Is the Resolve duplicates window open?'); break; }

    // Use the LOWEST score shown (both panels show one) to stay on the safe side
    const sim = Math.min(...sims);
    const label = sim >= THRESHOLD ? 'Keep left article' : 'Keep both articles';
    const btn = findButton(label);
    const prog = getProgress();

    if (!btn) { console.warn(`[Rayyan bot] Button "${label}" not found — stopping.`); break; }

    console.log(`[Rayyan bot] #${actions + 1}  similarity ${sim}%  ->  ${label}` +
      (prog ? `   (${prog.done} done, ${prog.left} left)` : ''));

    if (DRY_RUN) { console.log('[Rayyan bot] Dry run: stopping after first decision.'); break; }

    const before = signature();
    btn.click();
    actions++;
    sim >= THRESHOLD ? keptLeft++ : keptBoth++;

    const moved = await waitForChange(before);
    if (!moved) {
      if (prog && prog.left <= 1) console.log('[Rayyan bot] Looks like everything is resolved.');
      else console.warn('[Rayyan bot] Next pair did not load in time (or window closed) — stopping. Just run the script again.');
      break;
    }
    await sleep(PAUSE_MS);
  }

  console.log(`%c[Rayyan bot] finished — ${actions} actions: ${keptLeft} kept left, ${keptBoth} kept both.`, 'color:#16a34a;font-weight:bold');
})();
