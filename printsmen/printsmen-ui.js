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
    studioHome.href='../index.html';studioHome.textContent='Badge Studio Home';studioHome.style.color='#ffe4a0';
    studioHome.onclick=event=>{if(!confirm('Return to Badge Studio Home? Unsaved PrintsMen artwork and settings will be lost.'))event.preventDefault();};
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
    menu.querySelector('[data-home]').onclick = () => ribbon.querySelector('[data-page="page0"]').click();
    ribbon.querySelectorAll('.tab').forEach(tab => {
      if (tab.dataset.page === 'page0') return;
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
    const queuedImports = ['handleFiles1','handleFiles2','handleFiles3','handleFiles4','handleFiles5','p14HandleFiles','p15HandleFiles','p16HandleFiles','p17HandleFiles','p18HandleFiles','p19HandleFiles','p20HandleFiles','p21HandleFiles'];
    for(const key of queuedImports) {
      const original = window[key];
      if(typeof original !== 'function') continue;
      window[key] = async function(files) {
        if(busy) { info('Import in progress', 'Wait for this import to finish or cancel it before starting another.'); return; }
        const list = Array.from(files);
        if(list.length > 30) { info('Import limit', 'Choose up to 30 files per batch.'); return; }
        busy = true;
        window.printsmenImport.cancelled = false;
        window.printsmenImport.pixels = 0;
        uploadStatus.hidden = false;
        cancel.disabled = false;
        try {
          for(let i = 0; i < list.length; i++) {
            if(window.printsmenImport.cancelled) break;
            window.printsmenImport.report('File ' + (i + 1) + ' of ' + list.length + ': ' + list[i].name);
            await original([list[i]]);
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        } finally { busy = false; uploadStatus.hidden = true; window.printsmenImport.cancelled = false; }
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
