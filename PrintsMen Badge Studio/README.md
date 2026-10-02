# PrintsMen Customised Studio

Combined local-first design and print-production studio. On Windows, run `Start Customised Studio.cmd` (the old launcher still works), or start
`node server.mjs` in this folder and open
http://127.0.0.1:4178/index.html. Node.js is the only runtime requirement.
Do not open index.html directly with file://; module and PDF-worker loading need
the local server. The server listens only on 127.0.0.1, not the public network.

## Available

- Version 0.9.3: one application dashboard shows operator sign-in, installation
  licence, enabled tools and update readiness without exposing owner-only key
  controls. The dashboard labels local preview and unconfigured update hosting
  explicitly. It does not turn the preview installer into a managed licence.
- Version 0.9.2: Polaroid photos have individual fill/fit, zoom and X/Y framing
  controls. Polaroids and Custom Shape can suggest face framing locally; review
  and adjust each suggestion manually. Face detection does not identify people
  or improve a low-resolution source. Box Design, Dangler Design and 3D Mockup
  now have separate home entries and focused starting views while sharing the
  same saved product-project and export formats.
- Version 0.9.0: offline Job Assistant with review-before-apply, saved local job
  recipes, exact measured badge presets, and routes into all 20 production tools.
  This is a deterministic command parser, not a generative AI model. No paid AI
  service, voice recording, cloud uploads or automatic exports are involved.
- Product Studio: open tray / box sleeve templates, shaped front/back danglers,
  per-panel JPG/PNG/multi-page PDF artwork, photo fit/zoom/position, optional 3D
  turntable, exact millimetre geometry, sheet copies and PDF/SVG/300-DPI PNG output.
  A4/A3/12x18/13x18/13x19/custom sheets; mm/cm/inches/feet product input.
  Product projects use explicit Save/Open; browser autosave is not claimed.
- Source-based editable output names in the designer and main production import
  queues. Existing project formats, licence IDs, storage and installation paths
  are retained for compatibility. New product files ship in the installer;
  opening Product Studio blocks automatic updates just like the existing editors.
- See `CUSTOMISED-STUDIO-0.9-STATUS.md` for the eleven-item implementation status,
  verification evidence, memory limits and remaining launch gates.

- Version 0.7.0: Badge Designer uses a black/white/red interface with subtle card
  animations and reduced-motion support. Exported artwork colours are unchanged.
  The installer includes a separate Update Manager shortcut, signed-release
  checks and automatic installation after all editor tabs close and five idle
  minutes. Release hosting is not configured yet. Read `UPDATES.md`.
- Badge Designer now opens on a compact catalogue home: eight product categories
  and Custom Size. Pick a category to see its sizes, then select a size to open
  the editor. Resume Design and My Saved Designs retain access to existing jobs.
  Back to Catalogues does not clear the workspace. Starting a different design
  asks before replacing it. Version 0.7.0 includes this catalogue and the direct-file
  startup warning; the older 0.6.0 EXE is retained separately.
- First Windows installer: Local Preview edition, with a bundled Node.js runtime,
  temporary operator sign-in, desktop/Start Menu shortcuts and an uninstaller.
  It deliberately enables all tools without production licensing, as requested.
  It remains loopback-only; do not expose the temporary account to the internet.
- Version 0.6.0: local licensing prototype and activation status page. A separate
  owner dashboard creates tool-specific keys and approves installations. Production
  activation is deliberately disabled until HTTPS hosting is chosen. This source
  workspace remains unlocked. Read `LICENSING.md` for setup, tests and limitations.
- Version 0.5.0: shared violet/gold home page. Choose Badge Designer (`badge.html`)
  or the main PrintsMen collection (`printsmen/index.html`). Both keep their own
  editing logic; artwork is not automatically transferred between workspaces.
- Badge presets are grouped into product categories, including round, rectangle,
  square and Polaroid designs. All 16 measured preset sizes are retained.
- The merged PrintsMen copy has no embedded login passwords. Its session profile
  is only a local operator-name/role label, NOT authentication or copy protection.
- Original standalone source and pre-merge backups are not distributed here.
  Saved browser jobs are not included in filesystem backups; download job files
  from Badge Designer separately. PrintsMen still has no job save/restore.
- Before switching from PrintsMen, export what you need: unsaved work is lost
  on navigation. The home link warns before leaving.

## Merge Verification And Limits

The automated suite covers badge logic, category membership, combined navigation
targets, merged script syntax and absence of the old password mechanism. Full
browser/print verification of the main PrintsMen tool is still pending. A merge
does not complete its pending preflight, undo/redo, persistence or server-security
work. Uploading to Git does not enable a public deployment or GitHub Pages.

Some PrintsMen dependencies and Google Fonts load externally. Its PDF.js 6.3.289
engine is bundled for server use. Never expose this personal-use local server to
a public network as an authenticated service.

## Badge Designer Features

- Version 0.4.0: independent photo framing, bundled local face detection,
  QR captions, optional border scaling and space-saving print layouts.

- 16 badge presets, custom millimetre dimensions, rounded corners, safe/face/cut
  guides, 10 mm grid, and the asymmetric wristband safe zone.
- Text, curved text, ten shapes, QR and eight barcode formats.
- Colours, gradients, borders, shadows, opacity, image filters and crop selection.
- Drag, resize, rotation, numeric position/size, grouped alignment, layers,
  locking, hiding, stacking order, copy/paste, undo/redo and page duplication.
- Multiple PNG/JPG/WebP/SVG imports and multi-page PDF import at 300 DPI.
- Prominent **Upload images** and **Upload PDF** buttons above the canvas.
- Crop preview zoom (100-300%), horizontal/vertical pan and 90-degree rotation.
- Local TTF/OTF/WOFF/WOFF2 font import with font embedding in projects and SVG.
- CSV-linked text and codes with one generated page per data row.
- PNG, JPG, SVG and exact-size PDF print-sheet output.
- A4, 12 x 18 inch, 13 x 19 inch and custom-mm sheets, portrait/landscape;
  per-design quantities, shared or separate sheets and preview of every sheet.
- Local autosave in IndexedDB and downloadable .badge.json project files.
- Named local design library, two-tab overwrite protection and recovery control.
- Check all pages: text overflow, resolution, safe-zone and code warnings;
  downloadable 100 mm calibration PDF for checking printer scaling.

## Production Notes

### Photo Framing / Polaroids

Choose the Polaroid preset, upload photos, select a photo and open Properties >
Photo zoom / face framing. Set the image Width/Height to your desired fixed
frame first. Zoom (100-600%), drag and X/Y sliders move the picture inside that
frame. Rotate photo turns its contents without rotating or resizing the frame.
Apply changes only that photo. Original image assets are retained in saved
projects; Reset crop restores the full source and original orientation.

Detect faces locally runs the bundled pico classifier in a worker. Choose all
faces or one detected face. No identity recognition, camera permission, model
download at runtime, paid service or cloud upload is used. Best results require
upright, front-facing, sufficiently clear faces; misses and false detections
are possible. No confident result leaves the crop unchanged. Groups that cannot
fit the frame without clipping are left unchanged: widen the frame or use
Contain. Automatic framing is a suggestion, not a passport-compliance check.

Auto-frame all unlocked photos processes all visible, unlocked image objects in
the project, not just the selected page. It applies results together after the
batch completes. Cancel makes no batch changes; Undo reverses a completed batch.
Manual, unapplied changes in the dialog are replaced for the selected photo if
the batch successfully frames it. Review results before production.

### Gang-Up Printing

In Export / Print choose PDF, paper size, current/all designs and quantities.
Zero skips a design. Fill one sheet calculates the selected design's capacity;
quantities in this dialog apply only to that export. Set saved default copies
under the canvas. Rows preserve order. Space-saving rectangles may reorder
designs and optionally rotate them 90 degrees; it is a packing heuristic, not
guaranteed optimal nesting. The numbered sheet preview and PDF use one plan.
R marks rotated copies. Dimensions never scale to fill a sheet.
PNG/JPG/SVG remain single-current-badge exports.

Output is RGB, not CMYK/spot colour. PDF imports are rasterised at 300 DPI, not
retained as editable vectors. SVG imports are sanitised and rasterised to at
least 2048 pixels on the long edge; external SVG content is rejected. Imported
fonts are embedded; only use fonts whose licence permits embedding. Ordinary
system-font selections still depend on the receiving computer. Source pixels cannot be recovered by
choosing a higher export DPI. QR codes need a clear quiet zone and an actual
scanner check after printing.

PDF rasterises each badge at the chosen DPI and places that image at its exact
cut dimensions. Print with Actual Size / 100%, not Fit to Page. SVG retains
supported vector objects and embeds imported font files. SVG font support varies
between other design programs; PNG/PDF avoid that dependency. PNG supports transparency;
JPG flattens transparency onto white. Safe/face guides and the TOP indicator are
excluded from production output. Optional cut outlines are intentional.

Safe-zone warnings use declared object bounds; additional text-overflow checks
use approximate font measurements, not printer certification. Bleed-fill modes are local algorithms;
Stretch & Spin is an approximation, not verified reference-algorithm parity.
Colour removal removes matching pixels everywhere, including holes inside
letters; it is not AI segmentation. Undo restores the previous image.

## Limits

100 pages, 150 objects per page, 2,000 objects per project, 500 printed copies
per PDF export, 60 MB embedded image cache, 24 MP per raster and 100 MP of distinct
badge artwork per PDF batch. Import up to 20 files or 20 PDF pages per batch.
These are protective bounds, not certification that every maximum-sized
combination will run smoothly on every computer. Undo retains prior image assets;
Save Project and reopen it to discard unused assets and clear history.

Only the last workspace is autosaved. My designs stores up to 12 named copies
(120 MB total); imported fonts are capped at 20 files / 10 MB per project.
Browser storage can be cleared. Save Project for durable backups. If another
tab saves a newer revision, this tab pauses autosave instead of overwriting it.
Download a backup, then use Load latest saved workspace to recover.
CSV source data and undo history are not saved, but
generated pages and field names are. Files are processed locally; nothing is
uploaded to the reference website or any cloud service.

Cloud event collection, public upload links, account/profile services, a remote
template gallery, AI background removal, machine-specific certification and
CMYK/spot-colour output are not part of this local editor.

See [FEATURE-AUDIT.md](FEATURE-AUDIT.md) for actual checks, exclusions and results.
Run `npm test` for repeatable core checks. Python export inspections in `tests/`
require Pillow, pypdf and reportlab; they are QA tools, not runtime dependencies.

Run `npm run package` on Windows to build the standalone ZIP from an explicit
source-file allowlist. It excludes test-output, personal artwork, saved browser
projects and all unrelated tools. Existing ZIPs are not overwritten.
