// Adds record filter buttons to the search popup. Each one puts a prefix such as
// "case:" in front of whatever has been typed. The search box is contenteditable
// and belongs to NetSuite, so edits go through the browser's own editing commands.
// Those fire the same input events as typing, and only touch the prefix.
const PreviousSearchFilters = (() => {
  const INPUT = '.ns-ui-omni-box-input__element';
  const POPUP = '.ns-ui-omni-box-floating-content > .ns-ui-omni-box-popup:not(.ns-ui-omni-box-popup--mentions-list)';
  const ROW_CLASS = 'pfn-search-filters';
  const FILTERS = [
    { label: 'Case', prefix: 'case:' },
    { label: 'Customer', prefix: 'customer:' },
    { label: 'Site', prefix: 'site:' },
    { label: 'Incident', prefix: 'incident:' },
    { label: 'Sales', prefix: 'sales:' },
    { label: 'Transfer', prefix: 'transfer:' },
    { label: 'Inventory', prefix: 'inventory:' },
    { label: 'Secret', prefix: 'secret:' },
    { label: 'Contact', prefix: 'contact:' },
    { label: 'Deployed', prefix: 'deployed:' },
    { label: 'Script', prefix: 'script:' },
  ];
  const PREFIX = new RegExp(`^\\s*(${FILTERS.map(({ prefix }) => prefix).join('|')})\\s*`, 'i');

  let observer = null;
  let scheduled = false;

  function currentPrefix(input) {
    return input.textContent.match(PREFIX)?.[0] ?? '';
  }

  // The box can hold more than one text node, so offsets into its text have to be
  // turned back into a position in a node.
  function position(root, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let last = null;
    while (walker.nextNode()) {
      last = walker.currentNode;
      if (remaining <= last.length) return [last, remaining];
      remaining -= last.length;
    }
    return last ? [last, last.length] : [root, 0];
  }

  function select(root, start, end) {
    const range = document.createRange();
    range.setStart(...position(root, start));
    range.setEnd(...position(root, end));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function caretOffset(root) {
    const selection = getSelection();
    if (!selection.rangeCount || !root.contains(selection.focusNode)) return root.textContent.length;
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(selection.focusNode, selection.focusOffset);
    return range.toString().length;
  }

  function replacePrefix(input, next) {
    const current = currentPrefix(input);
    const caret = caretOffset(input);
    input.focus();
    select(input, 0, current.length);
    if (next) document.execCommand('insertText', false, next);
    else if (current) document.execCommand('delete');
    const moved = Math.max(caret - current.length, 0) + next.length;
    select(input, moved, moved);
  }

  function updateRow() {
    const row = document.querySelector(`.${ROW_CLASS}`);
    const input = document.querySelector(INPUT);
    if (!row || !input) return;
    const active = currentPrefix(input).trim().toLowerCase();
    row.querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.pfnPrefix === active));
    });
  }

  function onFilterClick(event) {
    const button = event.target.closest('button');
    const input = document.querySelector(INPUT);
    if (!button || !input) return;
    const { pfnPrefix: prefix } = button.dataset;
    const active = currentPrefix(input).trim().toLowerCase() === prefix;
    replacePrefix(input, active ? '' : `${prefix} `);
    updateRow();
  }

  function createRow() {
    const row = document.createElement('div');
    row.className = ROW_CLASS;
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Filter search by record type');
    for (const { label, prefix } of FILTERS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.tabIndex = -1;
      button.textContent = label;
      button.dataset.pfnPrefix = prefix;
      row.append(button);
    }
    // Pressing a button would otherwise blur the box, which closes the popup.
    row.addEventListener('mousedown', (event) => event.preventDefault());
    row.addEventListener('click', onFilterClick);
    return row;
  }

  function sync() {
    scheduled = false;
    if (!observer) return;
    const popup = document.querySelector(POPUP);
    if (!popup || popup.querySelector(`:scope > .${ROW_CLASS}`)) return;
    document.querySelector(`.${ROW_CLASS}`)?.remove();
    popup.prepend(createRow());
    updateRow();
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
      document.addEventListener('input', updateRow, true);
      schedule();
    },

    disable() {
      if (!observer) return;
      observer.disconnect();
      observer = null;
      document.removeEventListener('input', updateRow, true);
      document.querySelector(`.${ROW_CLASS}`)?.remove();
    },
  };
})();
