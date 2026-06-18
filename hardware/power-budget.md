# Power budget — one Clobber tag

Target: **≤ 10 µA average** on a CR2032 (≈ 220 mAh usable) → **> 2 years** standby.

All figures are estimates. Measure with a **PPK2** (Nordic Power Profiler Kit 2)
or similar current probe once hardware is assembled.

---

## Current breakdown (estimated)

| Contributor | Current | Duty | Avg contribution |
|---|---|---|---|
| nRF52840 in sleep (SYSTEM_OFF) | ~2 µA | continuous | 2 µA |
| BLE advertising event (TX @ 0 dBm) | ~15 mA | ~300 µs per event | — |
| At 1 s adv interval: 300 µs / 1 000 000 µs × 15 mA | — | — | **4.5 µA** |
| At 10 s adv interval: 300 µs / 10 000 000 µs × 15 mA | — | — | **0.45 µA** |
| SPI flash (W25Q16) standby — **must be killed** | 3 µA | continuous | **3 µA** |
| Battery-sense divider (2× 1 MΩ at 3 V) | 1.5 µA | continuous | 1.5 µA |
| Buzzer (magnetic, 3 V) during beep | ~30 mA | negligible avg | ~0 µA |

### Target scenario: 1 s advertising, flash killed, divider always on

| Item | Avg µA |
|---|---|
| nRF52840 sleep | 2.0 |
| BLE advertising @ 1 s | 4.5 |
| SPI flash (killed) | 0 |
| Battery-sense divider | 1.5 |
| **Total** | **8.0 µA** |

**Estimated life on CR2032 (220 mAh):**  
`220 000 µAh / 8 µA = 27 500 h ≈ 3.1 years`

This is optimistic. Real capacity at these drain levels is closer to 60–70% of
rated — call it **~2 years**, which is acceptable for a coin-cell swap model.

### If flash is NOT killed

Add 3 µA → 11 µA average → ~2.3 years. Borderline acceptable but fix it anyway.

### With 10 s advertising interval

`2 + 0.45 + 1.5 = ~4 µA` → potentially **5+ years**. Worth testing if pings
feel sluggish (BLE scan window on the phone has to overlap the adv event).

---

## Measurement plan

1. Flash firmware.
2. Connect PPK2 in current-source mode (3.0 V, emulating a CR2032).
3. Capture 10–60 s at 1 s advertising interval.
4. Average current = energy / time from PPK2 software.
5. Compare to table above; adjust advertising interval and verify SPI flash
   is dead (no 3 µA floor visible in trace).

---

## Key power risks

| Risk | Mitigation |
|---|---|
| SPI flash not powered down | Kill it in `setup()` before `Bluefruit.begin()` |
| Battery-sense divider always on | Gate with a GPIO (add a P-FET), or accept 1.5 µA |
| Long BLE connections (app stays connected) | Set a connection-idle timeout; disconnect after assignment |
| Advertising not slowing after fast timeout | Confirm `setFastTimeout()` takes effect; measure slow interval |
