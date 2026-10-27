# Changelog

## [1.0.0] - 2026-10-27

### Added
- Console script (`src/rayyan-dedup-bot.js`): keeps the left article at ≥ 95 % similarity, otherwise keeps both.
- Tampermonkey userscript (`src/rayyan-dedup-bot.user.js`) with a control panel: threshold, max actions, Test, Start and Stop.
- Safety stops: window closed, missing score or button, next pair not loading.
