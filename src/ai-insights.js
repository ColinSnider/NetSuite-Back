// Removes AI Insights, and GL Impact when that's turned off too, from the side
// rail on record pages. The rail is an oj-tab-bar with little stable to select
// on, so its items are matched by what they contain. The rail goes too when
// nothing is left in it, so no empty strip is left.
const PreviousAiInsights = (() => {
  const INSIGHT = /insight/i;
  const GL_IMPACT = /gl.?impact/i;
  const DRAWER = '.ns-ui-toolkit-tab-drawer';
  const TAB = '.tab-drawer__tab-bar .oj-tabbar-item-element';
  const OPEN_PANEL = '.ns-ui-toolkit-narrative-insights-drawer-content-drawer';
  const HEADER_BUTTON = '.ns-ui-toolkit-header-actions button';
  const TAB_MARK = 'data-pfn-ai-tab';
  const GL_MARK = 'data-pfn-gl-tab';
  const EMPTY_MARK = 'data-pfn-rail-empty';
  const BUTTON_MARK = 'data-pfn-ai-button';

  let observer = null;
  let scheduled = false;

  function isInsightTab(tab, drawer) {
    if (INSIGHT.test(tab.outerHTML)) return true;
    return tab.classList.contains('oj-selected') && Boolean(drawer.querySelector(OPEN_PANEL));
  }

  function syncDrawer(drawer) {
    const root = document.documentElement;
    const hideAi = root.hasAttribute('data-pfn-hide-ai');
    const hideGl = root.hasAttribute('data-pfn-hide-gl');
    const tabs = [...drawer.querySelectorAll(TAB)];
    let hidden = 0;
    for (const tab of tabs) {
      const isInsight = isInsightTab(tab, drawer);
      const isGl = GL_IMPACT.test(tab.id) || GL_IMPACT.test(tab.textContent);
      tab.toggleAttribute(TAB_MARK, isInsight);
      tab.toggleAttribute(GL_MARK, isGl);
      if ((hideAi && isInsight) || (hideGl && isGl)) hidden += 1;
    }
    drawer.toggleAttribute(EMPTY_MARK, hidden > 0 && hidden === tabs.length);
  }

  function sync() {
    scheduled = false;
    if (!observer) return;
    document.querySelectorAll(DRAWER).forEach(syncDrawer);
    document.querySelectorAll(HEADER_BUTTON).forEach((button) => {
      const isInsight = INSIGHT.test(button.getAttribute('aria-label') ?? button.textContent);
      button.parentElement.toggleAttribute(BUTTON_MARK, isInsight);
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  return {
    // Called again when the settings change, since whether the rail is empty
    // depends on which tabs are turned off.
    enable() {
      if (!observer) {
        observer = new MutationObserver(schedule);
        observer.observe(document, { subtree: true, childList: true });
      }
      schedule();
    },

    disable() {
      if (!observer) return;
      observer.disconnect();
      observer = null;
      for (const mark of [TAB_MARK, GL_MARK, EMPTY_MARK, BUTTON_MARK]) {
        document.querySelectorAll(`[${mark}]`).forEach((el) => el.removeAttribute(mark));
      }
    },
  };
})();
