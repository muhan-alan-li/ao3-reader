/* Shared state for Paper View's content-script modules. */
(() => {
  "use strict";

  const root = document.documentElement;
  const extension = globalThis.browser ?? globalThis.chrome;

  // Wait for the saved preference before applying any styling.
  root.dataset.paperView = "off";

  globalThis.paperView = {
    root,
    extension,
    enabled: false,
    originalTitle: document.title,
    ownIcon: undefined,
    originals: new Map(),
    titleAttributes: new Map(),
    favicons: new Map(),
    metadataDisclosures: new Map(),
  };
})();
