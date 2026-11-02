// Shared by the content scripts and the popup.
const PreviousSettings = {
  isMac: /Mac/.test(navigator.platform),

  DEFAULTS: {
    dark: 'off', // off | grey | navy | black | custom
    font: 'default',
    barTop: true,
    classicBar: true,
    logoInBar: true,
    profileRight: true,
    centerSearch: true,
    searchShortcut: true,
    searchFilters: true,
    actionsLeft: true,
    hideAi: true,
    hideGlImpact: true,
    hideStripe: false,
    copyLinkButton: true,
    bottomActions: true,
    classicDividers: true,
    custom: {
      page: '#101923',
      surface: '#172431',
      bar: '#0b131b',
      accent: '#3f9bd1',
      divider: '#2c4560',
      dividerText: '#e3ecf5',
      border: '#334a60',
      text: '#e3e9ef',
      heading: '#ffffff',
      link: '#7cc4e8',
      menu: '#500000',
      menuText: '#ffffff',
    },
  },

  // The custom theme's colors, in the order the popup lists them. Each one is
  // applied as --pfn-<key>, with the rest of the palette mixed from these.
  CUSTOM_COLORS: [
    { key: 'page', label: 'Page background' },
    { key: 'surface', label: 'Panel background' },
    { key: 'bar', label: 'Main bar' },
    { key: 'accent', label: 'Accent' },
    { key: 'divider', label: 'Dividers' },
    { key: 'dividerText', label: 'Divider text' },
    { key: 'border', label: 'Borders' },
    { key: 'text', label: 'Regular text' },
    { key: 'heading', label: 'Header text' },
    { key: 'link', label: 'Link text' },
    { key: 'menu', label: 'Menu' },
    { key: 'menuText', label: 'Menu text' },
  ],

  // Bundled fonts are declared with @font-face in content.css and popup.css.
  // The rest depend on what the computer has, so each one falls back.
  FONTS: {
    default: { label: 'NetSuite default', stack: null },
    system: { label: 'System font', stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    inter: { label: 'Inter', stack: '"PFN Inter", sans-serif' },
    roboto: { label: 'Roboto', stack: '"PFN Roboto", sans-serif' },
    plex: { label: 'IBM Plex Sans', stack: '"PFN IBM Plex Sans", sans-serif' },
    source: { label: 'Source Sans 3', stack: '"PFN Source Sans 3", sans-serif' },
    arial: { label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
    avenir: { label: 'Avenir Next', stack: '"Avenir Next", Avenir, "Segoe UI", sans-serif' },
    calibri: { label: 'Calibri', stack: 'Calibri, Carlito, sans-serif' },
    comic: { label: 'Comic Sans MS', stack: '"Comic Sans MS", "Comic Sans", cursive' },
    futura: { label: 'Futura', stack: 'Futura, "Century Gothic", sans-serif' },
    gill: { label: 'Gill Sans', stack: '"Gill Sans", "Gill Sans MT", sans-serif' },
    helvetica: { label: 'Helvetica Neue', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
    optima: { label: 'Optima', stack: 'Optima, Candara, sans-serif' },
    segoe: { label: 'Segoe UI', stack: '"Segoe UI", Tahoma, sans-serif' },
    tahoma: { label: 'Tahoma', stack: 'Tahoma, Geneva, sans-serif' },
    trebuchet: { label: 'Trebuchet MS', stack: '"Trebuchet MS", Helvetica, sans-serif' },
    verdana: { label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
    baskerville: { label: 'Baskerville', stack: 'Baskerville, "Baskerville Old Face", Georgia, serif' },
    cambria: { label: 'Cambria', stack: 'Cambria, Georgia, serif' },
    garamond: { label: 'Garamond', stack: 'Garamond, "Apple Garamond", Georgia, serif' },
    georgia: { label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
    palatino: { label: 'Palatino', stack: 'Palatino, "Palatino Linotype", Georgia, serif' },
    times: { label: 'Times New Roman', stack: '"Times New Roman", Times, serif' },
    consolas: { label: 'Consolas', stack: 'Consolas, Menlo, monospace' },
    courier: { label: 'Courier New', stack: '"Courier New", Courier, monospace' },
    menlo: { label: 'Menlo', stack: 'Menlo, Consolas, monospace' },
  },

  fontStack(settings) {
    return this.FONTS[settings.font]?.stack ?? null;
  },

  // A saved custom theme replaces the default object, so colors added in later
  // versions have to be filled back in.
  async load() {
    const settings = await chrome.storage.sync.get(this.DEFAULTS);
    return { ...settings, custom: { ...this.DEFAULTS.custom, ...settings.custom } };
  },

  customProperty(key) {
    return `--pfn-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  },

  isLightColor(hex) {
    const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
  },

  // The filter that turns the menu's blue swirl image (hue about 202) toward a
  // color. Greys get no hue to turn to, so the swirl loses its color instead.
  menuFilter(hex) {
    const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const chroma = max - Math.min(r, g, b);
    if (chroma < 0.08) return 'grayscale(1)';
    let hue;
    if (max === r) hue = ((g - b) / chroma + 6) % 6;
    else if (max === g) hue = (b - r) / chroma + 2;
    else hue = (r - g) / chroma + 4;
    return `hue-rotate(${Math.round((hue * 60 - 202 + 360) % 360)}deg)`;
  },
};
