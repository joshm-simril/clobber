# Bill of Materials — prototype (one tag)

Decisions still to lock: **battery type** (CR2032 vs LiPo) and
**buzzer type** (magnetic vs piezo). Both affect the BOM.
See [build-plan.md](../docs/build-plan.md) Phase 0.

---

## MCU

| Qty | Part | Notes |
|---|---|---|
| 1 | Seeed XIAO nRF52840 | USB bootloader, BLE 5.0, onboard LiPo charger |

Production alternative: **Raytac MDBT50Q** bare module — smaller, better for
custom PCB, no onboard SPI flash, needs J-Link for flashing.

## Buzzer (pick one)

| Option | Part | Notes |
|---|---|---|
| A | Self-driving magnetic buzzer, 3V, ≥85 dB | Simpler, one-pin control, bulkier (≥12 mm dia.) |
| B | Piezo transducer, 3V | Thinner, louder potential, needs PWM + transistor drive |

## Buzzer drive circuit (required for either option)

A GPIO pin is limited to ~8 mA; a loud buzzer needs more.

| Qty | Part | Notes |
|---|---|---|
| 1 | 2N7002 N-channel MOSFET **or** BC817 NPN transistor | Gate/base resistor to GPIO |
| 1 | 10 kΩ resistor | Gate/base pulldown |
| 1 | 1N4148 diode | Flyback protection for magnetic buzzer only |

Wiring sketch:
```
GPIO ──[ 10kΩ ]──┬── Gate/Base
                 └── 10kΩ to GND
                      │
                    MOSFET/BJT
                      │
                   Buzzer +
                   Buzzer − ── GND
```

## Power (pick one)

| Option | Part | Notes |
|---|---|---|
| A | CR2032 coin cell + THT holder | ~220 mAh, swap ~yearly at ≤10 µA avg |
| B | 100–150 mAh LiPo + JST-PH 1.25mm | Rechargeable; Xiao has onboard charger |

## Passives & hardware

| Qty | Part | Notes |
|---|---|---|
| 1 | 100 nF ceramic cap | Decoupling near Vcc |
| 1 | 10 µF ceramic cap | Bulk decoupling |
| 2 | 1 MΩ resistor | Battery-sense divider (keeps parasitic draw < 3 µA) |
| 1 | Protoboard (e.g. 40×60 mm) | Prototype substrate |
| — | Hookup wire (30 AWG silicone) | Flexible, thin |
| 1 | Slide switch (SS-12D00, or solder-jumper) | Power + ship mode |

## Optional / production

| Part | Notes |
|---|---|
| J-Link EDU Mini | Needed only for bare module (not Xiao) |
| Custom PCB (JLCPCB) | Ten-unit production build |
| Elegoo CC1 printer + TPU/PLA filament | Case — see case/notes.md |

---

## Notes

- The **XIAO's onboard W25Q16 SPI flash** draws ~4 mA active and
  ~3 µA standby. It **must** be powered down in firmware for coin-cell
  viability. See `firmware/README.md`.
- CR2032 datasheet capacity (220 mAh) is at low-drain loads — real usable
  capacity at the burst currents of BLE TX is lower. Validate with real
  measurements using a PPK2 or µCurrent.
