/* Page chrome: document title, favicon, labels, and title aliases. */
(() => {
  "use strict";

  const paperView = globalThis.paperView;
  const { root, originals, titleAttributes, favicons, metadataDisclosures } =
    paperView;

  const icon = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#243d51"/><text x="8" y="24" font-family="Georgia,serif" font-size="25" fill="white">P</text></svg>',
  )}`;

  const relabelSelector = [
    "#header",
    "#footer",
    "#main > .heading",
    "#main dl.stats dt",
    "#main .actions a",
    "#main .actions label",
    "#main .actions button",
    "#main .preface .module > .heading",
    "#main .chapter .title",
    "#main form > fieldset > legend",
    "#main input + label",
    "#main :is(.work, .bookmark).blurb > h6.landmark",
    "#main .bookmark.blurb > .user > .heading",
    "#main .bookmark.blurb > .status",
  ].join(",");

  function applyFavicon() {
    document.querySelectorAll('link[rel~="icon"]').forEach((link) => {
      if (link === paperView.ownIcon) return;
      if (!favicons.has(link)) favicons.set(link, link.getAttribute("href"));
      if (link.href !== icon) link.setAttribute("href", icon);
    });
    if (!document.querySelector('link[rel~="icon"]') && document.head) {
      paperView.ownIcon = document.createElement("link");
      paperView.ownIcon.rel = "icon";
      paperView.ownIcon.href = icon;
      document.head.append(paperView.ownIcon);
    }
  }

  function refresh() {
    if (!paperView.enabled || !document.body) return;

    // DOM detection covers /works/:id, chapter pages, full works, and collection URLs.
    const manuscript = Boolean(document.querySelector("#workskin #chapters"));
    root.dataset.paperPage = manuscript ? "manuscript" : "index";
    if (manuscript) paperView.collapseMetadata();

    const title = manuscript ? "Manuscript" : "Publications";
    if (document.title !== `Research Archive — ${title}`) {
      paperView.originalTitle = document.title;
      document.title = `Research Archive — ${title}`;
    }

    applyFavicon();
    document.querySelectorAll(relabelSelector).forEach(paperView.relabel);
    paperView.maskWorkTitles();

    // Release nodes removed by native pagination or other page updates.
    for (const node of originals.keys()) {
      if (!node.isConnected) originals.delete(node);
    }
    for (const link of favicons.keys()) {
      if (!link.isConnected) favicons.delete(link);
    }
    for (const element of titleAttributes.keys()) {
      if (!element.isConnected) titleAttributes.delete(element);
    }
  }

  function restorePage() {
    for (const [metadata, disclosure] of metadataDisclosures) {
      paperView.restoreMetadata(metadata, disclosure);
    }
    for (const [node, value] of originals) node.nodeValue = value.text;
    originals.clear();
    for (const [element, attributes] of titleAttributes) {
      for (const [name, value] of attributes) {
        if (value.text === null) element.removeAttribute(name);
        else element.setAttribute(name, value.text);
      }
    }
    titleAttributes.clear();
    document.title = paperView.originalTitle;
    for (const [link, href] of favicons) {
      if (href === null) link.removeAttribute("href");
      else link.setAttribute("href", href);
    }
    favicons.clear();
    paperView.ownIcon?.remove();
    paperView.ownIcon = undefined;
  }

  paperView.refresh = refresh;
  paperView.restorePage = restorePage;
})();
