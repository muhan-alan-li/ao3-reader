/* Paper View: stores only an appearance preference, never reading data. */
(() => {
  "use strict";

  const paperView = globalThis.paperView;
  const { root, extension } = paperView;
  let pending = false;
  let preferenceChanged = false;

  function setEnabled(nextEnabled) {
    if (paperView.enabled === nextEnabled) return;
    observer.disconnect();
    paperView.enabled = nextEnabled;
    root.dataset.paperView = paperView.enabled ? "on" : "off";
    if (paperView.enabled) paperView.refresh();
    else paperView.restorePage();
    observe();
  }

  const observer = new MutationObserver((records) => {
    // Attribute changes seen here come from the page, not from refresh():
    // the observer is disconnected while Paper View writes.
    for (const record of records) {
      if (record.type !== "attributes") continue;
      const attributes = paperView.titleAttributes.get(record.target);
      if (!attributes) continue;
      attributes.delete(record.attributeName);
      if (attributes.size === 0)
        paperView.titleAttributes.delete(record.target);
    }
    if (pending || !paperView.enabled) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      observer.disconnect();
      paperView.refresh();
      observe();
    });
  });

  function observe() {
    if (!paperView.enabled) return;
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href", "title", "aria-label"],
    });
  }

  function start() {
    paperView.refresh();
    observe();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  // Storage events update every open AO3 tab without a reload or background script.
  extension.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabled) return;
    preferenceChanged = true;
    setEnabled(changes.enabled.newValue !== false);
  });
  extension.storage.local
    .get({ enabled: true })
    .then((settings) => {
      if (!preferenceChanged) setEnabled(settings.enabled !== false);
    })
    .catch((error) =>
      console.warn(
        "Paper View could not load its appearance preference.",
        error,
      ),
    );
})();
