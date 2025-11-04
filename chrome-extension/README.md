# Chrome Extension

A blank Chrome extension template ready for development.

## Structure

```
chrome-extension/
├── manifest.json       # Extension configuration
├── popup.html         # Popup UI
├── popup.js           # Popup logic
├── background.js      # Background service worker
├── styles.css         # Popup styles
└── icons/            # Extension icons (add your own)
```

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select this directory (`chrome-extension`)

## Development

### manifest.json
The main configuration file that defines your extension's capabilities, permissions, and metadata.

### popup.html / popup.js
The popup that appears when users click the extension icon in the toolbar.

### background.js
Service worker that runs in the background, handling events and long-running tasks.

## Icons

You'll need to add icon files in the `icons/` directory:
- `icon16.png` - 16x16px (favicon in toolbar)
- `icon48.png` - 48x48px (extension management page)
- `icon128.png` - 128x128px (Chrome Web Store)

You can create simple placeholder icons or use a tool like [favicon.io](https://favicon.io/) to generate them.

## Next Steps

- Add your custom functionality to `popup.js` and `background.js`
- Modify the UI in `popup.html` and `styles.css`
- Add permissions in `manifest.json` as needed
- Create content scripts if you need to interact with web pages
- Add icons to the `icons/` directory

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)

