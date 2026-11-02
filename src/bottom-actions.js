// Repeats the header's action buttons at the end of the classic iframe. The
// copies only forward clicks, so NetSuite's buttons still do all the work.
const PreviousBottomActions = (() => {
  const BAR_CLASS = 'pfn-bottom-actions';
  const ICON_STYLESHEET = 'uxiconfont';
  const PRIMARY_GROUP = '.ns-ui-toolkit-header-actions__primary, [data-pfn-primary]';

  let observer = null;
  let scheduled = false;

  function frameDocument() {
    return document.querySelector('iframe.ns-ui-toolkit-classic-iframe')?.contentDocument ?? null;
  }

  // The class is shared by several nested components. The one that holds the
  // page is whichever scrolls the furthest.
  function pageScroller(doc) {
    const candidates = [...(doc?.querySelectorAll('.ns-child-component') ?? [])];
    return candidates.reduce(
      (tallest, el) => (!tallest || el.scrollHeight > tallest.scrollHeight ? el : tallest),
      null,
    );
  }

  function labelOf(button) {
    return button.getAttribute('aria-label') || button.textContent.trim();
  }

  // Follows the order the header shows: when the actions are on the left they run
  // in reverse with Edit and Save first, and Copy link stays at the end.
  function headerButtons() {
    const header = document.querySelector('.ns-ui-toolkit-header-actions');
    if (!header) return [];
    const buttons = [...header.querySelectorAll('button')].filter((button) => button.checkVisibility());
    if (!document.documentElement.hasAttribute('data-pfn-actions-left')) return buttons;
    const isCopyLink = (button) => button.classList.contains('pfn-copy-link');
    // Edit and Save keep their own order, or a split button's arrow would lead.
    const isNamed = (button) => Boolean(button.closest('[data-pfn-primary]'));
    return [
      ...buttons.filter(isNamed),
      ...buttons.filter((button) => !isNamed(button) && !isCopyLink(button)).reverse(),
      ...buttons.filter(isCopyLink),
    ];
  }

  function describe(buttons) {
    return buttons.map((button) => `${labelOf(button)}|${button.disabled}`).join('\n');
  }

  // Only the shell loads NetSuite's icon font, so the frame needs its own copy.
  function loadIconFont(doc) {
    const source = document.getElementById(ICON_STYLESHEET);
    if (!source) return false;
    if (!doc.getElementById(ICON_STYLESHEET)) {
      const link = doc.createElement('link');
      link.id = ICON_STYLESHEET;
      link.rel = 'stylesheet';
      link.href = source.href;
      doc.head.append(link);
    }
    return true;
  }

  function fillCopy(doc, copy, original, label) {
    const icon = original.classList.contains('pfn-copy-link') && original.querySelector('span');
    if (!icon || !loadIconFont(doc)) {
      copy.textContent = label;
      return;
    }
    const glyph = doc.createElement('span');
    glyph.className = icon.className;
    copy.append(glyph);
    copy.classList.add('pfn-icon');
    copy.title = label;
    copy.setAttribute('aria-label', label);
  }

  function createCopy(doc, original) {
    const copy = doc.createElement('button');
    const label = labelOf(original);
    copy.type = 'button';
    copy.disabled = original.disabled;
    fillCopy(doc, copy, original, label);
    copy.classList.toggle('pfn-primary', Boolean(original.closest(PRIMARY_GROUP)));
    // Looked up on click because NetSuite can re-render the header at any time.
    copy.addEventListener('click', () => {
      headerButtons().find((button) => labelOf(button) === label)?.click();
    });
    return copy;
  }

  function sync() {
    scheduled = false;
    if (!observer) return;
    const doc = frameDocument();
    const scroller = pageScroller(doc);
    const buttons = headerButtons();
    let bar = doc?.querySelector(`.${BAR_CLASS}`);

    if (!scroller || !buttons.length) {
      bar?.remove();
      return;
    }

    const description = describe(buttons);
    if (bar?.dataset.pfnButtons === description) return;

    if (!bar) {
      bar = doc.createElement('div');
      bar.className = BAR_CLASS;
      scroller.append(bar);
    }
    bar.dataset.pfnButtons = description;
    bar.replaceChildren(...buttons.map((button) => createCopy(doc, button)));
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  // Load events don't bubble, so capturing is what catches the iframe reloading.
  function onLoad(event) {
    if (event.target.tagName === 'IFRAME') schedule();
  }

  return {
    enable() {
      if (observer) return;
      observer = new MutationObserver(schedule);
      observer.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['aria-label', 'disabled'],
      });
      document.addEventListener('load', onLoad, true);
      schedule();
    },

    disable() {
      if (!observer) return;
      observer.disconnect();
      observer = null;
      document.removeEventListener('load', onLoad, true);
      frameDocument()?.querySelector(`.${BAR_CLASS}`)?.remove();
    },
  };
})();
