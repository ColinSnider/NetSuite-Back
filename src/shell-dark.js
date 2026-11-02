// The NetSuite Next shell already ships a full dark theme, it just never turns
// it on. Swapping the scheme classes enables it, and content.css tints it.
const PreviousShellDark = (() => {
  const SWAPS = [
    ['oj-c-colorscheme-light', 'oj-c-colorscheme-dark'],
    ['ns-ui-toolkit-theme-mode-light', 'ns-ui-toolkit-theme-mode-dark'],
    ['oj-sp-theme-global-mode-light', 'oj-sp-theme-global-mode-dark'],
    ['oj-color-standard', 'oj-color-invert'],
  ];
  const ROOT_CLASSES = ['oj-c-colorscheme-dark', 'ns-ui-toolkit-theme-mode-dark', 'oj-color-invert'];
  const LIGHT_SELECTOR = SWAPS.map(([light]) => `.${light}`).join(',');
  const SWAPPED = 'data-pfn-swapped';

  let observer = null;

  function swap(el) {
    SWAPS.forEach(([light, dark], index) => {
      if (!el.classList.contains(light)) return;
      el.classList.replace(light, dark);
      const swapped = el.getAttribute(SWAPPED);
      el.setAttribute(SWAPPED, swapped ? `${swapped} ${index}` : index);
    });
  }

  function swapTree(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    swap(node);
    node.querySelectorAll(LIGHT_SELECTOR).forEach(swap);
  }

  function restoreAll() {
    document.querySelectorAll(`[${SWAPPED}]`).forEach((el) => {
      for (const index of el.getAttribute(SWAPPED).split(' ')) {
        const [light, dark] = SWAPS[index];
        el.classList.replace(dark, light);
      }
      el.removeAttribute(SWAPPED);
    });
  }

  return {
    enable() {
      if (observer) return;
      document.documentElement.classList.add(...ROOT_CLASSES);
      swapTree(document.documentElement);
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes') swap(m.target);
          else m.addedNodes.forEach(swapTree);
        }
      });
      observer.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class'],
      });
    },

    disable() {
      if (!observer) return;
      observer.disconnect();
      observer = null;
      document.documentElement.classList.remove(...ROOT_CLASSES);
      restoreAll();
    },
  };
})();
