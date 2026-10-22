const { test, expect, chromium } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const extension = path.resolve(__dirname, "../extension");
const manifest = require("../extension/manifest.json");
const contentScripts = manifest.content_scripts.flatMap(({ js }) => js);

async function injectContentScripts(page) {
  for (const file of contentScripts) {
    await page.addScriptTag({ path: path.join(extension, file) });
  }
}

async function fixture(page, name, url = "https://archiveofourown.org/works") {
  await page.addInitScript(() => {
    const values = JSON.parse(localStorage.getItem("paper-test-settings") || "{}");
    const listeners = new Set();
    globalThis.chrome ??= {};
    globalThis.chrome.storage = {
      local: {
        async get(defaults) { return { ...defaults, ...values }; },
        async set(settings) {
          const changes = {};
          for (const [key, newValue] of Object.entries(settings)) {
            changes[key] = { oldValue: values[key], newValue };
            values[key] = newValue;
          }
          localStorage.setItem("paper-test-settings", JSON.stringify(values));
          for (const listener of listeners) listener(changes, "local");
        },
      },
      onChanged: { addListener(listener) { listeners.add(listener); } },
    };
  });
  const html = await fs.readFile(path.join(__dirname, "fixtures", `${name}.html`), "utf8");
  await page.route("https://archiveofourown.org/**", route => route.fulfill({ body: html, contentType: "text/html" }));
  await page.goto(url);
  await page.evaluate(() => {
    globalThis.originalBodyElements = [...document.body.querySelectorAll("*")];
    globalThis.originalSidebarLayout = {};
    for (const selector of ["#main", ".filters"]) {
      const element = document.querySelector(selector);
      if (element) {
        const style = getComputedStyle(element);
        originalSidebarLayout[selector] = [style.position, style.float, style.width, style.paddingRight];
      }
    }
  });
  // Inline font data in fixtures; installed extensions resolve these URLs
  // against the extension's stylesheet and web-accessible resources.
  let css = await fs.readFile(path.join(extension, "paper.css"), "utf8");
  for (const name of ["regular", "italic", "bold", "bold-italic"]) {
    const font = await fs.readFile(path.join(extension, "fonts", `LM-${name}.woff2`));
    css = css.replace(`fonts/LM-${name}.woff2`, `data:font/woff2;base64,${font.toString("base64")}`);
  }
  await page.addStyleTag({ content: css });
  await injectContentScripts(page);
}

async function setEnabled(page, enabled) {
  await page.evaluate(value => chrome.storage.local.set({ enabled: value }), enabled);
}

test("listings preserve native headings, filters, metadata, navigation, and search", async ({ page }) => {
  await fixture(page, "index");
  await expect(page).toHaveTitle("Research Archive — Publications");
  await expect(page.locator("#header")).toContainText("Research Archive");
  await expect(page.locator("#footer")).toBeVisible();
  await expect(page.locator("#work_101 .fandoms")).toBeVisible();
  await expect(page.locator("#work_101 .tags")).toBeVisible();
  await expect(page.locator("#work_101 .summary")).toBeVisible();
  await expect(page.locator("#work_101 .chapters").first()).toHaveText("Sections:");
  await expect(page.locator("#work_101 h4 a").first()).toHaveAttribute("href", "/works/101");
  await expect(page.getByRole("link", { name: "Next →" })).toBeVisible();
  await expect(page.locator("#main > .heading")).toHaveText("1 - 2 of 200 Publications in Familiar Fandom");
  await expect(page.locator(".filters")).toBeVisible();
  await expect(page.locator("#paper-toolbar, #paper-page-heading, .paper-query")).toHaveCount(0);
  expect(await page.evaluate(() => {
    const current = [...document.body.querySelectorAll("*")].filter(element => element.tagName !== "SCRIPT");
    return originalBodyElements.length === current.length && originalBodyElements.every((element, index) => element === current[index]);
  })).toBe(true);
  expect(await page.evaluate(() => Object.entries(originalSidebarLayout).every(([selector, before]) => {
    const style = getComputedStyle(document.querySelector(selector));
    return JSON.stringify(before) === JSON.stringify([style.position, style.float, style.width, style.paddingRight]);
  }))).toBe(true);
  await page.getByLabel("Search", { exact: true }).fill("quiet things & observations");
  await page.locator("#header form button").click();
  await expect(page).toHaveURL(/work_search%5Bquery%5D=quiet\+things\+%26\+observations/);
});

test("work previews look like paper abstracts and restore the native card on disable", async ({ page }) => {
  await fixture(page, "index");
  const card = page.locator("#work_101");
  const title = card.locator('h4.heading > a[href*="/works/"]');
  const titleBox = await title.boundingBox();
  const authorBox = await card.locator('a[rel="author"]').boundingBox();
  expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(authorBox.y);
  await expect(card.locator(".required-tags .text").first()).toBeVisible();
  await expect(card.locator(".required-tags .text").first()).toHaveText("Explicit");
  await expect(card.locator(".required-tags .rating")).toHaveCSS("background-image", "none");
  await expect(card.locator(".summary")).toBeVisible();
  const abstract = await card.locator(".summary").boundingBox();
  const keywords = await card.locator(".tags").boundingBox();
  const statistics = await card.locator("dl.stats").boundingBox();
  expect(abstract.y).toBeLessThan(keywords.y);
  expect(keywords.y).toBeLessThan(statistics.y);
  expect(await card.locator(".summary").evaluate(element => getComputedStyle(element, "::before").content)).toBe('"Abstract"');
  expect(await card.locator(".tags").evaluate(element => getComputedStyle(element, "::before").content)).toBe('"Keywords: "');
  await expect(card.locator("h6.landmark")).toHaveText(["Keywords", "Abstract"]);
  await setEnabled(page, false);
  await expect(title).not.toHaveCSS("display", "block");
  await expect(card.locator(".required-tags .text").first()).toHaveCSS("position", "absolute");
  await expect(card.locator("h6.landmark")).toHaveText(["Tags", "Summary"]);
});

for (const url of ["https://archiveofourown.org/bookmarks", "https://archiveofourown.org/users/reader/bookmarks", "https://archiveofourown.org/works/101/bookmarks"]) {
  test(`bookmarks retain paper previews, original-title tooltips, and native controls at ${new URL(url).pathname}`, async ({ page }) => {
    await fixture(page, "bookmarks", url);
    const card = page.locator("#bookmark_501");
    const title = card.locator('h4 > a[href="/works/101"]');
    await expect(title).not.toHaveText("On the Nature of Quiet Things");
    await expect(title).toHaveAttribute("title", "On the Nature of Quiet Things");
    await expect(page.locator("#main > .heading")).toHaveText("1 - 5 of 200 Saved publications");
    await expect(card.locator(".summary")).toBeVisible();
    const titleBox = await title.boundingBox();
    const authorBox = await card.locator('a[rel="author"]').boundingBox();
    expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(authorBox.y);
    const abstract = await card.locator(".summary").boundingBox();
    const keywords = await card.locator(":scope > .tags").boundingBox();
    expect(abstract.y).toBeLessThan(keywords.y);
    await expect(card.locator(".user .byline")).toHaveText("Saved by reader");
    await expect(card.locator(".user .notes")).toHaveText("Keep this one for a rainy afternoon.");
    await expect(card.locator(".status .text")).toBeVisible();
    await expect(card.locator(".status .text")).toHaveText("Private");
    await expect(card.getByRole("link", { name: "Edit", exact: true })).toHaveAttribute("href", "/bookmarks/501/edit");
    await expect(card.getByRole("link", { name: "Delete", exact: true })).toHaveAttribute("data-method", "delete");
    await expect(page.locator("#bookmark-filters")).toBeVisible();
    await expect(page.getByRole("link", { name: "Next →" })).toHaveAttribute("href", "/bookmarks?page=2");
    await expect(page.locator("#bookmark_503 h4 > a").first()).toHaveAttribute("title", "A Very Recognizable Series");
    await expect(page.locator("#bookmark_504 h4 > a")).toHaveAttribute("title", "A Recognizable External Work");
    await expect(page.locator("#bookmark_504 h4 > a")).toHaveAttribute("href", "https://example.org/works/101#chapter-1");
    await expect(page.locator("#bookmark_505 .message")).toHaveText("This item has been deleted.");
    expect(await page.evaluate(() => {
      const current = [...document.body.querySelectorAll("*")].filter(element => element.tagName !== "SCRIPT");
      return originalBodyElements.length === current.length && originalBodyElements.every((element, index) => element === current[index]);
    })).toBe(true);
    expect(await page.evaluate(() => Object.entries(originalSidebarLayout).every(([selector, before]) => {
      const style = getComputedStyle(document.querySelector(selector));
      return JSON.stringify(before) === JSON.stringify([style.position, style.float, style.width, style.paddingRight]);
    }))).toBe(true);
    await setEnabled(page, false);
    await expect(title).toHaveText("On the Nature of Quiet Things");
    await expect(title).not.toHaveAttribute("title");
    await expect(card.locator(".user .byline")).toHaveText("Bookmarked by reader");
    await expect(card.locator(".status .text")).toHaveText("Private Bookmark");
    await expect(page.locator("#bookmark_503 h4 > a").first()).toHaveText("A Very Recognizable Series");
    await expect(page.locator("#bookmark_504 h4 > a")).toHaveText("A Recognizable External Work");
  });
}

test("disabling restores title, favicon, branding, and labels without adding controls", async ({ page }) => {
  await fixture(page, "index");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /^data:image\/svg\+xml/);
  await expect(page.locator("#work_101 .summary")).toBeVisible();
  await expect(page.locator(".filters")).toBeVisible();
  await expect(page.locator("#work_101 .tags")).toBeVisible();
  await expect(page.locator("#paper-toolbar #paper-toggle")).toHaveCount(0);
  await setEnabled(page, false);
  await expect(page.locator("#header")).toBeVisible();
  await expect(page).toHaveTitle("Works | Archive of Our Own");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "https://archiveofourown.org/favicon.ico");
  await expect(page.locator("#work_101 dt.chapters")).toHaveText("Chapters:");
  await expect(page.locator("#paper-page-heading")).toBeHidden();
  await expect(page.locator("#paper-toolbar")).toBeHidden();
  await setEnabled(page, true);
  await expect(page.locator("#header")).toContainText("Research Archive");
  await expect(page.locator("#work_101 dt.chapters")).toHaveText("Sections:");
});

test("work titles use stable aliases across listing, collection, chapter, and reload views", async ({ page }) => {
  await fixture(page, "index");
  const link = page.locator('#work_101 h4 > a[href="/works/101"]');
  await expect(link).not.toHaveText("On the Nature of Quiet Things");
  const alias = await link.textContent();
  await expect(page.locator('#work_101 a[rel="author"]')).toHaveText("fieldnotes");
  await page.evaluate(() => {
    const title = document.querySelector('#work_101 h4 > a[href="/works/101"]');
    title.title = "On the Nature of Quiet Things";
    title.setAttribute("aria-label", "Read On the Nature of Quiet Things");
  });
  await expect(link).toHaveAttribute("title", "On the Nature of Quiet Things");
  await expect(link).toHaveAttribute("aria-label", alias);
  await setEnabled(page, false);
  await expect(link).toHaveText("On the Nature of Quiet Things");
  await expect(link).toHaveAttribute("title", "On the Nature of Quiet Things");
  await expect(link).toHaveAttribute("aria-label", "Read On the Nature of Quiet Things");
  await setEnabled(page, true);
  await expect(link).toHaveText(alias);

  await page.reload();
  await page.addStyleTag({ path: path.join(extension, "paper.css") });
  await injectContentScripts(page);
  await expect(link).toHaveText(alias);

  const reading = await page.context().newPage();
  await fixture(reading, "manuscript", "https://archiveofourown.org/collections/example/works/101/chapters/201");
  await expect(reading.locator("#workskin > .preface > h2.title")).toHaveText(alias);
  await expect(reading.locator("#chapters .userstuff")).toContainText("The afternoon light");
  await setEnabled(reading, false);
  await expect(reading.locator("#workskin > .preface > h2.title")).toHaveText("On the Nature of Quiet Things");
});

for (const name of ["index", "manuscript"]) {
  test(`${name} original title is available through the title tooltip without extra controls`, async ({ page }) => {
    await fixture(page, name, name === "manuscript" ? "https://archiveofourown.org/works/101" : "https://archiveofourown.org/works");
    const title = page.locator(name === "index" ? '#work_101 h4 > a[href="/works/101"]' : "#workskin > .preface > h2.title");
    await expect(title).not.toHaveText("On the Nature of Quiet Things");
    await expect(title).toHaveAttribute("title", "On the Nature of Quiet Things");
    await expect(page.locator(".paper-title-control, .paper-title-button, .paper-title-original")).toHaveCount(0);
    const alias = await title.textContent();
    await title.hover();
    await expect(title).toHaveText(alias);
    if (name === "index") await expect(title).toHaveAttribute("href", "/works/101");
    await setEnabled(page, false);
    await expect(title).toHaveText("On the Nature of Quiet Things");
    await expect(title).not.toHaveAttribute("title");
    await setEnabled(page, true);
    await expect(title).toHaveText(alias);
    await expect(title).toHaveAttribute("title", "On the Nature of Quiet Things");
  });
}

test("chapter reading keeps prose and footnotes intact, styles the sheet, and keeps navigation", async ({ page }) => {
  await fixture(page, "manuscript", "https://archiveofourown.org/collections/sample/works/101/chapters/201");
  await expect(page.locator("html")).toHaveAttribute("data-paper-page", "manuscript");
  await expect(page).toHaveTitle("Research Archive — Manuscript");
  await expect(page.locator("dl.meta")).toBeHidden();
  await expect(page.locator("#feedback")).toBeVisible();
  await expect(page.locator("#chapters img")).toBeVisible();
  await expect(page.locator("#chapters .title")).toHaveText("Section 2: Observations");
  await expect(page.getByRole("link", { name: "Next section →" })).toHaveAttribute("href", "/works/101/chapters/202#workskin");
  await expect(page.getByRole("link", { name: "← Previous section" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Full text" })).toBeVisible();
  const paragraphs = page.locator('#chapters .userstuff[role="article"] > p');
  await expect(paragraphs.first()).toHaveCSS("font-family", /Paper Latin Modern/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].some(face => face.family.includes("Paper Latin Modern") && face.status === "loaded"))).toBe(true);
  await expect(paragraphs.first()).toHaveCSS("text-indent", "0px");
  await expect(paragraphs.nth(1)).toHaveCSS("text-indent", "27px");
  const lineHeight = await paragraphs
    .nth(1)
    .evaluate((p) => parseFloat(getComputedStyle(p).lineHeight));
  expect(lineHeight).toBeCloseTo(28.8);
  expect(parseFloat(await paragraphs.nth(1).evaluate(p => getComputedStyle(p).marginBottom))).toBeCloseTo(16.2, 1);
  await expect(page.locator("#chapters hr + p")).toHaveCSS("text-indent", "0px");
  await expect(page.locator("#chapters .userstuff p").first()).toHaveCSS("color", "rgb(36, 36, 36)");
  await expect(page.locator("#chapters .userstuff strong")).toHaveText("Chapter");
  await expect(page.locator("#chapters .userstuff em")).toHaveText("annotations");
  await expect(page.locator('a[href="#footnote-1"]')).toBeVisible();
  await expect(page.locator(".preface .summary").first()).toBeVisible();
  await setEnabled(page, false);
  await expect(page.locator("#chapters .title")).toHaveText("Chapter 2: Observations");
  await expect(page.getByRole("link", { name: "Next Chapter →" })).toBeVisible();
});

test("whole story overview expands and collapses, and restores on disable", async ({ page }) => {
  await fixture(page, "manuscript", "https://archiveofourown.org/works/101");
  const overview = page.locator(".paper-story-overview");
  const toggle = overview.locator("summary");
  await expect(toggle).toHaveText("Story overview");
  await expect(page.locator("dl.work.meta")).toBeHidden();
  await expect(page.locator(".paper-metadata-toggle")).toHaveCount(0);
  await toggle.click();
  await expect(page.locator("dl.work.meta")).toBeVisible();
  await expect(page.locator("dd.character")).toBeVisible();
  await expect(page.locator("dd.freeform")).toBeVisible();
  await expect(page.locator("dd.freeform a")).toHaveAttribute("href", "/tags/Quiet%20Moments/works");
  await page.evaluate(() => document.querySelector("#feedback").append(document.createElement("span")));
  await expect(overview).toHaveAttribute("open", "");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("dl.work.meta")).toBeHidden();
  await expect(page.locator("#chapters")).toBeVisible();
  await setEnabled(page, false);
  await expect(overview).toHaveCount(0);
  await expect(page.locator("dl.work.meta")).toBeVisible();
  expect(await page.evaluate(() => originalBodyElements.every(element => element.isConnected))).toBe(true);
  await setEnabled(page, true);
  await expect(overview).toHaveCount(1);
  await expect(page.locator("dl.work.meta")).toBeHidden();
});

test("native DOM updates are restyled without rewriting story content", async ({ page }) => {
  await fixture(page, "index");
  await page.evaluate(() => {
    const copy = document.querySelector(".blurb").cloneNode(true);
    copy.id = "work_103";
    copy.querySelector("dt.chapters").textContent = "Chapters:";
    document.querySelector("ol.work").append(copy);
    document.title = "Updated works | Archive of Our Own";
  });
  await expect(page.locator("#work_103 dt.chapters")).toHaveText("Sections:");
  await expect(page).toHaveTitle("Research Archive — Publications");
  await expect(page.locator("#paper-toolbar")).toHaveCount(0);
  await setEnabled(page, false);
  await expect(page).toHaveTitle("Updated works | Archive of Our Own");
});

for (const name of ["index", "manuscript", "bookmarks"]) {
  test(`${name} fits a narrow viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fixture(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.locator("#paper-toolbar, #paper-page-heading")).toHaveCount(0);
    await expect(page.locator("#main")).toBeVisible();
  });
}

test("manifest is limited to AO3 and lists existing files", async () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(["storage"]);
  expect(manifest.action.default_popup).toBe("popup.html");
  expect(manifest.content_scripts[0].run_at).toBe("document_start");
  expect(manifest.content_scripts[0].matches).toEqual(["https://archiveofourown.org/*", "https://www.archiveofourown.org/*"]);
  for (const file of [...manifest.content_scripts[0].css, ...manifest.content_scripts[0].js, manifest.action.default_popup, "popup.css", "popup.js"]) {
    await fs.access(path.join(extension, file));
  }
});

test("popup button changes the appearance, restores it, and remembers the preference on reload", async ({ page }) => {
  await fixture(page, "index");
  // Render the popup in a separate document with access to the mocked extension
  // storage, so this exercises the actual popup handler and content listener.
  const popup = await fs.readFile(path.join(extension, "popup.html"), "utf8");
  const popupScript = await fs.readFile(path.join(extension, "popup.js"), "utf8");
  await page.evaluate(({ popup, popupScript }) => {
    const frame = document.createElement("iframe");
    frame.id = "test-popup";
    document.body.append(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(popup.replace(/<script[^>]*src="popup.js"[^>]*><\/script>/, "").replace(/<link[^>]*href="popup.css"[^>]*>/, ""));
    doc.close();
    frame.contentWindow.chrome = { storage: chrome.storage };
    frame.contentWindow.eval(popupScript);
  }, { popup, popupScript });
  const popupFrame = page.frameLocator("#test-popup");
  await popupFrame.getByRole("button", { name: "Disable Paper View" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-paper-view", "off");
  await expect(page.locator("#header")).toContainText("Archive of Our Own");
  await expect(page.locator("#header")).toBeVisible();
  await expect(page.locator("#paper-toolbar")).toBeHidden();
  await expect(popupFrame.getByRole("button", { name: "Enable Paper View" })).toBeEnabled();
  await popupFrame.getByRole("button", { name: "Enable Paper View" }).click();
  await expect(page.locator("#header")).toContainText("Research Archive");
  await popupFrame.getByRole("button", { name: "Disable Paper View" }).click();
  await page.reload();
  await page.addStyleTag({ path: path.join(extension, "paper.css") });
  await injectContentScripts(page);
  await expect(page.locator("html")).toHaveAttribute("data-paper-view", "off");
  await expect(page.locator("#header")).toBeVisible();
  await expect(page.locator("#paper-toolbar")).toHaveCount(0);
  await setEnabled(page, true);
  await expect(page.locator("#header")).toContainText("Research Archive");
});

test("Chrome loads the real extension and injects it at navigation", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Unpacked extension loading is tested in Chromium.");
  const context = await chromium.launchPersistentContext(testInfo.outputPath("profile"), {
    channel: "chromium", headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const page = await context.newPage();
    const html = await fs.readFile(path.join(__dirname, "fixtures/index.html"), "utf8");
    await page.route("https://archiveofourown.org/**", route => route.fulfill({ body: html, contentType: "text/html" }));
    await page.goto("https://archiveofourown.org/works");
    await expect(page.locator("#paper-toolbar, #paper-page-heading")).toHaveCount(0);
    await expect(page.locator("#header")).toContainText("Research Archive");
    await expect(page).toHaveTitle("Research Archive — Publications");
  } finally { await context.close(); }
});
