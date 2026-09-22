/* One version and worker for every tool. No fallback to vulnerable PDF.js. */
(function () {
  'use strict';
  const local = new URL('printsmen-vendor/pdfjs/', document.currentScript.src);
  const base = location.protocol === 'file:'
    ? 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/' : local.href;
  let loading;
  async function library() {
    if (!loading) loading = import(base + 'legacy/build/pdf.min.mjs').then(pdf => {
      pdf.GlobalWorkerOptions.workerSrc = base + 'legacy/build/pdf.worker.min.mjs';
      return pdf;
    }).catch(error => { loading = null; throw new Error('PDF engine could not load. Check the bundled files or internet connection. ' + error.message); });
    return loading;
  }
  window.printsmenOpenPdf = async function(options) {
    const bytes = options.data?.byteLength;
    if (!bytes || bytes > 40 * 1024 * 1024) throw new Error('PDF must be non-empty and no larger than 40 MB.');
    const pdf = await library();
    const task = pdf.getDocument({
      ...options, isEvalSupported:false, stopAtErrors:true,
      canvasMaxAreaInBytes:96000000,
      cMapUrl:base + 'cmaps/', cMapPacked:true,
      standardFontDataUrl:base + 'standard_fonts/', wasmUrl:base + 'wasm/'
    });
    let doc;
    try { doc = await task.promise; }
    catch(error) { await task.destroy(); throw error; }
    // PDF.js 6 moved document destruction to its loading task.
    doc.destroy = () => task.destroy();
    if (doc.numPages > 100) {
      await doc.destroy();
      throw new Error('PDF exceeds the 100-page document limit. Split the document into smaller jobs.');
    }
    return doc;
  };
})();
