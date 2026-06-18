# Library Bookmark Tracker — Prototype Build Plan

A BLE "beep-finder" bookmark for library books: ten printed tags, each holding its book's ISBN, pingable from a phone, reconciled against Hertfordshire Libraries' Spydus loan data to flag due-soon books — no auto-renew.

---

## Guiding principle: build ONE, prove it end-to-end, then replicate

Don't tool up for ten until a single tag does the full loop: **assign ISBN → app reads your real Spydus loans → reconciliation shows the right state → ping → it buzzes**. The prototype is one dev-board tag on a protoboard. The "make ten" work (PCB, replication, case finalising) only starts once that loop is solid.

---

## Phase 0 — Decisions to lock first (the contract)

These gate everything downstream. Settle them before cutting metal or code.

- [ ] **GATT service spec** — the single shared contract both firmware and app build against. Define: service UUID; a *buzz* characteristic (write → beep, optional duration/pattern byte); an *ISBN* characteristic (read + write, persisted); optionally standard Battery Service (0x180F). Decide the **advertising payload**: device name scheme + whether the ISBN (or a short hash) rides in the adv packet so the app can match tags *without* connecting. Write this down as its own short doc.
- [ ] **Hardware choice** — prototype on the **Seeed XIAO nRF52840** (USB flashing, Arduino-friendly). Note bare **Raytac MDBT50Q** module as the production option for best power/size.
- [ ] **Battery decision** — coin cell (CR2032, swap ~yearly, simplest) vs small LiPo (rechargeable, the Xiao has an onboard charger, but 10 cells to keep topped up). You flagged "between charges" — this is the call to make.
- [ ] **Buzzer type** — self-driving magnetic buzzer (simple, bulkier) vs piezo transducer + drive circuit (thinner, louder potential, needs PWM + a transistor).

---

## Phase 1 — Firmware spike (prove the magic cheaply)

- [ ] Toolchain up: Adafruit/Seeed nRF52 Arduino core (fast) — keep Nordic nRF Connect SDK / Zephyr in reserve for serious power tuning later.
- [ ] BLE peripheral: advertise + expose the GATT service from Phase 0.
- [ ] **Buzz handler**: on write to the buzz characteristic, drive PWM to the buzzer for N ms.
- [ ] **ISBN store**: read/write characteristic backed by **FDS/NVS flash** so it survives battery swaps; load into the adv payload on boot.
- [ ] **"Identify" beep**: a way to make *this specific* tag buzz during assignment, so you know which physical bookmark you're programming.
- [ ] Power management (the fiddly part): sleep between adv events, use SYSTEM OFF where possible, **kill the Xiao's onboard SPI flash** (the known coin-cell-killer), tune the advertising interval. Target single-digit µA average.
- [ ] (Defer) OTA DFU — lets you reflash all ten without cables. Nice-to-have, not prototype-critical.

---

## Phase 2 — App / Web UI spike (Android, Web Bluetooth)

- [ ] PWA shell: manifest + service worker + installable, served over **HTTPS** (Web Bluetooth needs a secure context — GitHub Pages / Netlify / Vercel).
- [ ] Scan + connect UI; trigger the buzz characteristic. (Prove app ↔ tag.)
- [ ] **Barcode scanning** — `BarcodeDetector` API, with a zxing-js fallback. Read the **EAN-13 ISBN** off the back cover. ⚠️ Library books often carry a *second* barcode (the library's own item barcode, usually Code39/Codabar) — make sure you scan the ISBN, not that.
- [ ] **Assign flow**: scan book → write ISBN to the attached tag → confirm with an identify beep.
- [ ] **Reconciliation view**: render the four buckets (tagged & borrowed / borrowed-but-untagged / stale tag / free).
- [ ] **Local cache**: assignment log (tag-ID → ISBN → date) + last-known tag state, so out-of-range tags (school bag) still reason correctly.
- [ ] ⚠️ Note the limitation: Web Bluetooth is **foreground-only, no background scanning** — the app can't passively monitor; pinging is a deliberate act. Set UX expectations accordingly.

---

## Phase 3 — Spydus integration (highest-risk — de-risk EARLY)

- [ ] **Access spike**: confirm how you'll reach loan data. Options, cleanest first: (1) email Herts Libraries/Civica re: patron API access; (2) inspect the official Spydus Library app's traffic (card+PIN auth → `/circulation/1.0/patrons/id/{id}/loans/current`) and replicate it for your own accounts; (3) scrape the OPAC. Be gentle — cache, don't hammer; it's a ToS grey area even on your own data.
- [ ] ⚠️ **CORS blocker**: a browser PWA *cannot* call Spydus directly. You'll need a tiny **backend proxy** (Cloudflare Workers / Vercel / Netlify function) that does the Spydus call server-side and feeds your PWA. This is a real architecture piece, not an afterthought.
- [ ] Multi-account: loop over each household member's card+PIN.
- [ ] ⚠️ **Key-match risk**: verify the loan record actually returns the **ISBN-13** you print-match against. It may return a bib/item ID or title instead — if so, you need a catalogue lookup to map loan → ISBN. The whole reconciliation depends on both sides keying on the same identifier.
- [ ] Due-date extraction + a daily-ish refresh cache.
- [ ] Credential storage decision (lives server-side in the proxy; it's kids' PINs — keep it private and local-scale).

---

## Phase 4 — Hardware: circuit, BOM, soldering

**Draft BOM (prototype, one tag):**
- [ ] Seeed XIAO nRF52840 ×1
- [ ] Buzzer — magnetic (self-driving) *or* piezo transducer
- [ ] ⚠️ **Buzzer drive circuit** — a GPIO can't drive a loud buzzer directly (current limit). Needs a small MOSFET/transistor (e.g. 2N7002 / BC817) + gate/base resistor, and a flyback diode for a magnetic buzzer.
- [ ] Power: CR2032 holder + cells *or* ~100–150mAh LiPo + JST
- [ ] Decoupling caps (100nF, 10µF); protoboard + hookup wire
- [ ] Optional: slide switch or solder-jumper for power / **ship mode** (so tags don't drain in storage)
- [ ] Battery-sense divider (2× high-value resistors, e.g. 1MΩ) — ⚠️ the divider itself drains the cell; use high values or measure on-demand
- [ ] No SWD programmer needed for prototype (Xiao USB bootloader); add a J-Link if you move to bare modules

**Tasks:**
- [ ] Breadboard the buzzer + driver, confirm it's *actually loud enough* in a bag before committing.
- [ ] Solder protoboard version; battery leads/holder.
- [ ] ⚠️ **Power budget calc**: advertising interval → average current → battery-life estimate; validate against the chosen cell.
- [ ] (Production) Decide on a small custom **PCB** (JLCPCB) for the ten-unit build vs hand-wired.

---

## Phase 5 — Case / mechanical (Elegoo CC1)

- [ ] Design the **pod** (houses MCU + battery + buzzer) + the **bookmark tail**.
- [ ] ⚠️ **Acoustic ports** — a sealed printed case muffles the buzzer. Design sound holes / a thin membrane area.
- [ ] ⚠️ **Antenna keep-out** — don't bury the BLE antenna in infill or sit it against the battery/metal; it detunes. Orient deliberately.
- [ ] **Tail material**: TPU for a flexible, non-snapping tail/clip; PLA or ABS for the rigid pod. (TPU on the CC1 is its own tuning pass.)
- [ ] **Attachment**: how it secures to the book without damaging it — clip, corner sleeve, elastic channel?
- [ ] **Battery access**: snap-fit lid for coin-cell swaps; or charge-port access if LiPo.
- [ ] Print → test fit → test acoustics → revise (your usual iterative loop).

---

## Phase 6 — Integration & test

- [ ] Full end-to-end loop on one tag.
- [ ] **Range test** (across the house, through a school bag).
- [ ] **Loudness test** (audible inside a bag / on a shelf).
- [ ] **Battery-life validation** (measure real draw, extrapolate).
- [ ] BLE reliability: reconnection, scan collisions, 2–3 tags at once.
- [ ] Reconciliation correctness against live Spydus data.

---

## Phase 7 — Scale to ten

- [ ] PCB order (if chosen) or replicate hand-wired builds.
- [ ] Flash all units; assign-and-test each.
- [ ] iPhone path for your wife: Bluefy running the same PWA (free) → or Capacitor wrap for a real icon (the £79/yr Apple tax kicks in here).

---

## Gaps you didn't list (the bits that bite later)

1. **GATT spec as a first-class artifact** — the firmware/app contract; everything hangs off it.
2. **CORS → backend proxy for Spydus** — the PWA can't call the library directly. Whole extra component.
3. **Loan-record → ISBN key-match** — verify both sides key on ISBN-13, or reconciliation silently fails.
4. **Buzzer drive circuit** — GPIO won't drive a loud buzzer; needs a transistor stage.
5. **Web Bluetooth is foreground-only** — no passive background monitoring.
6. **Acoustic ports** in the case, or it's muffled.
7. **Antenna detuning** from battery/metal/infill proximity.
8. **Battery-sense parasitic drain** — the measuring divider eats your battery.
9. **Ship/off mode** — so tags don't drain in storage.
10. **Identify beep** — to tell which physical tag is which during assignment.
11. **Two barcodes on library books** — scan the ISBN EAN-13, not the library item barcode.
12. **Same-ISBN collision** — two household members, same title; ISBN alone can't disambiguate the physical copy (edge case, fine for v1).

---

## Suggested critical path

Two things can sink the project, so prove them **first**, in parallel, before investing in case/PCB:

1. **Spydus access + ISBN key-match** (Phase 3) — it might be hard or the IDs might not line up.
2. **Coin-cell battery life on the Xiao** (Phase 1 power tuning) — known fiddly.

Then: firmware buzz → app buzz → ISBN assign + barcode → reconciliation → circuit + power → case → end-to-end → scale.
