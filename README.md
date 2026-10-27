# Rayyan Duplicate Resolver Bot

Resolves duplicate pairs in [Rayyan](https://www.rayyan.ai/) automatically, for systematic reviews with thousands of imported references.

For each pair in the **Resolve duplicates** window it reads the similarity score and clicks:

| Similarity | Action |
|---|---|
| **≥ 95 %** (configurable) | **Keep left article** |
| **< 95 %** | **Keep both articles** |

When the two panels show different scores, the bot uses the lower one, to stay on the safe side.

> ⚠️ **Not affiliated with Rayyan.** This is an unofficial helper that clicks the same buttons you would. Use it at your own risk and check Rayyan's terms of use. Always spot-check the results before screening.

---

## Two ways to use it

### Option A: Tampermonkey userscript (recommended)

Adds a small control panel (threshold, **Test**, **Start**, **Stop**) to Rayyan.

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension (Chrome, Edge, Firefox, Safari).
2. Open [`src/rayyan-dedup-bot.user.js`](src/rayyan-dedup-bot.user.js) on GitHub and click **Raw**. Tampermonkey offers to install it.
3. In Rayyan, go to **Overview → Continue resolving** to open the *Resolve duplicates* window.
4. In the panel at the bottom right:
   - **Test** shows what the bot would click for the current pair, without clicking.
   - **Start** begins resolving. **Stop** halts it at any time.
   - **Max actions** limits a run, for example `20` for a first try. Leave it at `0` for no limit.

The threshold you set is remembered in your browser.

### Option B: Paste in the browser console (no install)

1. Open the *Resolve duplicates* window in Rayyan.
2. Press **F12** and open the **Console** tab. If Chrome blocks pasting, type `allow pasting` and press Enter.
3. Paste the contents of [`src/rayyan-dedup-bot.js`](src/rayyan-dedup-bot.js) and press Enter.
4. To stop, type `rayyanBotStop = true` in the console.

Settings are at the top of the script:

```js
const THRESHOLD   = 95;       // % similarity needed to keep only the left article
const DRY_RUN     = false;    // true = only log the decision, click nothing
const MAX_ACTIONS = Infinity; // e.g. 20 to test on a small batch first
```

---

## How it works

1. It finds the *Resolve duplicates* window and reads every `Similarity: NN%` value in it.
2. It compares the lowest value with the threshold and clicks the matching button.
3. It waits until the next pair has loaded (the progress counter, the pair or the DOI changes), then repeats.
4. It stops on its own when the window closes, no score is found, a button is missing, or nothing loads for 20 seconds.

No data leaves your browser. The bot only reads the page and clicks buttons.

## Good practice for systematic reviews

- **Test on a small batch first** (Max actions = 20) and check the decisions.
- **Think about 95–99 % matches.** Some different records can score this high: a conference abstract and the full paper, an erratum and its original article, or parts of a series. Consider a higher threshold (e.g. 98–100) or a manual check of that range.
- **Report it in your methods.** For PRISMA, state that duplicates were resolved semi-automatically with a ≥ 95 % similarity rule and spot-checked.
- Rayyan's own **Run Auto Resolver** button may already clear exact matches, so you can run it first.

## Troubleshooting

| Problem | What to do |
|---|---|
| "Button not found" | Rayyan may have renamed the button. Open an issue with a screenshot. |
| "Next pair did not load in time" | Rayyan was slow. Press **Start** again (or re-paste the script); it continues where it stopped. |
| Panel does not appear | Check that Tampermonkey is enabled and the URL is `new.rayyan.ai`. Reload the page. |

## Contributing

Issues and pull requests are welcome. If Rayyan changes its interface, the button labels and the `Similarity:` text pattern are the parts to update.

## License

[MIT](LICENSE) © 2026 Cem Kağba
