# Clobber — K(LB)²

**Kids' Library Book Locator Beacon**

> Don't clobber your kids, Klobber their loans.

A BLE bookmark that pings from your phone. Each tag is a coin-cell peripheral
holding its book's ISBN-13, pingable on demand, reconciled against your
Hertfordshire Libraries (Spydus) account to surface due-soon books.
No auto-renew. No surprises.

---

## How it works

**Tag** (bookmark): BLE peripheral that advertises `CLB-<isbn-suffix>`, responds
to a *buzz* GATT write (beeps), and persists its ISBN through battery swaps.

**App** (PWA): scans for tags, fetches current loans from Spydus via a backend
proxy, reconciles into four buckets, lets you assign ISBNs by scanning the
barcode on the back cover.

**Proxy** (Cloudflare Worker): holds library card credentials server-side,
bridges the CORS gap the browser can't cross.

### Reconciliation buckets

| Bucket | Meaning |
|---|---|
| Tagged & borrowed | Tag's ISBN is an active loan — due date shown |
| Borrowed, untagged | You have the book but no beacon on it yet |
| Stale tag | Tag's ISBN is not in current loans — book returned |
| Free | Unassigned tag, ready to use |

---

## Repository layout

```
clobber/
├── docs/
│   ├── gatt-spec.md      # Firmware/app contract — read this first
│   └── build-plan.md     # Full phase-by-phase checklist
├── firmware/
│   └── clobber-tag/      # Arduino sketch — Seeed XIAO nRF52840
├── app/                  # Progressive Web App (no build step)
│   ├── src/
│   │   ├── ble.js        # Web Bluetooth helpers
│   │   ├── barcode.js    # BarcodeDetector + zxing-js fallback
│   │   ├── reconcile.js  # Four-bucket reconciliation logic
│   │   └── main.js       # App entry point
│   ├── index.html
│   ├── manifest.json
│   └── sw.js
├── proxy/                # Cloudflare Worker — Spydus CORS bridge
│   └── src/index.js
├── hardware/
│   ├── bom.md            # Bill of materials (prototype, one tag)
│   └── power-budget.md   # Current budget and battery-life estimate
└── case/
    └── notes.md          # 3D print design notes (Elegoo CC1)
```

---

## Critical path

Two things can sink this project — prove them first, before PCBs or cases:

1. **Spydus access + ISBN key-match** (`proxy/`) — loan records must return
   ISBN-13. If they return a bib/item ID instead, reconciliation silently
   fails and you need a catalogue lookup layer.

2. **Coin-cell life on the Xiao** (`firmware/`) — nRF52 power tuning is
   fiddly; the onboard SPI flash alone kills a CR2032. Target ≤ 10 µA average.

Then: firmware buzz → app buzz → ISBN assign + barcode → reconciliation →
circuit + power → case → end-to-end → scale to ten.

---

## Quick start

### Firmware

Install the [Seeed nRF52 Arduino board package](https://wiki.seeedstudio.com/XIAO_BLE/),
open `firmware/clobber-tag/clobber-tag.ino` in Arduino IDE, select
**Seeed XIAO nRF52840**, flash via USB.

See [`firmware/README.md`](firmware/README.md).

### App

Needs HTTPS for Web Bluetooth — use GitHub Pages, Netlify, or Vercel.
For local dev with a self-signed cert:

```bash
cd app
npx serve --ssl-cert cert.pem --ssl-key key.pem .
```

### Proxy

```bash
cd proxy
npm install
# Add credentials (never commit these):
npx wrangler secret put SPYDUS_BASE_URL
npx wrangler secret put ACCOUNTS        # JSON array of { name, cardNumber, pin }
npx wrangler dev                        # local dev
npx wrangler deploy                     # production
```

Update `PROXY_URL` in `app/src/main.js` after deploying.

---

## Key gotchas

- **CORS**: the PWA cannot call Spydus directly → the Worker proxy is a real
  architecture piece, not an afterthought.
- **Web Bluetooth is foreground-only** — no passive background scanning.
  Pinging is a deliberate act; set UX expectations accordingly.
- **Two barcodes on library books** — scan the ISBN EAN-13 (starts with 978/979),
  not the library's own item barcode (Code39/Codabar).
- **Buzzer drive circuit** — a GPIO pin cannot drive a loud buzzer directly;
  needs a transistor stage (2N7002 / BC817 + flyback diode).
- **Acoustic ports** — a sealed printed case muffles the buzzer; design sound
  holes or a thin membrane area.
- **Antenna keep-out** — don't bury the BLE antenna in infill or against the
  battery; it detunes badly.
- **SPI flash** — the Xiao's onboard SPI flash must be powered down in firmware
  or it alone will drain a CR2032 in weeks.
- **Battery-sense drain** — a voltage-divider draws continuously; use
  high-value resistors (≥ 1 MΩ) or gate the measurement.
- **ISBN collision edge case** — two household members with the same title:
  ISBN alone can't distinguish physical copies. Fine for v1.

---

## Docs

- [GATT service spec](docs/gatt-spec.md)
- [Full build plan](docs/build-plan.md)
- [Hardware BOM](hardware/bom.md)
- [Power budget](hardware/power-budget.md)
