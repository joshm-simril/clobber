# Case design notes — Elegoo CC1

The physical bookmark is two parts:
- **Pod**: rigid shell housing the MCU, battery, and buzzer.
- **Tail**: flexible strip that extends into the book pages.

---

## Materials

| Part | Material | Reason |
|---|---|---|
| Pod | PLA or ABS | Rigid, easy to print accurately |
| Tail | TPU (95A) | Flexible, won't snap inside a book |

TPU on the CC1 needs its own tuning pass — slower speeds, direct drive recommended.
Print the tail separately and join to the pod with a snap/friction fit or short M2 screws.

---

## Critical design constraints

### Acoustic ports
A sealed PLA case can attenuate a 3V buzzer by 15–20 dB — it becomes inaudible
in a bag. Mitigations (pick one or combine):
- **Sound holes**: a grid of 1–1.5 mm holes above the buzzer diaphragm.
- **Thin membrane**: 0.4–0.6 mm wall section above the buzzer (one perimeter, no infill).
- **Exposed buzzer face**: recess the buzzer so its face is flush with an open slot.

Test loudness *before* designing the final shell. A buzzer that's audible on the bench
may be inaudible in a school bag.

### BLE antenna keep-out
The nRF52840 has an integrated PCB antenna (or a ceramic chip antenna on the XIAO).
Rules:
- No metal (battery, foil, PCB ground plane extension) within 5 mm of the antenna.
- No high-permittivity infill (solid walls or > 30% infill) directly over the antenna.
- No conductive filament near the antenna.
- Orient the XIAO so the antenna end points toward the outside of the pod, not
  toward the battery or the user's hand.

### Battery access
- **CR2032**: snap-fit lid with a coin-slot release. Target < 30 s swap with no tools.
- **LiPo**: USB-C charge port exposed through the pod wall (the XIAO's port).

### Attachment to book
Options:
- **Corner sleeve** (like a photo corner): slips over the cover corner, no damage.
- **Clip** (spring steel inside TPU): grips the fore-edge of the cover.
- **Elastic channel**: a loop of elastic inside the tail holds the bookmark in the page.

Do not use adhesives that damage the book cover.

---

## Dimensions (targets)

| Dimension | Target |
|---|---|
| Pod width | ≤ 22 mm (XIAO width) + wall clearance |
| Pod length | ≤ 55 mm |
| Pod depth | ≤ 12 mm (XIAO + CR2032 stacked, or LiPo beside) |
| Tail width | 15–18 mm |
| Tail length | 60–80 mm (enough to grip pages) |
| Tail thickness | 1.2–2 mm |

---

## Iteration plan

1. Print pod shell (no electronics), test battery access mechanism.
2. Print tail, check flex and book fit.
3. Assemble electronics, place in pod, check antenna orientation.
4. Seal pod, test BLE range and loudness inside a fabric bag.
5. Revise acoustic ports / antenna cutout as needed.
6. Final geometry → STL files committed to `case/stl/`.
