# Bundled Libraries

The combined release includes the existing PrintsMen source in `printsmen/`.
Its separate PDF.js 6.3.289 compatibility build, CMaps, fonts and WASM are under
`printsmen/printsmen-vendor/pdfjs/` (Apache-2.0, see its LICENSE). PrintsMen also
loads jQuery 3.7.1 (MIT), pdf-lib 1.17.1 (MIT), JSZip 3.10.1 (MIT/GPLv3 dual)
and Google Fonts externally. Optional commercial TT Drugs files are not included.
Built-in logo assets remain subject to their respective owners' rights; this
repository does not grant rights to those marks.

No third-party application source or proprietary templates were copied.

| Library | Version | License | Location |
|---|---|---|---|
| PDF.js / pdfjs-dist | 6.3.289 | Apache-2.0 | vendor/pdfjs/LICENSE |
| pdf-lib | 1.17.1 | MIT | vendor/pdf-lib/LICENSE.md |
| qrcode-generator | 1.4.4 | MIT | License notice in vendor/qr/qrcode.js |
| JsBarcode | 3.11.6 | MIT | vendor/barcode/MIT-LICENSE.txt |
| pico.js | Upstream snapshot, 21 September 2026 | MIT | vendor/pico/pico.js and README-upstream.md |
| pico facefinder model | c2e81f9d23cc11d1a612fd21e4f9de0921a5d0d9 | MIT | vendor/pico/LICENSE-model |

Face detector source: https://github.com/nenadmarkus/picojs
Model source: https://github.com/nenadmarkus/pico
SHA256 pico.js: 785b981cc79e5fa3f7557dc3fa7773629d7529994d7627de41b77d8687649309
SHA256 facefinder.bin: d8014993e7298c7b1865d1f8b855d6dbf4ec5c808bf879e2091ab6837abf90cd
The detector and model are bundled for local operation without runtime downloads.
QA portrait: scikit-image v0.19.3 astronaut sample, downloaded into test-output;
not included in the release or loaded by the app automatically.

QA only: jsQR 1.4.0 (Apache-2.0), downloaded from the npm registry without lifecycle
scripts. Its package and LICENSE are in the ignored test-output/package folder;
it is not loaded by the editor or required to run it. Poppler, Pillow, pypdf and
reportlab were used from the local testing environment, not bundled into the app.
