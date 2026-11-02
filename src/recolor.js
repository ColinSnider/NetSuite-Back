// Classic iframes and custom Suitelets hard-code their colors, so there are no
// tokens to override. This reads each element's computed colors and tags it
// with a generated rule. Rules only reference the --pfn-* palette variables,
// so switching between dark palettes needs no rework here.
const PreviousRecolor = (() => {
  const ATTRS = [
    'data-pfn-bg',
    'data-pfn-fg',
    'data-pfn-fl',
    'data-pfn-sk',
    'data-pfn-bd',
    'data-pfn-ink',
    'data-pfn-brand-bd',
    'data-pfn-noimg',
    'data-pfn-invert',
    'data-pfn-brand',
  ];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'TITLE', 'NOSCRIPT', 'BR']);
  const BATCH_SIZE = 4000;
  const REPROCESS_LIMIT = 300;
  const COLOR_PROPERTY = /color|background|border/i;
  const STATE_SELECTOR = /:(hover|focus|focus-within|active)\b/;
  const SELECTOR_SEPARATOR = /,(?![^(]*\))/;
  // NetSuite's own icons are near-black SVGs drawn as images and backgrounds,
  // checkboxes included, so they can only be flipped with a filter.
  const ICON_URL = /\/(uiredwood|uirefresh)\/[^)"']*\.svg/;
  const LOADER_URL = /(loading|spinner|busy)[^/]*\.gif/i;
  const PSEUDO_ELEMENT = /::?(before|after)\b/;
  const INVERT = 'html[data-pfn-dark]:not([data-pfn-custom-light])';
  const SIDES = [
    ['t', 'Top'],
    ['r', 'Right'],
    ['b', 'Bottom'],
    ['l', 'Left'],
  ];

  const sheet = new CSSStyleSheet();
  const ruleIds = new Map();
  const colors = new Map();

  let observer = null;
  let scheduled = false;
  let pending = new Set();
  let stale = new Set();
  let surroundings = new WeakMap();
  let scannedSheets = new WeakSet();

  function ruleId(kind, property, value) {
    const key = `${kind}|${value}`;
    if (!ruleIds.has(key)) {
      const id = ruleIds.size.toString(36);
      ruleIds.set(key, id);
      sheet.insertRule(
        `html[data-pfn-dark] [data-pfn-${kind}="${id}"]{${property}:${value}!important}`,
        sheet.cssRules.length,
      );
    }
    return ruleIds.get(key);
  }

  function parse(value) {
    if (colors.has(value)) return colors.get(value);
    const match = value.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?/);
    let color = null;
    if (match) {
      const [r, g, b] = [match[1], match[2], match[3]].map((c) => Number(c) / 255);
      const alpha = match[4] === undefined ? 1 : Number(match[4]);
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
        h *= 60;
      }
      const luma = 0.2126 * r ** 2.2 + 0.7152 * g ** 2.2 + 0.0722 * b ** 2.2;
      color = { h, s, l, chroma, alpha, luma };
    }
    colors.set(value, color);
    return color;
  }

  function withAlpha(css, alpha) {
    if (alpha >= 1) return css;
    return `color-mix(in srgb, ${css} ${Math.round(alpha * 100)}%, transparent)`;
  }

  function isLightSurface(color) {
    return color.l >= 0.8;
  }

  // Chroma, not saturation: HSL saturation is huge on warm near-whites. Pale
  // blue-greys are only the light theme's idea of grey, so they count too.
  function isNeutral(color) {
    return color.chroma < 0.06 || (color.chroma < 0.12 && color.h >= 190 && color.h <= 240);
  }

  // NetSuite's teal, on primary buttons and toggles.
  function isBrand(color) {
    return color.chroma > 0.25 && color.h >= 188 && color.h <= 210 && color.l >= 0.25 && color.l <= 0.5;
  }

  function background(color) {
    let css;
    if (isNeutral(color)) {
      if (color.l >= 0.97) css = 'var(--pfn-surface)';
      else if (color.l >= 0.9) css = 'var(--pfn-raised)';
      else css = 'var(--pfn-raised-2)';
    } else {
      // Pastel status colors keep their hue so red rows still read as red.
      const hue = Math.round(color.h);
      css = `color-mix(in srgb, hsl(${hue} 70% 45%) 24%, var(--pfn-surface))`;
    }
    return withAlpha(css, color.alpha);
  }

  function foreground(color, isLink) {
    if (color.luma >= 0.3) return null;
    let css;
    if (color.s < 0.25) css = color.l < 0.3 ? 'var(--pfn-text)' : 'var(--pfn-muted)';
    else if (isLink) css = 'var(--pfn-link)';
    else css = `hsl(${Math.round(color.h)} ${Math.round(Math.max(color.s, 0.6) * 100)}% var(--pfn-tint))`;
    return withAlpha(css, color.alpha < 0.5 ? 0.5 : color.alpha);
  }

  function gradientIsLight(image) {
    const stops = image.match(/rgba?\([^)]*\)/g);
    return Boolean(stops) && stops.every((stop) => {
      const color = parse(stop);
      return color && (color.alpha < 0.05 || isLightSurface(color));
    });
  }

  // Reads only, so a whole batch shares a single style recalculation. Existing
  // tags are kept: the computed color of a tagged element is already ours.
  function read(el) {
    const style = getComputedStyle(el);
    const result = {
      el,
      bg: null,
      fg: null,
      fl: null,
      sk: null,
      bd: null,
      ink: null,
      brandBd: null,
      noImg: false,
      invert: false,
      brand: false,
    };
    let surrounding = surroundings.get(el.parentElement) ?? 'dark';

    if (el.hasAttribute('data-pfn-bg')) {
      surrounding = 'dark';
    } else {
      const image = style.backgroundImage;
      const hasGradient = image.includes('gradient');
      const bg = parse(style.backgroundColor);

      if (hasGradient && gradientIsLight(image)) {
        result.noImg = true;
        result.bg = 'var(--pfn-raised)';
        surrounding = 'dark';
      } else if (hasGradient) {
        surrounding = 'keep';
      } else if (bg && bg.alpha >= 0.05) {
        if (isLightSurface(bg)) {
          result.bg = background(bg);
          surrounding = 'dark';
        } else if (bg.alpha >= 0.5) {
          surrounding = bg.luma < 0.4 ? 'dark' : 'keep';
          result.brand = isBrand(bg);
        }
      }
    }
    surroundings.set(el, surrounding);

    if (surrounding === 'dark' && !el.hasAttribute('data-pfn-fg')) {
      const fg = parse(style.color);
      if (fg) result.fg = foreground(fg, el.tagName === 'A' || Boolean(el.closest('a')));
    }

    // Sprite icons and spinners take their fill and stroke from CSS. Colored
    // ones, like map pins, stay.
    if (surrounding === 'dark' && el instanceof SVGElement) {
      const fill = !el.hasAttribute('data-pfn-fl') && parse(style.fill);
      if (fill && fill.s < 0.25) result.fl = foreground(fill);
      const stroke = !el.hasAttribute('data-pfn-sk') && parse(style.stroke);
      if (stroke && stroke.s < 0.25) result.sk = foreground(stroke);
    }

    // A filter would flip text too, so only empty elements count as icons.
    result.invert = el.tagName === 'IMG'
      ? ICON_URL.test(el.getAttribute('src') ?? '') || LOADER_URL.test(el.getAttribute('src') ?? '')
      : ICON_URL.test(style.backgroundImage) && !el.textContent.trim();

    // A spinning border's dark arc turns light, so it still shows against its
    // track once that turns dark.
    if (!el.hasAttribute('data-pfn-bd') && !el.hasAttribute('data-pfn-ink') && !el.hasAttribute('data-pfn-brand-bd')) {
      const spins = style.animationName !== 'none';
      const sides = [];
      const ink = [];
      const brand = [];
      for (const [letter, name] of SIDES) {
        if (parseFloat(style[`border${name}Width`]) === 0) continue;
        const border = parse(style[`border${name}Color`]);
        if (!border || border.alpha === 0) continue;
        const isDark = border.s < 0.2 && border.l < 0.3;
        if (spins && isDark) ink.push(letter);
        else if (border.l >= 0.7 || isDark) sides.push(letter);
        else if (isBrand(border)) brand.push(letter);
      }
      if (sides.length) result.bd = sides.join(' ');
      if (ink.length) result.ink = ink.join(' ');
      if (brand.length) result.brandBd = brand.join(' ');
    }
    return result;
  }

  function write({ el, bg, fg, fl, sk, bd, ink, brandBd, noImg, invert, brand }) {
    if (bg) el.setAttribute('data-pfn-bg', ruleId('bg', 'background-color', bg));
    if (fg) el.setAttribute('data-pfn-fg', ruleId('fg', 'color', fg));
    if (fl) el.setAttribute('data-pfn-fl', ruleId('fl', 'fill', fl));
    if (sk) el.setAttribute('data-pfn-sk', ruleId('sk', 'stroke', sk));
    if (bd) el.setAttribute('data-pfn-bd', bd);
    if (ink) el.setAttribute('data-pfn-ink', ink);
    if (brandBd) el.setAttribute('data-pfn-brand-bd', brandBd);
    if (noImg) el.setAttribute('data-pfn-noimg', '');
    if (invert) el.setAttribute('data-pfn-invert', '');
    if (brand) el.setAttribute('data-pfn-brand', '');
  }

  function flush() {
    scheduled = false;
    if (!observer) return;

    const batch = [];
    for (const el of pending) {
      pending.delete(el);
      if (el.isConnected) batch.push(el);
      if (batch.length === BATCH_SIZE) break;
    }

    // Tags come off here, not when the change is noticed, so that no frame can
    // paint between clearing an element and tagging it again.
    for (const el of batch) {
      if (stale.delete(el)) clear(el);
    }
    batch.map(read).forEach(write);
    if (pending.size) schedule();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flush);
  }

  function enqueue(el) {
    if (!SKIP.has(el.tagName) && !el.closest('svg')?.parentElement?.closest('svg')) pending.add(el);
  }

  function enqueueTree(el) {
    enqueue(el);
    el.querySelectorAll('*').forEach(enqueue);
  }

  function markStale(el) {
    stale.add(el);
    enqueue(el);
  }

  function reprocess(el) {
    markStale(el);
    const descendants = el.querySelectorAll('*');
    if (descendants.length <= REPROCESS_LIMIT) descendants.forEach(markStale);
  }

  // NetSuite moves its floating list headers by rewriting their style on every
  // scroll, so a style change only counts if it touched a color.
  function colorDeclarations(style) {
    return (style ?? '').split(';').filter((part) => COLOR_PROPERTY.test(part)).join(';');
  }

  function changedColors(mutation) {
    const { target, attributeName, oldValue } = mutation;
    const value = target.getAttribute(attributeName);
    if (value === oldValue) return false;
    return attributeName !== 'style' || colorDeclarations(value) !== colorDeclarations(oldValue);
  }

  function clear(el) {
    for (const attr of ATTRS) el.removeAttribute(attr);
  }

  // CSS custom properties only resolve through the computed style, and the
  // style object normalizes hex and named colors into the rgb() parse() reads.
  function resolveColor(value) {
    if (!value) return null;
    const name = value.match(/^var\((--[\w-]+)/)?.[1];
    const resolved = name ? getComputedStyle(document.documentElement).getPropertyValue(name) : value;
    const probe = new Option().style;
    probe.color = resolved.trim();
    return parse(probe.color);
  }

  // Hover and focus states never show up in a computed style read, so they have
  // to be found in the stylesheets themselves.
  function stateDeclarations(style) {
    const declarations = [];
    const bg = resolveColor(style.backgroundColor);
    if (bg && bg.alpha >= 0.05) {
      if (isLightSurface(bg)) {
        const hover = isNeutral(bg) ? 'var(--pfn-hover)' : background(bg);
        declarations.push(`background-color:${hover}!important`);
      } else if (bg.alpha < 0.5 && bg.l < 0.3) {
        declarations.push('background-color:var(--pfn-hover)!important');
      }
    }
    const fg = resolveColor(style.color);
    const fgCss = fg && foreground(fg);
    if (fgCss) declarations.push(`color:${fgCss}!important`);
    const border = resolveColor(style.borderTopColor);
    if (border && border.l >= 0.7) declarations.push('border-color:var(--pfn-border)!important');
    return declarations;
  }

  // Icons on pseudo-elements, like the checkboxes, are out of reach of the
  // element tags, so their rules get a filtered copy.
  function scanIconRule(rule) {
    if (!ICON_URL.test(rule.style.backgroundImage)) return;
    const selectors = rule.selectorText
      .split(SELECTOR_SEPARATOR)
      .filter((selector) => PSEUDO_ELEMENT.test(selector));
    if (!selectors.length) return;
    try {
      sheet.insertRule(
        `${selectors.map((selector) => `${INVERT} ${selector.trim()}`).join(',')}{filter:invert(1) hue-rotate(180deg)!important}`,
        sheet.cssRules.length,
      );
    } catch {
      // A selector this can't prefix just keeps its original icon.
    }
  }

  function scanRules(rules) {
    for (const rule of rules) {
      if (rule.cssRules?.length) scanRules(rule.cssRules);
      if (!rule.selectorText) continue;
      scanIconRule(rule);
      if (!STATE_SELECTOR.test(rule.selectorText)) continue;
      const declarations = stateDeclarations(rule.style);
      if (!declarations.length) continue;
      // A list can mix in selectors with no state, which would then always match.
      const selectors = rule.selectorText
        .split(SELECTOR_SEPARATOR)
        .filter((selector) => STATE_SELECTOR.test(selector));
      try {
        sheet.insertRule(
          `html[data-pfn-dark] :is(${selectors.join(',')}){${declarations.join(';')}}`,
          sheet.cssRules.length,
        );
      } catch {
        // Selectors :is() can't hold, such as pseudo-elements, are safe to skip.
      }
    }
  }

  function scanStateRules() {
    for (const styleSheet of document.styleSheets) {
      if (scannedSheets.has(styleSheet)) continue;
      scannedSheets.add(styleSheet);
      try {
        scanRules(styleSheet.cssRules);
      } catch {
        // Cross-origin stylesheets can't be read.
      }
    }
  }

  function rescan() {
    scanStateRules();
    enqueueTree(document.documentElement);
    schedule();
  }

  function onMutations(mutations) {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        if (changedColors(m)) reprocess(m.target);
      } else {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          enqueueTree(node);
          if (node.tagName === 'STYLE') rescan();
        });
      }
    }
    schedule();
  }

  // Elements can be read before their stylesheet arrives, when they still look
  // transparent, so go over the page again whenever one finishes loading.
  function onResourceLoad(event) {
    if (event.target === window || event.target.tagName === 'LINK') rescan();
  }

  return {
    enable() {
      if (observer) return;
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      observer = new MutationObserver(onMutations);
      observer.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['class', 'style'],
      });
      window.addEventListener('load', onResourceLoad, true);
      scanStateRules();
      enqueueTree(document.documentElement);
      flush();
    },

    disable() {
      if (!observer) return;
      observer.disconnect();
      observer = null;
      window.removeEventListener('load', onResourceLoad, true);
      pending = new Set();
      stale = new Set();
      surroundings = new WeakMap();
      scannedSheets = new WeakSet();
      while (sheet.cssRules.length) sheet.deleteRule(0);
      ruleIds.clear();
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
      document.querySelectorAll(ATTRS.map((attr) => `[${attr}]`).join(',')).forEach(clear);
    },
  };
})();
