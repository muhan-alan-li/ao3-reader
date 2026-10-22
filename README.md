# Paper View

A small browser extension that gives AO3 an academic appearance:

- **Browsing:** each story preview becomes a manuscript abstract: a white paper panel, prominent title, separate byline, dated metadata, an Abstract section, compact keywords, and a statistics footer. Status icons become plain text. The native results list, search, filters, and sidebar stay in place; no custom header or replacement index is added.
- **Bookmarks:** saved works, series, and external works use the same paper-style panels and stable title aliases, with original titles available on hover. Bookmark notes, privacy status, edit/delete controls, and filters stay accessible in place.
- **Reading:** a white manuscript sheet up to 1080px wide with generous margins and bundled Latin Modern Roman, the familiar LaTeX serif. Text uses 18px type, 1.6 line spacing, and a 0.9em gap between indented paragraphs. Opening paragraphs and paragraphs after headings or scene breaks start flush left. Bold and italic have their own font files. Section navigation stays in place. The whole story overview starts collapsed; click “Story overview” to expand or collapse all metadata together. Disabling Paper View restores the original overview.
- **Appearance:** replaces AO3 branding, tab title, favicon, and selected interface labels with academic equivalents. Summaries, tags, author notes, illustrations, metadata, and comments remain in their native locations and stay accessible.
- **Titles:** replaces work titles in previews and reading headings with a stable scientific paper title chosen from a bundled list of 16 arXiv titles. The same work keeps its alias across searches, collection URLs, chapters, and reloads. Hover over a disguised title to see the original in the browser’s native tooltip. No extra buttons or click actions are added. The scientific alias stays in place and its link still opens the story. Disable Paper View in the popup to restore original titles throughout the page. Source links are included beside each entry in `extension/content/titles.js`; no online lookup or saved title mapping is needed. Different works can share an alias.
- **Controls:** click the extension's toolbar icon to open its popup, then choose **Disable Paper View** or **Enable Paper View**. The preference is remembered locally and immediately updates every open AO3 tab. Disabling restores the native page, labels, title, and favicon. The appearance toggle lives in the popup.

Plain JavaScript and CSS. No framework, CSS library, build step, runtime dependencies, background process, analytics, or saved reading data. The extension runs only on `archiveofourown.org` and `www.archiveofourown.org`, over HTTPS. It makes no network requests of its own; the underlying AO3 page continues to operate normally.

The `storage` permission saves only the enabled/disabled preference in extension-local storage, using the browser's [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage).

This is a visual disguise for casual glances. The address bar, link previews, history, author names, tags, summaries, and story prose are unchanged. It is not an anonymity tool. “LaTeX-style” means a typeset appearance, not actual TeX rendering. Unusual work skins and AO3 markup changes may need additional rules.

## Install

No npm installation is needed to use the extension.

### Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and choose this project's `extension` folder.
3. Open or reload an AO3 browsing or story page.

Open Chrome's Extensions menu (the puzzle-piece icon), then click **Paper View** to access the toggle. Pin it for direct access from the toolbar. After updating the extension's files, reload it in `chrome://extensions` and refresh any open AO3 tabs.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and choose `extension/manifest.json`.
3. Open or reload an AO3 page.

Temporary add-ons are removed when Firefox restarts. Persistent distribution requires signing through Mozilla. The manifest targets Firefox 140+ and declares that no data is collected. See Mozilla's [temporary installation guide](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/) and [manifest documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).

### Safari on macOS

Safari uses the same extension files inside an app wrapper. With full Xcode installed, run from this project's root:

```sh
xcrun safari-web-extension-packager \
  --project-location ./safari \
  --app-name "Paper View" \
  --bundle-identifier local.ao3reader.PaperView \
  --macos-only \
  ./extension
```

Older Xcode versions name this tool `safari-web-extension-converter`; use that command with the same arguments if `packager` is unavailable. If `xcrun` is using Command Line Tools rather than full Xcode, prefix the command with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.

In the generated Xcode project, configure signing for your local Apple account, select the macOS app, and build/run it. Enable the extension in **Safari → Settings → Extensions** and allow it access to AO3. For a local unsigned development build, Safari may require **Allow Unsigned Extensions** in its developer settings. Apple's [Safari packaging documentation](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari) covers packaging and distribution.

The Safari wrapper is generated locally, rather than committed. This environment could locate Apple's packager but could not run it successfully under its filesystem restrictions; a Safari build has not been verified.

## Development

```sh
npm install
npm run check
npx playwright install
npm test
npm run format
npm run package
```

`npm run package` needs only Node.js and the `zip` command. It produces `dist/paper-view-0.1.0.zip`, with the manifest at the archive root, for Firefox signing or extension-store submission. Chrome's unpacked installer uses the `extension` folder directly. Safari still needs its app wrapper.

Tests exercise representative AO3-shaped browsing and chapter fixtures in Chromium, Firefox, and WebKit. They cover native page structure and sidebar layout, appearance reversal, manuscript text preservation, navigation links, native search submission, DOM updates, popup controls, and mobile width. An additional Chromium test loads the real unpacked extension to verify automatic injection. WebKit fixture tests do not substitute for testing a packaged Safari extension; Firefox fixture tests do not verify add-on installation.

Browser launches were blocked in the initial development environment. JavaScript syntax, CSS parsing, packaging, and separate DOM-level checks were verified; visual and installed-browser checks remain to be run in an unrestricted environment. The fixtures use synthetic content and follow AO3's public [work markup](https://github.com/otwcode/otwarchive/tree/master/app/views/works) and [chapter markup](https://github.com/otwcode/otwarchive/tree/master/app/views/chapters).

## Files

```text
extension/
  manifest.json   AO3-only Manifest V3 extension
  paper.css       Native-page academic and manuscript styling
  fonts/          Bundled Latin Modern WOFF2 fonts and license
  content.js      Content-script entry: preference, observer, and lifecycle
  content/
    state.js      Shared content-script state
    titles.js     Stable scientific title aliases
    labels.js     Neutral interface labels
    overview.js   Collapsible story overview
    page.js       Document title, favicon, and page refresh
  popup.html      Extension popup with the enable/disable button
  popup.css       Popup styling
  popup.js        Saves the appearance preference
tests/
  fixtures/       Synthetic AO3-shaped pages
  extension.spec.cjs
scripts/
  check.mjs       Syntax-checks every JavaScript file in the manifest
  package.mjs     Creates the distributable zip
```

Change `paper.css` for typography or layout. JavaScript keeps native links, event handlers, forms, and story content in place, and watches for dynamically inserted page content. Reload the extension and the AO3 tab after editing files.
