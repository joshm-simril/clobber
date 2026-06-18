# Clobber GATT Service Specification

This is the shared contract between firmware and app. Both sides must agree on
every UUID and every field format here before writing a line of code.

---

## UUIDs

All Clobber UUIDs share the base `c10bbe12-0000-0000-0000-` prefix
("clobber" → `c10bbe12`). Generate fresh UUIDs with `uuidgen` before
production to avoid any accidental collision.

| Role | UUID |
|---|---|
| **Clobber Service** | `c10bbe12-0000-0000-0000-000000000001` |
| **Buzz Characteristic** | `c10bbe12-0000-0000-0000-000000000002` |
| **ISBN Characteristic** | `c10bbe12-0000-0000-0000-000000000003` |
| Battery Service (standard) | `0x180F` |
| Battery Level (standard) | `0x2A19` |

---

## Advertising payload

- **Flags**: `LE General Discoverable Mode, BR/EDR Not Supported`
- **Complete Local Name**: `CLB-<last-4-digits-of-ISBN>` when assigned,
  `CLB-unset` when unassigned.
  - Example: ISBN `9780747532743` → name `CLB-2743`
  - The suffix is the last 4 digits of the ISBN-13 (digits 10–13, i.e. before
    the check digit is digit 12 — just use the last 4 for display).
- **Incomplete List of 128-bit UUIDs**: Clobber Service UUID
- **Manufacturer Specific Data** *(optional, implement last)*:
  Company ID `0xFFFF` (test), followed by the full 13-byte ISBN-13 as ASCII.
  This lets the app match tags without connecting, but costs adv packet space.

Advertising interval: start at 100 ms (fast, 160 × 0.625 ms units) for 30 s
after power-on/wake, then back off to 1 s (1600 units) for low-power idle.

---

## Buzz Characteristic

| Field | Value |
|---|---|
| UUID | `c10bbe12-0000-0000-0000-000000000002` |
| Properties | Write, Write Without Response |
| Permissions | Open write (no pairing required for prototype) |
| Value length | 1 byte |

**Write payload**: a single `uint8` duration byte. Duration in milliseconds =
`byte × 100`. `0x00` means the firmware default (500 ms).

| Byte | Duration |
|---|---|
| `0x00` | 500 ms (default) |
| `0x01` | 100 ms |
| `0x05` | 500 ms |
| `0x0A` | 1000 ms |
| `0xFF` | 25.5 s (don't use) |

Pattern extension (future): use 2 bytes — `[count, duration_per_pulse]` — for
multi-beep patterns. Keep single-byte format for now.

---

## ISBN Characteristic

| Field | Value |
|---|---|
| UUID | `c10bbe12-0000-0000-0000-000000000003` |
| Properties | Read, Write |
| Permissions | Open read and write (no pairing required for prototype) |
| Value encoding | ASCII digits, exactly 13 bytes, no null terminator |
| Value when unassigned | Zero-length value (empty) |

**Read**: returns the current stored ISBN-13 as 13 ASCII digit bytes, or empty
if unassigned.

**Write**: app sends exactly 13 ASCII digit bytes. Firmware must:
1. Validate length (reject anything other than 13 bytes).
2. Store to NVS/flash (survives power cycles and battery swaps).
3. Update the advertising device name.
4. Emit a short confirm beep (100 ms) so the user knows which physical tag
   just got assigned.

**Validation** (firmware): check length only. ISBN-13 checksum validation is
the app's responsibility before writing.

---

## Battery Service (standard 0x180F)

Expose standard Battery Level characteristic (0x2A19), `uint8`, 0–100.
Read-only, notify supported.

Measurement: read the ADC on the battery-sense pin (with resistor divider),
map raw ADC to approximate percentage. Update at most once per connection.
The divider is always on — use high-value resistors (≥ 1 MΩ each) to keep
parasitic drain below 3 µA at 3 V.

---

## Security

No pairing or bonding required for the prototype. The tag is a physical object
in your possession; open GATT is fine for household use.

For a production build, consider requiring Just Works pairing to prevent a
passer-by from triggering the buzz characteristic.

---

## State machine (firmware)

```
BOOT
 └─ load ISBN from NVS
 └─ update adv name
 └─ start fast advertising (100 ms interval, 30 s)
 └─ IDLE: slow advertising (1 s interval)
      │
      ├─ [connected] → CONNECTED
      │    ├─ [buzz write] → buzz(N ms) → CONNECTED
      │    ├─ [isbn write] → validate → store → update name → confirm beep → CONNECTED
      │    └─ [disconnect] → IDLE
      │
      └─ [SYSTEM_OFF timer or button] → SHIP_MODE
```

---

## Change log

| Date | Change |
|---|---|
| 2026-06-18 | Initial draft |
