(function () {
  'use strict';
  function normalizeNumber(value, min, max, step) {
    let n = Number(value);
    if (!String(value).trim() || !Number.isFinite(n)) return null;
    if (min !== '') n = Math.max(Number(min), n);
    if (max !== '') n = Math.min(Number(max), n);
    if (step !== 'any') {
      const increment = Number(step || 1);
      const base = min === '' ? 0 : Number(min);
      if (increment > 0) n = base + Math.round((n - base) / increment) * increment;
      if (max !== '' && n > Number(max)) n = base + Math.floor((Number(max) - base) / increment) * increment;
      if (min !== '') n = Math.max(Number(min), n);
    }
    return Number(n.toFixed(10));
  }
  if (typeof module !== 'undefined') module.exports = { normalizeNumber };
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', () => {
    const ribbon = document.querySelector('.tab-bar');
    if (!ribbon) return;
    const menu = document.createElement('nav');
    menu.className = 'studio-menu';
    menu.setAttribute('aria-label', 'Main navigation');
    menu.innerHTML = '<button type="button" data-home>Home</button><details><summary>Tools</summary><div class="studio-tool-list"></div></details><button type="button" data-about>About Me</button><button type="button" data-license>Licensing</button>';
    ribbon.before(menu);
    const studioHome=document.createElement('a');
    studioHome.href='../index.html';studioHome.textContent='Customised Studio Home';studioHome.style.color='#ffe4a0';
    studioHome.onclick=event=>{if(!confirm('Return to Customised Studio Home? Unsaved PrintsMen artwork and settings will be lost.'))event.preventDefault();};
    import('../assistant.js').catch(()=>{});
    menu.prepend(studioHome);
    document.body.classList.add('studio-navigation-ready');
    const dialog = document.createElement('dialog');
    dialog.className = 'studio-dialog';
    dialog.innerHTML = '<h2></h2><p></p><form method="dialog"><button>Close</button></form>';
    document.body.append(dialog);
    function info(title, text) {
      dialog.querySelector('h2').textContent = title;
      dialog.querySelector('p').textContent = text;
      dialog.showModal();
    }
    const sync = () => document.body.classList.toggle('studio-home', !!document.querySelector('.tab.active[data-page="page0"]'));
    new MutationObserver(sync).observe(ribbon, { subtree:true, attributes:true, attributeFilter:['class'] });
    sync();

    // Turn the long production catalogue into a searchable launch surface.
    // This is navigation-only: filtering never changes a tool's state.
    const homePage = document.getElementById('page0');
    const homeHero = homePage?.querySelector('.home-hero');
    const homeGrid = homePage?.querySelector('.home-grid');
    if(homeHero && homeGrid) {
      const homeDock = document.createElement('section');
      homeDock.className = 'studio-home-tools';
      homeDock.setAttribute('aria-label', 'Find a production tool');
      homeDock.innerHTML = '<div class="studio-home-search"><label for="homeToolSearch">Find a tool, size or format</label><input id="homeToolSearch" type="search" autocomplete="off" placeholder="Try: passport, 13x19, PDF or UV"><span id="homeToolCount" role="status"></span></div><div class="studio-home-filters" role="group" aria-label="Tool categories"><button type="button" class="active" data-home-filter="all">All tools</button><button type="button" data-home-filter="layout">Layout</button><button type="button" data-home-filter="photo">Photo</button><button type="button" data-home-filter="output">Output</button><button type="button" data-home-filter="studio">Studio</button><button type="button" data-home-filter="production">Production</button></div><p class="studio-home-empty" hidden>No tools match that search. Try a size such as A4, 12×18 or 13×19.</p>';
      homeHero.after(homeDock);
      const search = homeDock.querySelector('#homeToolSearch');
      const counter = homeDock.querySelector('#homeToolCount');
      const empty = homeDock.querySelector('.studio-home-empty');
      const cards = Array.from(homeGrid.querySelectorAll('.home-card'));
      const categoryFor = id => {
        if(['page1','page2','page3','page4','page7','page8','page9'].includes(id)) return 'layout';
        if(['page5','page14','page17'].includes(id)) return 'photo';
        if(['page15','page19'].includes(id)) return 'output';
        if(['page20','page21'].includes(id)) return 'production';
        return 'studio';
      };
      cards.forEach(card => { card.dataset.toolCategory = categoryFor(card.dataset.jump); });
      let selectedCategory = 'all';
      const applyFilter = () => {
        const query = search.value.trim().toLowerCase();
        let visible = 0;
        cards.forEach(card => {
          const matchesCategory = selectedCategory === 'all' || card.dataset.toolCategory === selectedCategory;
          const matchesText = !query || card.textContent.toLowerCase().includes(query);
          card.hidden = !(matchesCategory && matchesText);
          if(!card.hidden) visible++;
        });
        counter.textContent = `${visible} of ${cards.length} tools`;
        empty.hidden = visible !== 0;
      };
      homeDock.querySelectorAll('[data-home-filter]').forEach(button => button.addEventListener('click', () => {
        selectedCategory = button.dataset.homeFilter;
        homeDock.querySelectorAll('[data-home-filter]').forEach(item => item.classList.toggle('active', item === button));
        applyFilter();
      }));
      search.addEventListener('input', applyFilter);
      document.addEventListener('keydown', event => {
        if(event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) { event.preventDefault(); search.focus(); }
        if(event.key === 'Escape' && document.activeElement === search) { search.value = ''; applyFilter(); search.blur(); }
      });
      applyFilter();
    }
    menu.querySelector('[data-home]').onclick = () => ribbon.querySelector('[data-page="page0"]').click();
    ribbon.querySelectorAll('.tab').forEach(tab => {
      if (tab.dataset.page === 'page0') return;
      if (window.PRINTSMEN_ALLOWED_PAGES && !window.PRINTSMEN_ALLOWED_PAGES.includes(tab.dataset.page)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = Array.from(tab.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim() || tab.textContent.trim();
      button.onclick = () => { tab.click(); menu.querySelector('details').open = false; };
      menu.querySelector('.studio-tool-list').append(button);
    });
    menu.querySelector('[data-about]').onclick = () => info('About PrintsMen', 'PrintsMen is a personal print-production workspace for preparing artwork, photo sheets, labels and imposition layouts. Owner biography and contact details have not been configured.');
    menu.querySelector('[data-license]').onclick = () => info('Licensing', 'Use only artwork and fonts you have permission to reproduce. Third-party libraries, logos and fonts retain their respective licences. Commercial distribution terms for PrintsMen have not been configured. The built-in login is not secure hosted authentication.');
    const preflightButton = document.createElement('button');
    preflightButton.type = 'button';
    preflightButton.textContent = 'Check Inputs';
    menu.append(preflightButton);
    function inputProblems(page) {
      return Array.from(page?.querySelectorAll('input[type=number]') || [])
        .filter(field => !field.disabled && field.getClientRects().length && (field.value === '' || !field.validity.valid))
        .map(field => (field.title || field.id || 'Numeric field') + ': ' + (field.validationMessage || 'enter a number'));
    }
    preflightButton.onclick = () => {
      const problems = inputProblems(document.querySelector('.page.active'));
      info('Input Check', problems.length ? problems.join('\n') : 'Visible numeric inputs are valid. This is not a full print preflight: artwork resolution, fonts, clipping, colour separations and preview/export matching still need verification.');
    };
    document.addEventListener('click', event => {
      const button = event.target.closest('.page button');
      if(!button || !/export/i.test(button.id + ' ' + button.className)) return;
      const problems = inputProblems(button.closest('.page'));
      if(problems.length) {
        event.preventDefault();event.stopImmediatePropagation();
        info('Correct Inputs Before Export', problems.join('\n'));
      }
    }, true);

    // Keep every legacy output action visible while it is working. The older
    // tools have their own export implementations, so this shared layer
    // observes the common export button and the existing toast result.
    const outputStatus = document.createElement('section');
    outputStatus.className = 'studio-output-status';
    outputStatus.hidden = true;
    outputStatus.setAttribute('role', 'status');
    outputStatus.setAttribute('aria-live', 'polite');
    outputStatus.innerHTML = '<div class="studio-output-copy"><strong></strong><span></span></div><progress max="1" aria-label="Output progress"></progress>';
    document.body.append(outputStatus);
    const outputTitle = outputStatus.querySelector('strong');
    const outputMessage = outputStatus.querySelector('span');
    const outputBar = outputStatus.querySelector('progress');
    let activeOutput = null;
    let outputHideTimer = null;
    const outputProgress = window.printsmenOutputProgress = {
      start(button) {
        activeOutput = button;
        clearTimeout(outputHideTimer);
        outputStatus.hidden = false;
        outputStatus.dataset.state = 'working';
        outputStatus.setAttribute('aria-busy', 'true');
        outputTitle.textContent = 'Creating output';
        outputMessage.textContent = (button.textContent || 'Export').replace(/\s+/g, ' ').trim() + ' is in progress. Keep this window open.';
        outputBar.removeAttribute('value');
      },
      update(message) {
        if(!activeOutput) return;
        outputMessage.textContent = message || 'Processing artwork...';
      },
      finish(state, message) {
        if(!activeOutput) return;
        outputStatus.dataset.state = state;
        outputStatus.removeAttribute('aria-busy');
        outputTitle.textContent = state === 'done' ? 'Output ready' : 'Output needs attention';
        outputMessage.textContent = message || (state === 'done' ? 'The file is ready.' : 'The export could not be completed.');
        outputBar.value = state === 'done' ? 1 : 0;
        const finishedButton = activeOutput;
        activeOutput = null;
        outputHideTimer = setTimeout(() => {
          outputStatus.hidden = true;
          if(finishedButton) finishedButton.removeAttribute('aria-busy');
        }, 5000);
      }
    };
    document.addEventListener('click', event => {
      const button = event.target.closest('.page .export-btn');
      if(button && !button.disabled) outputProgress.start(button);
    }, true);
    const originalShowToast = window.showToast;
    if(typeof originalShowToast === 'function') {
      window.showToast = function(message, kind) {
        if(activeOutput) {
          if(kind === 'success') outputProgress.finish('done', message);
          else if(kind === 'error') outputProgress.finish('error', message);
          else outputProgress.update(message);
        }
        return originalShowToast.apply(this, arguments);
      };
    }

    const uploadStatus = document.createElement('div');
    uploadStatus.className = 'studio-status';
    uploadStatus.hidden = true;
    const progress = document.createElement('span');
    progress.setAttribute('role', 'status');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel import';
    uploadStatus.append(progress, cancel);
    document.body.append(uploadStatus);
    window.printsmenImport = { cancelled:false, pixels:0, report:message => { progress.textContent = message + ' '; } };
    cancel.onclick = () => { window.printsmenImport.cancelled = true; cancel.disabled = true; progress.textContent = 'Cancelling after the current rendering step...'; };
    let busy = false;
    const naming=import('../naming.js');
    import('../production-runtime.mjs').then(runtime => { window.printsmenProduction = runtime; }).catch(console.error);
    const filenameSelector='.export-filename,input[id$="Filename"]';
    document.addEventListener('input',event=>{if(event.target.matches(filenameSelector))event.target.dataset.manualName='true';});
    const queuedImports = ['handleFiles1','handleFiles2','handleFiles3','handleFiles4','handleFiles5','handleFiles8','handleFiles9','p14HandleFiles','p15HandleFiles','p16HandleFiles','p17HandleFiles','p18HandleFiles','p19HandleFiles','p20HandleFiles','p21HandleFiles'];
    for(const key of queuedImports) {
      const original = window[key];
      if(typeof original !== 'function') continue;
      window[key] = async function(files) {
        if(busy) { info('Import in progress', 'Wait for this import to finish or cancel it before starting another.'); return; }
        const list = Array.from(files);
        if(list.length > 1000) { info('Import limit', 'Choose up to 1000 files per batch.'); return; }
        const pageNumber=(key.match(/\d+/)||[])[0];
        const filename=document.getElementById('filename'+pageNumber)||document.getElementById('p'+pageNumber+'Filename');
        const manualName=filename?.dataset.manualName==='true'?filename.value:null;
        busy = true;
        window.printsmenImport.cancelled = false;
        window.printsmenImport.pixels = 0;
        uploadStatus.hidden = false;
        cancel.disabled = false;
        try {
          window.printsmenImport.report('Preparing ' + list.length + ' file' + (list.length === 1 ? '' : 's') + '...');
          // Page handlers already process arrays sequentially. Calling them once avoids
          // rebuilding the complete file list and canvas after every imported file.
          await original(list);
          if(list.length&&filename&&!window.printsmenImport.cancelled){filename.value=manualName??(await naming).uploadName(list);filename.dispatchEvent(new Event('change',{bubbles:true}));}
        } finally { if(manualName!==null&&filename)filename.value=manualName;busy = false; uploadStatus.hidden = true; window.printsmenImport.cancelled = false; }
      };
    }
    const polaroidInput = document.getElementById('fileInput5');
    if(polaroidInput) polaroidInput.accept = '.jpg,.jpeg,.png,.pdf';
    const lastValid = new WeakMap();
    const status = document.createElement('div');
    status.className = 'studio-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    document.body.append(status);
    let timer;
    function tell(message) {
      status.textContent = message;
      status.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => { status.hidden = true; }, 6000);
    }
    document.addEventListener('focusin', event => {
      const field = event.target;
      if (field.matches('.page input[type=number]') && field.value !== '' && field.validity.valid) lastValid.set(field, field.value);
    });
    // Let the user clear and type a replacement; incomplete values must not reach render handlers.
    document.addEventListener('input', event => {
      const field = event.target;
      if (!field.matches('.page input[type=number]')) return;
      if (!field.validity.valid || field.value === '') {
        field.setAttribute('aria-invalid', 'true');
        event.stopImmediatePropagation();
      } else {
        field.removeAttribute('aria-invalid');
        lastValid.set(field, field.value);
      }
    }, true);
    document.addEventListener('change', event => {
      const field = event.target;
      if (!field.matches('.page input[type=number]')) return;
      const number = normalizeNumber(field.value, field.min, field.max, field.step);
      const replacement = number === null ? lastValid.get(field) : String(number);
      if (replacement === undefined) {
        field.setAttribute('aria-invalid', 'true');
        tell('Enter a valid number before continuing.');
        event.stopImmediatePropagation();
        return;
      }
      const changed = field.value !== replacement;
      field.value = replacement;
      field.removeAttribute('aria-invalid');
      lastValid.set(field, replacement);
      if (changed) {
        tell('Value adjusted to the allowed range and increment: ' + replacement);
        field.dispatchEvent(new Event('input', { bubbles:true }));
      }
    }, true);
  });
})();
