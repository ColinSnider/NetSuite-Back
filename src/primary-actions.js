// Marks the path from the header down to Edit and Save so that content.css can
// put them farthest left. Save lives in a different place from Edit (it's a split button
// in edit mode), so they're found by name instead of by where they sit. The
// button's own wrapper is marked too, which keeps a split button's arrow with it.
const PreviousPrimaryActions = (() => {
  const LABEL = /^(edit|save)\b/i;
  const HEADER = '.ns-ui-toolkit-header-actions';
  const FIRST = 'data-pfn-first';
  const PRIMARY = 'data-pfn-primary';

  let observer = null;
  let scheduled = false;

  function isPrimary(button) {
    return LABEL.test(button.getAttribute('aria-label') ?? '') || LABEL.test(button.textContent.trim());
  }

  function mark(header, attribute, elements) {
    header.querySelectorAll(`[${attribute}]`).forEach((el) => {
      if (!elements.has(el)) el.removeAttribute(attribute);
    });
    elements.forEach((el) => el.setAttribute(attribute, ''));
  }

  function sync() {
    scheduled = false;
    if (!observer) return;
    const header = document.querySelector(HEADER);
    if (!header) return;

    const path = new Set();
    const wrappers = new Set();
    for (const button of header.querySelectorAll('button')) {
      if (!isPrimary(button)) continue;
      wrappers.add(button.parentElement);
      for (let el = button.parentElement; el && el !== header; el = el.parentElement) path.add(el);
    }

    mark(header, FIRST, path);
    mark(header, PRIMARY, wrappers);
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
      for (const attribute of [FIRST, PRIMARY]) {
        document.querySelectorAll(`[${attribute}]`).forEach((el) => el.removeAttribute(attribute));
      }
    },
  };
})();
