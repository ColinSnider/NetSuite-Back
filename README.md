# Previous for NetSuite

A Chrome extension for NetSuite Next: dark mode, font changing, and a more familiar layout.
It only runs under `/next`, so the regular Redwood experience is left alone.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder.
3. Pin the extension and click its icon for the settings.

Changes apply right away to open NetSuite Next tabs, with no reload.

## Settings

- **Theme:** off, grey, navy blue, black, or a custom theme with its own colors for backgrounds,
  the accent, dividers, borders, and regular, header, and link text
- **Font:** bundled fonts plus common installed fonts, including Comic Sans MS
- **Main bar:** move it to the top, use the classic button locations, move the logo into it, move
  the profile menu to the right, center the search bar, focus search with Cmd+K on Mac or Alt+K on
  Windows, add record filter buttons to search, remove the color strip at the top
- **AI Assistant:** remove the AI assistant button, chats, notifications, and AI Insights
- **Records:** move action buttons under the title in reverse order with Edit and Save first,
  repeat them at the bottom of the page, bring back the classic section divider colors, remove
  the GL Impact tab from the side rail
- **Cases:** copy link button that copies a link named `Case # - First Last - Site name`

## How it works

- `src/content.js` runs in every frame, exits unless the top window is on `/next`, and sets
  `data-pfn-*` attributes on `<html>`. Everything in `src/content.css` is gated on those.
- `src/shell-dark.js` turns on NetSuite's own dark theme in the shell, which `content.css`
  rebases onto the chosen palette.
- `src/recolor.js` handles the classic iframes and Suitelets, which hard-code their colors.
- `src/primary-actions.js` finds Edit and Save so they can go first in the header.
- `src/copy-link.js` reads the case fields from the classic iframe and adds the copy link button.
- `src/bottom-actions.js` mirrors the header buttons at the end of the classic iframe.
- `src/search-shortcut.js` handles the search shortcut in every frame.
- `src/search-filters.js` adds the filter buttons to the search popup and edits the search box
  through the browser's editing commands, so NetSuite sees them as typing.
- `src/bar-logo.js` adds the company logo to the main bar and remembers it from the home page,
  the only page NetSuite draws it on.
- `src/ai-insights.js` finds the AI Insights and GL Impact tabs and the AI header button so they
  can be hidden.

Selectors target NetSuite's `ns-ui-*` class names, so a NetSuite update could break individual
features. Each one fails independently and leaves the page usable.

Bundled fonts are licensed under the SIL Open Font License; see `fonts/LICENSE-*.txt`.
