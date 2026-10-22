/* Neutral interface labels for the academic appearance. */
(() => {
  "use strict";

  const paperView = globalThis.paperView;

  const labels = new Map([
    ["Archive of Our Own", "Research Archive"],
    ["AO3", "RA"],
    ["Organization for Transformative Works", "Open Research Repository"],
    ["Works", "Publications"],
    ["Fandoms", "Subjects"],
    ["Works:", "Publications:"],
    ["Bookmarks", "Saved publications"],
    ["Bookmarker’s Tags:", "Reader keywords:"],
    ["Bookmarker's Tags:", "Reader keywords:"],
    ["Bookmarker’s Collections:", "Reading lists:"],
    ["Bookmarker's Collections:", "Reading lists:"],
    ["Bookmarker’s Notes", "Reader notes"],
    ["Bookmarker's Notes", "Reader notes"],
    ["Private Bookmark", "Private"],
    ["Public Bookmark", "Public"],
    ["Rec", "Recommended"],
    ["Chapters:", "Sections:"],
    ["Kudos:", "Citations:"],
    ["Hits:", "Views:"],
    ["Bookmarks:", "Saved:"],
    ["Comments:", "Discussion:"],
    ["Summary:", "Abstract:"],
    ["Notes:", "Author notes:"],
    ["Summary", "Abstract"],
    ["Tags", "Keywords"],
    ["Previous Chapter", "Previous section"],
    ["Next Chapter", "Next section"],
    ["Entire Work", "Full text"],
    ["Chapter by Chapter", "Section view"],
    ["Chapter Index", "Contents"],
    ["Bookmark", "Save"],
    ["Mark for Later", "Read later"],
    ["Subscribe", "Follow updates"],
    ["Work Search", "Publication search"],
    ["Search Works", "Search publications"],
    ["Bookmark Search", "Saved publication search"],
    ["Search Bookmarks", "Search saved publications"],
    ["Sort and Filter", "Apply filters"],
    ["Sort and Filter Works", "Refine results"],
  ]);

  // Change text nodes rather than replacing elements: links, forms, and AO3's
  // own event handlers keep working. Never walk the actual story text.
  function relabel(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType !== Node.TEXT_NODE) continue;
      if (paperView.originals.has(node)) continue;
      const text = node.nodeValue;
      const trimmed = text.trim();
      let replacement = labels.get(trimmed);
      if (element.matches("#header, #footer")) {
        replacement = (replacement || trimmed)
          .replace(/\bArchive of Our Own\b/g, "Research Archive")
          .replace(
            /\bOrganization for Transformative Works\b/g,
            "Open Research Repository",
          );
      }
      if (element.matches("#main > .heading")) {
        replacement = (replacement || trimmed)
          .replace(/\bWorks\b/g, "Publications")
          .replace(/\bBookmarks\b/g, "Saved publications");
      }
      if (element.matches(".bookmark.blurb > .user > .byline")) {
        replacement = (replacement || trimmed).replace(
          /\bBookmarked by\b/g,
          "Saved by",
        );
      }
      if (/^(← )?Previous Chapter$/.test(trimmed)) {
        replacement = trimmed.replace("Previous Chapter", "Previous section");
      }
      if (/^Next Chapter( →)?$/.test(trimmed)) {
        replacement = trimmed.replace("Next Chapter", "Next section");
      }
      if (element.matches(".chapter .title") && /^Chapter \d+/.test(trimmed)) {
        replacement = trimmed.replace(/^Chapter /, "Section ");
      }
      if (replacement && replacement !== trimmed) {
        paperView.originals.set(node, {
          text,
          replacement: text.replace(trimmed, replacement),
        });
        node.nodeValue = text.replace(trimmed, replacement);
      }
    }
  }

  paperView.relabel = relabel;
})();
