# Pixel Gym Journal

A cozy, pixel-art gym progress journal for Windows. Fully offline: your data stays on this computer.

## Everyday use

Install once with `release/<version>/Pixel-Gym-Journal-Setup-<version>.exe`, then open **Pixel Gym Journal** from the desktop or Start menu. No terminal needed.

- **Today**: today's plan (or rest day), Start / Resume workout, this week at a glance, recent records.
- **Workout**: log weight × reps per set. Empty fields adopt the grey suggestion (last session, or the routine target). `Enter` moves weight → reps → next set; `Ctrl+Enter` finishes. Everything saves instantly, so an unfinished workout survives closing the app.
- **Routines / Schedule / Exercises**: build routines, pin them to weekdays, override single dates.
- **History**: browse and correct past workouts (date, sets, notes).
- **Progress**: per-exercise trends, personal records (rules are explained in the Records tab), bodyweight log.
- **Settings**: kg/lb, rest timer, JSON backup export/restore, erase all data.

Data lives in `%APPDATA%\Pixel Gym Journal` (IndexedDB), separate from the installed program files. Installer updates and uninstalls leave it in place. Export a backup now and then.

## Development

```bash
npm install
npm run dev          # Electron + Vite dev server with hot reload (F12 opens DevTools)
npm test             # data-layer unit tests (Vitest + fake-indexeddb)
npm run typecheck    # tsc (main/preload) + vue-tsc (renderer)
npm run build        # typecheck + production bundle in out/
npm run e2e          # drives the built app end-to-end (run `npm run build` first); screenshots in e2e-shots/
npm run icons        # regenerate build/icon.ico + icon.png from pixel art
```

Development runs use a separate data folder (`%APPDATA%\Pixel Gym Journal (Dev)`), so they never touch your real journal.

> If Electron starts as plain Node (`Cannot read properties of undefined (reading 'registerSchemesAsPrivileged')`), your shell has `ELECTRON_RUN_AS_NODE=1` set (some editor-integrated terminals do this). Unset it and run again.

## Building the Windows installer

```bash
npm run dist
```

Output: `release/<version>/Pixel-Gym-Journal-Setup-<version>.exe` (NSIS, per-user install, desktop + Start menu shortcuts). `npm run dist:dir` builds an unpacked app in `release/<version>/win-unpacked/` without the installer.

The installer is not code-signed, so Windows SmartScreen may warn on first run ("More info" → "Run anyway").

## Architecture notes

- **Electron**: context isolation + sandbox on, Node integration off. The preload exposes only `getAppInfo`, `saveBackup` and `openBackup`. Production loads bundled files from a custom `app://bundle` origin, which keeps IndexedDB attached to the same storage regardless of install location or version.
- **Data**: Dexie schema with versioned migrations in `src/renderer/src/lib/db.ts`. Weights are stored in kg at full precision; kg/lb is display-only and lossless. Dates are local `YYYY-MM-DD` keys. Logged sessions keep a snapshot of the exercise and routine names, so editing or deleting them never changes history.
- **UI**: Vue 3 + Tailwind v4. shadcn-vue-style components (reka-ui) restyled with pixel borders. Every icon is drawn from one pixel-grid system (`components/pixel/sprites.ts`). Fonts (Silkscreen for headings, Nunito for everything readable) are bundled locally.
