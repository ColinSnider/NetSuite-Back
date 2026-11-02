(() => {
  const CACHE_KEY = 'previous-for-netsuite';

  // Every frame shares the /next top window, so this also covers the classic
  // iframes and leaves the regular Redwood experience alone.
  function isNetSuiteNext() {
    try {
      const { pathname } = window.top.location;
      return pathname === '/next' || pathname.startsWith('/next/');
    } catch {
      return false;
    }
  }

  if (!isNetSuiteNext()) return;

  const root = document.documentElement;
  const isTop = window === window.top;
  root.toggleAttribute('data-pfn-frame', !isTop);

  function applyCustomTheme(settings) {
    const active = settings.dark === 'custom';
    for (const { key } of PreviousSettings.CUSTOM_COLORS) {
      const property = PreviousSettings.customProperty(key);
      if (active) root.style.setProperty(property, settings.custom[key]);
      else root.style.removeProperty(property);
    }
    if (active) root.style.setProperty('--pfn-menu-filter', PreviousSettings.menuFilter(settings.custom.menu));
    else root.style.removeProperty('--pfn-menu-filter');
    root.toggleAttribute(
      'data-pfn-custom-light',
      active && PreviousSettings.isLightColor(settings.custom.surface),
    );
    root.toggleAttribute(
      'data-pfn-accent-light',
      active && PreviousSettings.isLightColor(settings.custom.accent),
    );
  }

  function apply(settings) {
    root.toggleAttribute('data-pfn-bar-top', settings.barTop);
    root.toggleAttribute('data-pfn-classic-bar', settings.classicBar);
    root.toggleAttribute('data-pfn-logo-bar', settings.logoInBar);
    root.toggleAttribute('data-pfn-profile-right', settings.profileRight);
    root.toggleAttribute('data-pfn-center-search', settings.centerSearch);
    root.toggleAttribute('data-pfn-search-filters', settings.searchFilters);
    root.toggleAttribute('data-pfn-actions-left', settings.actionsLeft);
    root.toggleAttribute('data-pfn-hide-ai', settings.hideAi);
    root.toggleAttribute('data-pfn-hide-gl', settings.hideGlImpact);
    root.toggleAttribute('data-pfn-hide-stripe', settings.hideStripe);
    root.toggleAttribute('data-pfn-dividers', settings.classicDividers);

    const stack = PreviousSettings.fontStack(settings);
    root.toggleAttribute('data-pfn-font', Boolean(stack));
    if (stack) root.style.setProperty('--pfn-font', stack);
    else root.style.removeProperty('--pfn-font');

    const dark = settings.dark !== 'off';
    if (dark) root.setAttribute('data-pfn-dark', settings.dark);
    else root.removeAttribute('data-pfn-dark');
    applyCustomTheme(settings);

    const theme = isTop ? PreviousShellDark : PreviousRecolor;
    if (dark) theme.enable();
    else theme.disable();

    if (settings.searchShortcut) PreviousSearchShortcut.enable();
    else PreviousSearchShortcut.disable();

    if (isTop && settings.searchFilters) PreviousSearchFilters.enable();
    else PreviousSearchFilters.disable();

    if (isTop && settings.logoInBar) PreviousBarLogo.enable();
    else PreviousBarLogo.disable();

    if (isTop && (settings.hideAi || settings.hideGlImpact)) PreviousAiInsights.enable();
    else PreviousAiInsights.disable();

    if (isTop && settings.actionsLeft) PreviousPrimaryActions.enable();
    else PreviousPrimaryActions.disable();

    if (isTop && settings.copyLinkButton) PreviousCopyLink.enable();
    else PreviousCopyLink.disable();

    if (isTop && settings.bottomActions) PreviousBottomActions.enable();
    else PreviousBottomActions.disable();
  }

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY));
    } catch {
      return null;
    }
  }

  function writeCache(settings) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be unavailable; the cache only prevents a flash on load.
    }
  }

  // storage.sync is async, so apply the last known settings synchronously
  // first. That avoids a flash of the light theme on every frame load.
  // A cache from an older version can be missing custom colors added since.
  const cached = readCache();
  if (cached) {
    const { DEFAULTS } = PreviousSettings;
    apply({ ...DEFAULTS, ...cached, custom: { ...DEFAULTS.custom, ...cached.custom } });
  }

  async function refresh() {
    const settings = await PreviousSettings.load();
    writeCache(settings);
    apply(settings);
  }

  refresh();
  chrome.storage.onChanged.addListener(refresh);
})();
