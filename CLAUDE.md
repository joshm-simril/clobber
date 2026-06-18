# Clobber — AI agent instructions

## The decision ladder

Before writing any code, walk this ladder and stop at the first step that solves it:

1. **Does it need to exist?** — if not, skip it (YAGNI)
2. **Stdlib / built-in does it?** — use it (`Intl`, `URL`, `fetch`, `crypto`, etc.)
3. **Native platform feature?** — use it (see below)
4. **Already-installed dependency?** — use it
5. **One line?** — one line
6. **Only then:** the minimum that works

Never reduce validation, error handling, security, or accessibility. Minimalism applies to unnecessary complexity only.

## Native platform preferences (this project)

| Task | Reach for |
|---|---|
| Barcode scanning | `BarcodeDetector` API — not zxing, not QuaggaJS |
| Date/time formatting | `Intl.RelativeTimeFormat`, `Intl.DateTimeFormat` |
| Relative time labels | `Intl.RelativeTimeFormat` — not hand-rolled strings |
| URL building | `URL` / `URLSearchParams` — not string concatenation |
| UUID generation | `crypto.randomUUID()` |
| HTTP | `fetch` — not axios |
| Local persistence | `localStorage` — not a wrapper library |
| Camera | `navigator.mediaDevices.getUserMedia` |
| BLE | Web Bluetooth API directly — `ble.js` wraps it thinly |

## Project-specific rules

**App** (`app/`): zero npm dependencies. No build step. Vanilla ES modules only.
Served as static files over HTTPS. If you find yourself reaching for a bundler,
stop and ask why.

**Firmware** (`firmware/`): Arduino sketch targeting the Seeed XIAO nRF52840 with
the Adafruit/Seeed nRF52 core. Use the bundled `bluefruit.h` and
`InternalFileSystem.h` — do not add board-package libraries that aren't already
installed.

**Proxy** (`proxy/`): Cloudflare Worker. Zero npm runtime dependencies. `wrangler`
is the only dev dependency. Keep it a single file (`src/index.js`).

**Prototype first**: the build plan says "build ONE, prove it end-to-end, then
replicate." Don't design for ten tags, OTA DFU, or multi-household until the
single-tag loop works. Defer anything marked `(Defer)` or `(Production)` in the
build plan.

## GATT spec is the contract

`docs/gatt-spec.md` is the single source of truth for UUIDs, characteristic
formats, and advertising payload. If firmware and app ever disagree, fix
`gatt-spec.md` first, then propagate.

## Credentials

Never commit credentials, PINs, or library card numbers anywhere in this repo.
Spydus credentials live in Cloudflare Worker secrets only (`wrangler secret put`).
