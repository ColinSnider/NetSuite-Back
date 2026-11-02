// Runs in every frame because focus is often inside a classic iframe, where the
// main bar's own key handling can't see the shortcut.
const PreviousSearchShortcut = (() => {
  let enabled = false;

  function isShortcut(event) {
    if (event.code !== 'KeyK' || event.shiftKey || event.ctrlKey) return false;
    if (PreviousSettings.isMac) return event.metaKey && !event.altKey;
    return event.altKey && !event.metaKey;
  }

  function onKeyDown(event) {
    if (!isShortcut(event)) return;
    const search = window.top.document.querySelector('.ns-ui-omni-box-input__element');
    if (!search) return;
    event.preventDefault();
    event.stopPropagation();
    window.top.focus();
    search.focus();
  }

  return {
    enable() {
      if (enabled) return;
      enabled = true;
      window.addEventListener('keydown', onKeyDown, true);
    },

    disable() {
      enabled = false;
      window.removeEventListener('keydown', onKeyDown, true);
    },
  };
})();
