(async () => {
  const { DEFAULTS, FONTS, CUSTOM_COLORS } = PreviousSettings;
  const TOGGLES = [
    'barTop',
    'classicBar',
    'logoInBar',
    'profileRight',
    'centerSearch',
    'searchShortcut',
    'searchFilters',
    'hideAi',
    'hideStripe',
    'hideGlImpact',
    'actionsLeft',
    'bottomActions',
    'classicDividers',
    'copyLinkButton',
  ];
  const HEX = /^#[0-9a-f]{6}$/i;

  const font = document.getElementById('font');
  const mainView = document.getElementById('main-view');
  const customView = document.getElementById('custom-view');
  const colors = document.getElementById('colors');
  const customMock = document.querySelector('[data-palette="custom"]');

  let custom = DEFAULTS.custom;
  let open = null;

  for (const [value, { label }] of Object.entries(FONTS)) {
    font.add(new Option(label, value));
  }

  document.getElementById('shortcut-label').textContent =
    `Focus search with ${PreviousSettings.isMac ? '⌘K' : 'Alt+K'}`;

  const save = (change) => chrome.storage.sync.set(change);

  function hexToHsl(hex) {
    const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const l = (max + min) / 2;
    const s = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (chroma) {
      if (max === r) h = ((g - b) / chroma + 6) % 6;
      else if (max === g) h = (b - r) / chroma + 2;
      else h = (r - g) / chroma + 4;
    }
    return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToHex({ h, s, l }) {
    const amount = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const channel = (n) => {
      const k = (n + h / 30) % 12;
      const value = l / 100 - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(value * 255).toString(16).padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
  }

  // An action popup closes when it loses focus, which a native color dialog can
  // cause, so the picker is drawn here instead of using <input type="color">.
  function createSlider(label, max, value, onInput, onChange) {
    const wrapper = document.createElement('label');
    wrapper.className = 'slider';
    const name = document.createElement('span');
    name.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.max = max;
    input.value = value;
    input.addEventListener('input', () => onInput(Number(input.value)));
    input.addEventListener('change', onChange);
    wrapper.append(name, input);
    return wrapper;
  }

  function saveCustom() {
    save({ custom });
  }

  function createPicker(key, row) {
    const picker = document.createElement('div');
    picker.className = 'picker';
    const hsl = hexToHsl(custom[key]);
    const channel = (name) => (value) => {
      hsl[name] = value;
      custom = { ...custom, [key]: hslToHex(hsl) };
      paintRow(row, custom[key]);
    };
    picker.append(
      createSlider('Hue', 360, hsl.h, channel('h'), saveCustom),
      createSlider('Saturation', 100, hsl.s, channel('s'), saveCustom),
      createSlider('Lightness', 100, hsl.l, channel('l'), saveCustom),
    );
    return picker;
  }

  function paintRow(row, value) {
    row.querySelector('.swatch').style.background = value;
    row.querySelector('.hex').value = value;
  }

  function togglePicker(key) {
    open = open === key ? null : key;
    renderColors();
  }

  function createColorRow({ key, label }) {
    const row = document.createElement('div');
    row.className = 'color-row';

    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.setAttribute('aria-label', `Pick ${label.toLowerCase()} color`);
    swatch.setAttribute('aria-expanded', String(open === key));
    swatch.addEventListener('click', () => togglePicker(key));

    const name = document.createElement('span');
    name.textContent = label;

    const hex = document.createElement('input');
    hex.className = 'hex';
    hex.spellcheck = false;
    hex.maxLength = 7;
    hex.setAttribute('aria-label', `${label} hex color`);
    hex.addEventListener('focus', () => hex.select());
    hex.addEventListener('change', () => {
      if (!HEX.test(hex.value)) {
        hex.value = custom[key];
        return;
      }
      custom = { ...custom, [key]: hex.value.toLowerCase() };
      saveCustom();
    });

    row.append(swatch, name, hex);
    paintRow(row, custom[key]);
    return row;
  }

  function renderColors() {
    colors.replaceChildren();
    for (const color of CUSTOM_COLORS) {
      const row = createColorRow(color);
      colors.append(row);
      if (open === color.key) colors.append(createPicker(color.key, row));
    }
  }

  function showCustomView(visible) {
    mainView.hidden = visible;
    customView.hidden = !visible;
    if (visible) renderColors();
  }

  function render(settings) {
    custom = settings.custom;
    document.querySelector(`input[name="dark"][value="${settings.dark}"]`).checked = true;
    font.value = settings.font;
    for (const id of TOGGLES) document.getElementById(id).checked = settings[id];
    customMock.style.setProperty('--mock-page', custom.page);
    customMock.style.setProperty('--mock-card', custom.surface);
    customMock.style.setProperty('--mock-bar', custom.bar);
    // Rebuilding would drop a slider out from under the pointer.
    if (!customView.hidden && !customView.contains(document.activeElement)) renderColors();
  }

  for (const radio of document.querySelectorAll('input[name="dark"]')) {
    radio.addEventListener('change', () => save({ dark: radio.value }));
  }

  // A click rather than change, so that the custom card still opens its colors
  // when it's already the selected theme.
  document.querySelector('input[value="custom"]').addEventListener('click', () => showCustomView(true));
  document.getElementById('back').addEventListener('click', () => showCustomView(false));

  font.addEventListener('change', () => save({ font: font.value }));

  for (const id of TOGGLES) {
    const toggle = document.getElementById(id);
    toggle.addEventListener('change', () => save({ [id]: toggle.checked }));
  }

  // Custom colors take a while to pick, so resetting settings leaves them alone.
  document.getElementById('reset').addEventListener('click', () => {
    const { custom: _, ...settings } = DEFAULTS;
    save(settings);
  });

  document.getElementById('reset-colors').addEventListener('click', () => {
    open = null;
    custom = DEFAULTS.custom;
    save({ custom });
    renderColors();
  });

  chrome.storage.onChanged.addListener(async () => render(await PreviousSettings.load()));
  render(await PreviousSettings.load());
})();
