// Adds a copy link button to case pages. The fields live in the classic iframe,
// which is same-origin, so the shell can read them directly.
const PreviousCopyLink = (() => {
  const CASE_PATH = /^\/next\/support-case\/\d+/;
  const BUTTON_CLASS = 'pfn-copy-link';
  const FEEDBACK_MS = 2000;
  const ICONS = { idle: 'oj-ux-ico-link', copied: 'oj-ux-ico-check', failed: 'oj-ux-ico-close' };
  const LABELS = { idle: 'Copy link', copied: 'Copied', failed: "Couldn't copy" };

  let observer = null;
  let scheduled = false;

  function field(doc, name) {
    const value = doc?.querySelector(`[data-field-name="${name}"] .uir-field`);
    if (!value || value.querySelector('.uir-field-no-value')) return '';
    const input = value.querySelector('input:not([type="hidden"])');
    return (input?.value ?? value.textContent).replace(/\s+/g, ' ').trim();
  }

  // Selects read like "301: The Hudson Chattanooga : 3861: 6590 Foxboro Dr".
  function siteName(doc) {
    const site = field(doc, 'custevent_ua_case_site') || field(doc, 'custevent_ws_site_select_custrec');
    return site.split(' : ')[0].replace(/^\d+:\s*/, '');
  }

  function linkLabel() {
    const doc = document.querySelector('iframe.ns-ui-toolkit-classic-iframe')?.contentDocument;
    const number = field(doc, 'casenumber') || document.querySelector('.ns-ui-header-title')?.textContent.trim();
    const contact = field(doc, 'custevent_ws_contact_name') || field(doc, 'contact').split(' : ').pop();
    return [`Case ${number}`, contact, siteName(doc)].filter(Boolean).join(' - ');
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  function copyWithEvent(plain, html) {
    const onCopy = (event) => {
      event.clipboardData.setData('text/plain', plain);
      event.clipboardData.setData('text/html', html);
      event.preventDefault();
    };
    document.addEventListener('copy', onCopy, { capture: true, once: true });
    const copied = document.execCommand('copy');
    document.removeEventListener('copy', onCopy, { capture: true });
    return copied;
  }

  // Rich text apps paste a link titled with the label. Plain text fields
  // can't hold a link, so they get the label followed by the URL.
  async function copy() {
    const label = linkLabel();
    const url = location.href;
    const plain = `${label} - ${url}`;
    const html = `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
      return true;
    } catch {
      return copyWithEvent(plain, html);
    }
  }

  function setState(button, state) {
    button.querySelector('span').className = ICONS[state];
    button.title = LABELS[state];
    button.setAttribute('aria-label', LABELS[state]);
  }

  function createButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    button.append(document.createElement('span'));
    setState(button, 'idle');

    let timer;
    button.addEventListener('click', async () => {
      const copied = await copy();
      setState(button, copied ? 'copied' : 'failed');
      clearTimeout(timer);
      timer = setTimeout(() => setState(button, 'idle'), FEEDBACK_MS);
    });
    return button;
  }

  // NetSuite re-renders the header and navigates without reloading, so this
  // runs on every DOM change and keeps the button matched to the current page.
  function sync() {
    scheduled = false;
    if (!observer) return;
    const existing = document.querySelector(`.${BUTTON_CLASS}`);
    if (!CASE_PATH.test(location.pathname)) {
      existing?.remove();
      return;
    }
    if (existing) return;
    document.querySelector('.ns-ui-toolkit-header-actions')?.append(createButton());
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  return {
    enable() {
      if (observer) return;
      observer = new MutationObserver(schedule);
      observer.observe(document, { subtree: true, childList: true });
      schedule();
    },

    disable() {
      if (!observer) return;
      observer.disconnect();
      observer = null;
      document.querySelector(`.${BUTTON_CLASS}`)?.remove();
    },
  };
})();
