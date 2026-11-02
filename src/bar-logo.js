// Puts the company logo in the main bar. NetSuite only draws it in the home page
// header, so it's remembered from there to show on every other page.
const PreviousBarLogo = (() => {
  const STORAGE_KEY = 'previous-for-netsuite-logo';
  const BAR = '.ns-ui-omni-box-bottom-bar';
  const HEADER_LOGO = '.ns-ui-header-logo-container img';
  const LOGO_CLASS = 'pfn-bar-logo';

  let observer = null;
  let scheduled = false;

  function remembered() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function remember(logo) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logo));
    } catch {
      // Storage can be unavailable; the logo just stays on the home page's bar.
    }
  }

  function forget() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing was stored in that case.
    }
  }

  function currentLogo() {
    const header = document.querySelector(HEADER_LOGO);
    if (!header?.src) return remembered();
    const logo = { src: header.src, alt: header.alt };
    if (logo.src !== remembered()?.src) remember(logo);
    return logo;
  }

  // A remembered address can go stale when the logo is replaced.
  function onError(event) {
    event.target.hidden = true;
    forget();
  }

  function sync() {
    scheduled = false;
    if (!observer) return;
    const bar = document.querySelector(BAR);
    const logo = currentLogo();
    if (!bar || !logo) return;
    let image = bar.querySelector(`:scope > .${LOGO_CLASS}`);
    if (!image) {
      image = document.createElement('img');
      image.className = LOGO_CLASS;
      image.addEventListener('error', onError);
      bar.prepend(image);
    }
    if (image.src === logo.src) return;
    image.hidden = false;
    image.alt = logo.alt;
    image.src = logo.src;
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
      document.querySelector(`.${LOGO_CLASS}`)?.remove();
    },
  };
})();
