# Behaviour Audit - Updated 21 September 2026

Reference: https://designstudio.abhishekid.com/app.
Original PrintsMen HTML was not modified. This is an independently implemented
local editor, not a copy of the reference site's source, assets or cloud backend.

## Coverage

| Area | Source update and observed checks | Remaining qualification |
|---|---|---|
| Presets | All 16 measured safe/face/cut sizes; rounded corners; wristband safe X=38 mm | Requires cutter proof; not universal badge standards |
| Canvas | Guides, TOP, grid, zoom, fit, drag, resize, rotation | No exhaustive touch-device/pan/zoom stress certification |
| Text | Multiline text, styles, gradients, borders, shadows; local font-file import and embedding | No installed-font enumeration; font licensing and external SVG font support require care |
| Curved text | Radius 15 mm, 25% arc position, reverse arc and radial fill exercised | Arc algorithm is independent, not pixel-identical to reference |
| Shapes | All ten tools created valid SVG geometry | Not every numerical combination was tested visually |
| Selection/layers | Group, centre, undo/redo and lock protection exercised | Shortcuts implemented; not every shortcut/device combination tested |
| Images | Two-file PNG/SVG import, stretch, 90-degree rotation, fixed square crop, ellipse clipping | Complex external SVGs intentionally rejected; source pixels still limit quality |
| PDF import | Three input pages became three separate editable badge pages | Password/encrypted/malformed PDF handling not exhaustively tested |
| Image effects | Bleed spin preview checked; white removal exported with alpha checks inside and outside art | Spin is approximate; no AI segmentation; not all filter combinations checked |
| QR | Exported PNG payload and first/last bulk PDF payload decoded with independent jsQR 1.4.0 | Physical scanner/print durability remains unverified |
| Barcode | CODE128, CODE39, EAN13, EAN8, UPC, ITF, MSI, pharmacode accepted valid samples and rendered | Independent 1D scanner decoding not performed |
| CSV | 80 rows generated 80 badge pages, including distinct first/last codes | Source CSV is session-only; generated pages persist |
| Limits | Attempt to exceed 100 pages rolled back; oversized 600-DPI batch rejected | Not an unlimited-load claim |
| A4 PDF | Nine copies: pages contain 8 and 1; physical badges 70 x 70 mm; 827 px artwork at 300 DPI | Colour, printer scaling and cutter alignment require physical proof |
| 13 x 19 PDF | 85 badges over four sheets: 24/24/24/13; exact 330.2 x 482.6 mm paper | No production RIP testing |
| PNG | 827 x 827 px, ~300 DPI metadata, RGBA with transparent corners | App chosen background controls interior transparency |
| JPG | 1654 x 1654 px, 600 DPI metadata, RGB | Transparency is flattened white |
| SVG | 12-object sample exported; mm dimensions, optional outlines; embedded custom-font export added | System fonts still depend on receiving computer; other-editor round-trip not verified |
| Persistence | 86-page JSON restore; named local library; stale second-tab save rejected and recovery exercised | Browser quota/private-mode behavior not exhaustively tested; library is not a backup |
| Cloud/AI | Clear unavailable status in interface and help | Not implemented: event collection, AI removal, cloud gallery, account services |

## Defects Fixed During Testing

1. Missing editor controller: connected UI actions to rendering, imports and output.
2. Numeric/text fields could change visibly without updating artwork: added
   valid-on-input updates and restoration of invalid partial numeric entries.
3. PDF.js 6 cleanup used a removed document method: now destroys the loading task
   on both success and failure, and releases per-page canvases.
4. Native reset confirmation could stall the in-app browser: replaced it with
   an application dialog, including a non-destructive cancellation choice.
5. Rounded guide corners and wristband offset were absent from the current
   source snapshot: restored them across rendering, warnings and alignment.
6. Locked objects had editable-looking fields: disabled property inputs while locked.
7. Non-PDF output was unnecessarily subject to paper-fit validation: isolated
   standalone PNG/JPG/SVG export from sheet layout controls.
8. Unsupported appearance controls were shown for images/codes: hid irrelevant
   fill controls and connected image border style/opacity.
9. Added early import byte caps, export pixel caps, asset rollback and periodic
   yielding during matching-colour removal to reduce heavy-job failure risk.

## Repeatable Evidence

- `npm test`: 54 tests passing, including crop bounds, rotation, font validation,
  embedded-font persistence, strict CSV quoting and tiny-object fit rejection.
- `tests/inspect-exports.py`: PDF geometry/copy-count and PNG/JPG metadata checks.
- `tests/verify-qr.py`: 85-copy sheet counts and payloads PRINTSMEN-TEST-001,
  PM001 and PM080 decoded successfully from actual exports.
- Transparency fixture exported as 922 x 402 RGBA: the internal white hole
  and outside pixels have alpha 0; retained green pixels have alpha 255.
- First A4 PDF page rendered with Poppler and visually inspected: eight complete,
  separated badges; no safe/face guides or editor handles in artwork.
- Browser console reported no application errors in the completed test flows.

Generated evidence is under `test-output/` and in Downloads files named
`PrintsMen_Audit*`, `PrintsMen_Bulk_Audit*`, `PrintsMen_Feature_Audit*`, and
`PrintsMen_Transparency_Audit*`. These contain generated QA artwork only.

This is a bounded functional audit, not a claim that every possible option
combination has been exercised or that the reference website is reproduced 100%.

## Local Release Additions

- Explicit Upload images button above the canvas and in the left toolbar;
  tested PNG + SVG in one selection, creating two badge pages.
- Crop preview at 200% with 90-degree source rotation and fixed 1:1 selection;
  project download retains the rotated source and crop.
- Imported bundled Liberation Sans; font restored after browser restart,
  embedded SVG generated, PNG exported and visually checked.
- Text narrowed to 8 mm correctly triggered the overflow warning.
- Saved the 86-page audit into My designs, then a separate 3-page release test.
- Simultaneous editor tabs: stale save paused instead of overwriting the newer
  project; Load latest saved workspace recovered successfully.
- Calibration PDF uses A4 and a 100 x 100 mm vector square.
- `tests/verify-local-release.py` passed against actual downloads: two imported
  image pages, one embedded font, rotated 1280 x 2048 source, 1:1 crop,
  827 x 827 RGBA PNG at 299.9994 DPI, and exact calibration geometry.
- Calibration PDF rendered with Poppler and visually checked; launcher readiness
  check and JavaScript syntax check passed.
- Vintage, B&W and Dramatic are local colour presets, not AI enhancement.

## Intentionally Excluded From This Small Local Edition

No paid APIs, cloud guest uploads, accounts, remote template gallery, AI
segmentation/upscaling, true spot/CMYK output or editable imported SVG paths.
SVG imports remain raster images. Curved text and edge fill are independent
implementations, not promises of identical reference output. QR readable captions
and optional border scaling are now implemented. Physical print
proofs and independent 1D barcode scans are still required before production.

## Version 0.4.0 Upgrade Evidence

- Reviewed task PRINTSMEN TOOL (2), which is not a local Git branch. Its fixed
  artwork dimensions plus internal scale controls informed this separate app.
  Original HTML and its separate audit findings were not modified or resolved here.
- Added independent photo zoom (100-600%), drag/X/Y positioning and original-
  preserving 90-degree content rotation. Uses the same crop in canvas and exports.
- Bundled pico model runs in a worker, with a timeout, cancellation and no network
  service. Public sample portrait detected one face. Mixed three-image batch
  framed one photo and left two non-face images unchanged. Cancel displayed
  confirmation that no batch changes were applied.
- Automatic group framing refuses a crop when all faces cannot fit; no-face
  results leave existing crops unchanged. Front-facing portraits work best.
- Added QR caption with reserved space outside the quiet zone, and optional
  border/corner scaling. These are independent implementations, not pixel parity.
- Added rectangle packing with optional rotation; 500 mixed-size placements
  tested for exact dimensions, bounds and non-overlap with required gaps.
- Export paper presets and per-design counts tested against actual 300-DPI PDFs:
  12x18 inches: 25 copies as 24+1; 13x19: mixed 5+7 on one sheet;
  landscape separate mode: 5 and 7 on their own sheets. See verify-gangup.py.
- Every sheet is navigable in placement preview. Export settings lock during
  generation and progress resets on reopening. Blank/fractional/zero totals
  are rejected. Cancelling a pre-aborted export is covered for all formats.
- Further physical cutter/RIP tests, independent 1D scanner checks and a broad
  cross-browser/low-memory test matrix remain outside this bounded audit.
- `verify-upgrade-exports.py`: actual 200%/90-degree photo export retained the
  original 512 x 512 asset and left the other three pages unchanged. PNG measured
  709 x 1063 px at 300 DPI for a 60 x 90 mm badge. Rotated smart PDF measured
  100 x 70 mm, with one exact 90 x 60 mm footprint on each of two sheets.
  The PDF was rendered with Poppler and visually checked. Captioned QR PNG
  independently decoded to PRINTSMEN-040-CAPTION with jsQR.
