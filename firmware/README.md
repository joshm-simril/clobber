# Firmware

Arduino sketch for the **Seeed XIAO nRF52840**.

## Setup

1. Install the [Seeed nRF52840 board package](https://wiki.seeedstudio.com/XIAO_BLE/)
   in Arduino IDE (Board Manager URL:
   `https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json`).
2. Board: **Seeed XIAO nRF52840** (not the Sense variant unless you have one).
3. Open `clobber-tag/clobber-tag.ino`.
4. Connect the Xiao via USB-C, select its port, flash.

The Xiao has a USB bootloader — no J-Link needed for the prototype.

## Dependencies

- `bluefruit.h` — comes with the Seeed/Adafruit nRF52 board package.
- `InternalFileSystem.h` — also bundled; used for ISBN persistence.

## Pin assignments

| Pin | Function |
|---|---|
| `D0` | Buzzer drive (→ transistor base/gate) |
| `A0` | Battery sense (mid-point of 1 MΩ / 1 MΩ divider) |

Adjust `BUZZER_PIN` and `BATSENSE_PIN` in the sketch to match your wiring.

## Known TODOs (before coin-cell target is met)

- **Disable onboard SPI flash** — the Xiao's W25Q16 flash draws ~4 mA when
  active and ~3 µA standby. For coin-cell viability it must be power-downed.
  Pull its CS pin high and issue a power-down command, or use `flash.end()`.
- **Advertising interval tuning** — current fast/slow values are conservative;
  measure real draw with a uCurrent or PPK2 and tune.
- **SYSTEM_OFF sleep** — replace `waitForEvent()` with deep-sleep between adv
  events once the rest is stable.
- **OTA DFU** — Adafruit provides `BLEDfu`; add it once you need to reflash
  all ten without cables.

## Buzzer wiring (prototype)

```
GPIO D0 ──[ 10kΩ ]──┐
                     │ gate/base
                    2N7002 / BC817
                     │ drain/collector
               buzzer +
               buzzer − ── GND
```

For a **magnetic buzzer**: add a flyback diode (1N4148) across the buzzer
terminals, cathode to +.

For a **piezo transducer**: replace `digitalWrite` with `tone()` /
`analogWriteFrequency()` for a PWM drive signal.
