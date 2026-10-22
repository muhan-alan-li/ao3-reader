/* Stable scientific aliases for work titles. */
(() => {
  "use strict";

  const paperView = globalThis.paperView;

  // Bundled cover titles, sourced from arXiv. No runtime requests or stored mapping.
  // Keep this list in order so each work ID keeps its alias across page visits.
  const paperTitles = [
    "The Statistical Physics of Real-World Networks", // https://arxiv.org/abs/1810.05095
    "Pattern Formation on Networks: from Localised Activity to Turing Patterns", // https://arxiv.org/abs/1601.05404
    "Exploring the structural regularities in networks", // https://arxiv.org/abs/1110.1976
    "Parameter estimation in nonlinear stochastic differential equations", // https://arxiv.org/abs/nlin/0001019
    "Stability analysis and stabilization of systems with hyperexponential rates", // https://arxiv.org/abs/2207.08033
    "Stochastic Stability Analysis of Discrete Time System Using Lyapunov Measure", // https://arxiv.org/abs/1503.04438
    "A Tutorial on Principal Component Analysis", // https://arxiv.org/abs/1404.1100
    "An introduction to Monte Carlo methods", // https://arxiv.org/abs/1404.0209
    "A Tutorial on Spectral Clustering", // https://arxiv.org/abs/0711.0189
    "A Tutorial on Bayesian Optimization", // https://arxiv.org/abs/1807.02811
    "Introduction to Random Matrices", // https://arxiv.org/abs/hep-th/9210073
    'Lecture Notes on "Random Matrices"', // https://arxiv.org/abs/2009.05157
    "An overview of gradient descent optimization algorithms", // https://arxiv.org/abs/1609.04747
    "Compression-based inference of network motif sets", // https://arxiv.org/abs/2311.16308
    "Human Learning of Hierarchical Graphs", // https://arxiv.org/abs/2309.02665
    "Multi-flocks: emergent dynamics in systems with multi-scale collective behavior", // https://arxiv.org/abs/2003.04489
  ];

  function workId(href) {
    try {
      return new URL(href, location.href).pathname.match(
        /\/works\/(\d+)(?:\/|$)/,
      )?.[1];
    } catch {
      return undefined;
    }
  }

  function paperTitle(id) {
    let hash = 2166136261;
    for (const character of id) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    }
    return paperTitles[(hash >>> 0) % paperTitles.length];
  }

  function maskTitle(element, replacement) {
    // Keep nested markup and handlers. The browser tooltip reveals the original
    // title on hover while the visible text remains a scientific alias.
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);
    const originalText = [];
    let first = true;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const previous = paperView.originals.get(node);
      const text =
        previous && node.nodeValue === previous.replacement
          ? previous.text
          : node.nodeValue;
      originalText.push(text);
      if (!text.trim()) continue;
      const value = first ? replacement : "";
      first = false;
      paperView.originals.set(node, { text, replacement: value });
      node.nodeValue = value;
    }
    const original = originalText.join("").trim();
    for (const target of [
      element,
      ...element.querySelectorAll("[title], [aria-label]"),
    ]) {
      // Preserve restricted-work icon labels and give text wrappers the same tooltip.
      if (target.matches('img, svg, [role="img"]')) continue;
      for (const name of ["title", "aria-label"]) {
        if (
          !target.hasAttribute(name) &&
          !(target === element && name === "title")
        ) {
          continue;
        }
        if (!paperView.titleAttributes.has(target)) {
          paperView.titleAttributes.set(target, new Map());
        }
        const attributes = paperView.titleAttributes.get(target);
        const previous = attributes.get(name);
        const current = target.getAttribute(name);
        const text =
          previous && current === previous.replacement
            ? previous.text
            : current;
        const value = name === "title" ? original : replacement;
        attributes.set(name, { text, replacement: value });
        target.setAttribute(name, value);
      }
    }
  }

  function maskWorkTitles() {
    document
      .querySelectorAll("#main .blurb .header h4.heading > a[href]")
      .forEach((link) => {
        if (
          link !== link.parentElement.querySelector("a[href]") ||
          link.relList.contains("author")
        ) {
          return;
        }
        let url;
        try {
          url = new URL(link.href);
        } catch {
          return;
        }
        const local = [
          "archiveofourown.org",
          "www.archiveofourown.org",
        ].includes(url.hostname);
        const id = local ? workId(link.href) : undefined;
        if (id) {
          maskTitle(link, paperTitle(id));
        } else if (link.closest(".bookmark.blurb")) {
          // Bookmarks may point to a series or an external work, not just /works/.
          const seriesId = url.pathname.match(/\/series\/(\d+)(?:\/|$)/)?.[1];
          if (local && seriesId) {
            maskTitle(link, paperTitle(`series:${seriesId}`));
          } else if (!local && /^https?:$/.test(url.protocol)) {
            url.hash = "";
            maskTitle(link, paperTitle(`external:${url.href}`));
          }
        }
      });
    const id = workId(location.href);
    if (id) {
      document
        .querySelectorAll("#workskin > .preface > h2.title")
        .forEach((heading) => {
          maskTitle(heading, paperTitle(id));
        });
    }
  }

  paperView.maskWorkTitles = maskWorkTitles;
})();
