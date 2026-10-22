/* Collapsible story overview while preserving the native metadata. */
(() => {
  "use strict";

  const paperView = globalThis.paperView;

  function restoreMetadata(metadata, disclosure) {
    if (metadata.parentElement === disclosure) disclosure.replaceWith(metadata);
    else disclosure.remove();
    paperView.metadataDisclosures.delete(metadata);
  }

  function collapseMetadata() {
    for (const [metadata, disclosure] of paperView.metadataDisclosures) {
      if (!metadata.isConnected || metadata.parentElement !== disclosure) {
        restoreMetadata(metadata, disclosure);
      }
    }
    document.querySelectorAll("#main dl.work.meta").forEach((metadata) => {
      if (paperView.metadataDisclosures.has(metadata)) return;
      const disclosure = document.createElement("details");
      disclosure.className = "paper-story-overview";
      const summary = document.createElement("summary");
      summary.textContent = "Story overview";
      metadata.before(disclosure);
      disclosure.append(summary, metadata);
      paperView.metadataDisclosures.set(metadata, disclosure);
    });
  }

  paperView.collapseMetadata = collapseMetadata;
  paperView.restoreMetadata = restoreMetadata;
})();
