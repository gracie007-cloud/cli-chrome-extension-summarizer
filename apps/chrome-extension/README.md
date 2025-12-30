# Summarize (Chrome Extension)

Chrome Side Panel UI for `summarize` (streams summaries into a real Chrome Side Panel).

Docs + setup: `https://summarize.sh`

## Build

- From repo root: `pnpm install`
- Dev: `pnpm -C apps/chrome-extension dev`
- Prod build: `pnpm -C apps/chrome-extension build`

## Install in Chrome (Unpacked)

Step-by-step:

1) Build the extension:
   - `pnpm -C apps/chrome-extension build`
2) Open Chrome → go to `chrome://extensions`
   - Or Chrome menu → Extensions → “Manage Extensions”
3) Turn on **Developer mode** (top-right toggle).
4) Click **Load unpacked**.
5) Select: `apps/chrome-extension/.output/chrome-mv3`
6) (Optional) Pin the extension (puzzle icon → pin), then click it to open the Side Panel.

Developer mode is required for loading unpacked extensions.

## Install the Daemon (Pairing)

The extension talks to a tiny local daemon that runs on your machine.

1) Install `summarize` (choose one):
   - `npm i -g @steipete/summarize`
   - `brew install steipete/tap/summarize` (macOS arm64)
2) Open the Side Panel → “Setup” shows a token + install command.
3) Copy that command and run it in Terminal.
   - Installed binary: `summarize daemon install --token <TOKEN>`
   - Repo/dev checkout: `pnpm summarize daemon install --token <TOKEN> --dev`
4) Verify:
   - `summarize daemon status`
   - Restart (if needed): `summarize daemon restart`

## Length Presets

- Presets match CLI: `short|medium|long|xl|xxl` (or custom like `20k`).
- Tooltips show target + range + paragraph guidance.
- Source of truth: `packages/core/src/prompts/summary-lengths.ts`.
