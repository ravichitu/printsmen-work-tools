# Customised Studio 0.9.0 Preview

Date: 2026-09-30. This is a local preview, not a production-security certification.

## Eleven-item upgrade record

| Item | Delivered in this preview | Remaining boundary |
| --- | --- | --- |
| 1. Rename | Customised Studio home, designer, login, licence catalogue, launcher and installer display name | Technical product IDs, existing paths, old shortcuts and .badge.json stay compatible |
| 2. Dimensions | Shared mm geometry for new tools; mm/cm/in/ft validation; 16 existing badge presets covered by tests; all 20 legacy pages opened and 65 numeric fields edited successfully | Upload-dependent fields, every legacy export combination and physical printer calibration are not all certified |
| 3. Manual + assisted | Manual controls remain available; floating offline Job Assistant in each workspace | Not a neural/generative AI engine |
| 4. Context commands | Badge presets, copies, paper; box/dangler dimensions; route to all 20 production tools; missing-detail prompts | Legacy tools open for manual setup; their dimensions are not silently filled |
| 5. Review and undo | Review before applying; reversible badge/product settings; save-work warnings; explicit export confirmation | Legacy tools do not gain universal undo or project recovery |
| 6. File naming | Uploaded source name becomes editable output name; batch suffix; panel outputs have format/side suffixes; manual names retained | Browser controls duplicate-download suffixes; no filesystem overwrite manager |
| 7. Box designs | Open tray with four tabs and four-panel sleeve; cut/fold guides; panel artwork and colour; PDF/SVG/PNG | Nominal prototypes: no board-caliper compensation, automatic artwork bleed or manufacturer dieline certification |
| 8. Danglers | Rectangle/square, round, heart, 3-16 sides, hole-position checks, front/back artwork, copies and mirrored back placement | Requires a physical duplex/cut proof; shaped safe guide is scaled, not a true geometric offset |
| 9. 3D mockups | Uploaded panel artwork, drag/manual rotation, view zoom/light, optional spin, reduced-motion support | Presentation only; no photorealistic AI scene, fold simulation or video export |
| 10. Production assistance | Low-resolution and paper-fit warnings, applied-dimension check, bounded imports, cancel/progress, saved recipes, product Save/Open, existing badge preflight/library | No 1000-full-resolution-file queue or universal legacy autosave; no AI restoration of missing detail |
| 11. Launch verification | Automated suite, live UI sampling, measured actual PDFs; compiled preview installer result recorded separately in INSTALLER-TEST-REPORT.json | Hosting, TLS, external activation operations, code signing, ten-user accounts, printer/cutter/RIP proofing remain launch gates |

## How to use the assistant

Open Job Assistant, describe the job, Review job, then Apply reviewed settings.
Examples: `100 round badges 58 mm on A4`, `4 boxes 8 x 12 x 3 cm on 13x19`,
`12 round danglers 60 x 60 mm on A4`, `passport photos`.
Ten reviewed command recipes can be kept in local browser storage, without artwork.
The supported round-badge command uses FACE size, not full cut size: a 58 mm
badge has a 70 mm cut boundary and a 54 mm safe area in the measured preset.
Navigation never automatically uploads, deletes or exports anything.

## Verification evidence

- Full Node suite: see output/customised-09-test-results.txt for the latest run,
  including licence, updater, recovery, owner-security and automation/product tests.
- All 20 legacy production pages opened; no recorded JavaScript errors.
  103 initial number inputs had valid defaults. 31 visible-default and 34
  additional custom-paper numeric fields passed replacement/commit checks.
  Original values and paper selections were restored after these tests.
- Mixed PNG plus three-page PDF imported as four selectable items in Product
  Studio. Photo zoom changed artwork dimensions, not the product frame.
- Assistant applied four boxes to 13x19 and Undo restored A4/one copy.
  A 100-copy, 58 mm badge command retained the 70 mm cut and 54 mm safe areas.
  Legacy navigation worked with its old tab ribbon hidden.
- Actual browser PDF: four 146 x 186 mm tray bounds on one 330.2 x 482.6 mm
  (13x19-inch) sheet. PDF operators and MediaBox measured independently.
- Actual browser PDF: two A4 pages, seven 56 x 76 mm dangler bounds each,
  representing seven front/back pairs. Visible design is 50 x 70 mm plus
  3 mm outer allowance. Back positions reflect across paper width.
- PDF proofs rendered with Poppler for visual inspection. Product JSON save
  and reopen restored 50 x 70 mm dimensions, artwork, A4, seven copies and duplex.
- A native confirmation stalled one embedded-browser test tab. New assistant
  and product confirmations were replaced with in-page dialogs and export passed.
  Existing unrelated native confirmations in legacy tools remain unchanged.

## Limits and truthful output

The September 30 appearance update adds metallic silver/red highlights to the
designer and Product Studio, and metallic gold to the violet home. Shine is
bounded or interaction-triggered and respects reduced-motion settings. Designer
and Product Studio exports show rendering, sheet-building and finalising stages,
with explicit completed/cancelled/error states. Indeterminate work does not show
a fabricated percentage. Legacy export interfaces are unchanged by this update.

Product Studio: 20 imported images/PDF pages per project, 24 MP per raster,
96 MP aggregate import budget, approximately 60 MB embedded image budget,
500 copies, maximum 1000 mm per template side including allowance. Large
templates can exceed the 24 MP 300-DPI raster limit: use SVG or reduce dimensions.
Legacy imports retain their 30-file batch guard. These limits deliberately
prevent uncontrolled allocations; this is not 1000-file production certification.

Product PDF has 300-DPI raster artwork and vector cut/fold lines. Input PDF is
rasterised, not kept as editable vectors. Low effective DPI remains low-detail:
writing 300-DPI output does not make a blurry upload sharp. Output is RGB and
cut/fold lines are process colours, not named spot separations. Preview green
safe outlines and panel names are omitted from exports. PNG/SVG export one
template side; PDF exports the requested sheets and copies.

Print at Actual Size / 100%. Measure a printed proof and assemble a box before
production. Do not expose the preview server or temporary account to the internet.

## Release

The preceding 0.8.0 verified installer is preserved for rollback. See the new
0.9.0 output directory's BUILD-REPORT.json, SHA256SUMS.txt and smoke report for
the exact built artifact and result. Local source startup uses port 4178;
installed preview uses 4188. Test port 4192 is temporary.
