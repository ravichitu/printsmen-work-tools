# PrintsMen 0.9.5 Upgrade Register

This register is the implementation checklist for the 75-item production upgrade request. `Complete` means it is present in the local application and covered by a source or automated check. `Bounded` means the application deliberately prevents an unsafe browser operation and explains the production boundary.

| # | Upgrade | Status | Implementation evidence |
|---:|---|---|---|
| 1 | Remove duplicate Badge Studio desktop shortcut | Complete | Installer removes the legacy shortcut during install and update. |
| 2 | Keep one Customised Studio desktop shortcut | Complete | Installer creates one Customised Studio Preview shortcut. |
| 3 | Repair old shortcuts during upgrade | Complete | Old desktop and Start Menu links are deleted before new links are created. |
| 4 | Rename visible Start Menu product | Complete | Start Menu group and main link use Customised Studio. |
| 5 | Preserve old internal launcher compatibility | Complete | Legacy launcher remains in the payload for existing scripts. |
| 6 | Violet and gold brand dashboard | Complete | Home and shared navigation retain the PrintsMen violet/gold identity. |
| 7 | Metallic shine and reduced-motion animation | Complete | Home and designer animation CSS respects prefers-reduced-motion. |
| 8 | Tool categories, search and filters | Complete | Home catalogue exposes searchable production categories. |
| 9 | Recent, favourite and resume surfaces | Complete | Local designer library and project resume controls are shipped. |
| 10 | Context Job Assistant routing | Complete | Local assistant routes paper, product, badge and photo requests for review. |
| 11 | Interactive notices | Complete | Shared status, dialog and toast surfaces are used for errors and confirmations. |
| 12 | Export progress and cancellation | Complete | Legacy, designer and product exports expose progress and cancellation. |
| 13 | Keyboard and small-screen layout | Complete | Shared navigation and responsive workspace styles are shipped. |
| 14 | Reduced motion | Complete | Output and dashboard animation paths have reduced-motion fallbacks. |
| 15 | Digital print CMYK entry path | Bounded | UV Artwork already exposes CMYK PDF/TIFF controls; browser-only ICC authoring is kept out of the RGB editor. |
| 16 | Bulk JPG/PNG/TIFF/PDF input | Bounded | JPG, PNG and PDF paths are supported; unsupported browser TIFF input is rejected with a clear message. |
| 17 | CMYK production output | Bounded | Device-CMYK PDF/TIFF path exists in UV Artwork; RGB PNG remains explicitly labelled. |
| 18 | PDF/X output modes | Bounded | Export metadata and output validation are present; full RIP-certified PDF/X profiles remain printer-dependent. |
| 19 | ICC profile import | Bounded | No fake ICC conversion is claimed in the browser. Native profile conversion is a release boundary. |
| 20 | Rendering intents | Bounded | Output settings remain explicit; browser canvas does not silently invent an ICC intent. |
| 21 | Black preservation and ink limit | Bounded | CMYK conversion controls remain isolated to the CMYK path pending native colour management. |
| 22 | CMYK separation previews | Complete | UV Artwork exposes process and white-channel previews. |
| 23 | RGB/CMYK soft proof | Bounded | RGB preview is labelled; proof colour depends on the target ICC profile. |
| 24 | PNG stays RGBA | Complete | PNG export preserves transparency and is labelled RGB/RGBA. |
| 25 | UV W1/W2 spot channels | Complete | UV Artwork uses uppercase W1/W2 spot layers in the PDF/TIFF path. |
| 26 | Bleed, crop marks, page background and transparency | Complete | Shared legacy and custom-size paths expose these controls. |
| 27 | Batch naming and ZIP-ready exports | Complete | Uploaded names flow into output names and batch suffixes. |
| 28 | 90-600 DPI production presets | Complete | Shared DPI control is bounded to 90, 150, 200, 300, 360 and 600. |
| 29 | Custom DPI limited to 90-600 | Complete | Runtime normalizes any requested value into the supported range. |
| 30 | Final pixel and memory estimate | Complete | production-runtime.mjs estimates pixels, RGBA working memory and output size. |
| 31 | Effective DPI warning | Complete | Custom Size file rows show effective DPI for the placed physical size. |
| 32 | Low-source-quality warning | Complete | Effective DPI is classified as good, warning or low. |
| 33 | High-quality resampling path | Complete | Existing high-quality canvas resampling and source-preserving fit paths remain active. |
| 34 | Preserve vector text and shapes | Complete | Designer SVG output retains text and shapes; imported PDF limits are documented. |
| 35 | Tiled/native background rendering | Bounded | Preview is tile-safe and export is queued; full native streaming engine is a desktop boundary. |
| 36 | Reject unsafe DPI and sheet combinations | Complete | Runtime marks canvas-edge and memory jobs unsafe before raster work. |
| 37 | Sequential export queue | Complete | ProductionQueue processes jobs one at a time with progress, pause and cancel state. |
| 38 | Unified face framing | Complete | Polaroid and Custom Shape share local face framing controls. |
| 39 | Face boxes and confidence | Complete | Local Pico worker returns face candidates and confidence data. |
| 40 | One-face and all-face modes | Complete | Manual single-photo and bulk framing paths are available. |
| 41 | Headroom and eye-line framing | Complete | Face framing presets retain headroom and crop bounds. |
| 42 | Auto Centre, Fit Face, Fill and Reset | Complete | Photo editor exposes manual and assisted fit controls. |
| 43 | Manual zoom, pan, rotation and crop | Complete | Non-destructive photo controls are present in editor and legacy paths. |
| 44 | Framing lock | Complete | Locked objects and protected selection controls are enforced. |
| 45 | Non-destructive undo | Complete | Designer history and photo edits can be undone before export. |
| 46 | Fully local face processing | Complete | Pico model and worker run locally without a paid API. |
| 47 | Preview/export crop parity | Complete | Shared placement values are used by preview and export. |
| 48 | Exact dimensions and DPI tests | Complete | Core, upgrade and output verification tests cover physical geometry and metadata. |
| 49 | Fresh install/update regression | Complete | Licensing and updater suites cover install identity and rollback. |
| 50 | Mixed PDF and bulk regression | Complete | Multi-page PDF, mixed-size packing and 500-placement tests are present. |
| 51 | Release hash, tag and installer | Complete | 0.9.5 package and preview installer are built; SHA-256 is recorded in the installer folder and the release is tagged before push. |
| 52 | Unified local application window | Bounded | Current edition uses a local authenticated studio server and browser shell. |
| 53 | Retain HTML/CSS editor UI | Complete | Existing editor remains the production surface. |
| 54 | Background production engine | Complete | Async handlers, workers and queue foundations keep the UI responsive. |
| 55 | Tile processing | Complete | Preview limits and sequential output avoid all-at-once decoding. |
| 56 | Stream TIFF/PDF work | Bounded | Blob/object URL flow avoids base64 duplication; final PDF remains in browser memory. |
| 57 | Native ICC CMYK | Bounded | Kept as a native-engine integration boundary; no false browser conversion claim. |
| 58 | Worker processing | Complete | Face worker and async/yielding import/export paths are shipped. |
| 59 | Memory, disk and output estimates | Complete | Runtime estimates are available before Custom Size output. |
| 60 | Pause, cancel, recovery | Complete | Queue API and shared import/output cancellation are shipped. |
| 61 | Temporary asset cleanup | Complete | Object URLs and preview cache entries are released on remove/reset. |
| 62 | Crash/power recovery | Bounded | Licence/update state is durable; full resumable raster checkpoints require native streaming. |
| 63 | Printer/RIP integration | Bounded | Exact PDF geometry and named UV channels are exposed; printer-specific RIP integration remains external. |
| 64 | Local artwork by default | Complete | Application inputs and output remain local. |
| 65 | Normal production DPI cap 600 | Complete | Shared runtime refuses values above 600. |
| 66 | 300 DPI default | Complete | OPS state defaults to 300 DPI. |
| 67 | 90-150 DPI preview choices | Complete | Shared DPI dialog includes draft and proof choices. |
| 68 | One large 600 DPI sheet at a time | Complete | Estimate warns when a 600 DPI job contains multiple sheets. |
| 69 | 12x18, 13x19 and custom tiling | Complete | Paper geometry and custom-size shelf packing are retained. |
| 70 | Bulk file queue | Complete | 500-file shared import ceiling and sequential handlers are active. |
| 71 | Display estimates before heavy work | Complete | Custom Size shows pixel and peak-memory estimate during output. |
| 72 | Warn effective DPI | Complete | Source quality is visible per uploaded file. |
| 73 | Vector PDF text/shapes | Complete | Designer SVG/vector path is preserved; raster-only legacy imports are labelled. |
| 74 | 64-bit Windows and SSD guidance | Complete | Installer is 64-bit and release documentation records local production requirements. |
| 75 | Integrated graphics support | Complete | Browser/canvas workflow requires no dedicated GPU; face detection uses CPU worker fallback. |

## 0.9.5 high-load change

Standard Imposition and Custom Size no longer rebuild the whole upload list after every file. Image imports use object URLs instead of base64 copies, preview decoding is limited to the visible sheet, long lists are paginated at 50 rows, Custom Size preview is capped to 120 visible slots, and output embeds each source only when its sheet needs it. This is the change that addresses the reported 500-image hang.

The bounded colour-management items are intentionally labelled rather than pretending that an RGB browser canvas is a colour-managed CMYK RIP. The local UV path remains available for the CMYK and W1/W2 workflow; native ICC/PDF-X production should be added only with a bundled colour engine and a printer profile.
