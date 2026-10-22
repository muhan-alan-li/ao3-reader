(() => {
  "use strict";

  const extension = globalThis.browser ?? globalThis.chrome;
  const toggle = document.querySelector("#paper-toggle");
  const status = document.querySelector("#paper-status");
  let enabled = true;

  function render() {
    toggle.textContent = enabled ? "Disable Paper View" : "Enable Paper View";
    toggle.setAttribute("aria-pressed", String(enabled));
    status.textContent = enabled
      ? "Enabled on all AO3 tabs."
      : "Disabled. AO3 uses its original appearance.";
  }

  extension.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabled) return;
    enabled = changes.enabled.newValue !== false;
    render();
  });

  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    try {
      const nextEnabled = !enabled;
      await extension.storage.local.set({ enabled: nextEnabled });
      enabled = nextEnabled;
      render();
    } catch {
      status.textContent = "Could not save the setting. Please try again.";
    } finally {
      toggle.disabled = false;
    }
  });

  extension.storage.local
    .get({ enabled: true })
    .then((settings) => {
      enabled = settings.enabled !== false;
      render();
      toggle.disabled = false;
    })
    .catch(() => {
      toggle.textContent = "Setting unavailable";
      status.textContent =
        "Could not load the setting. Please reopen this popup.";
    });
})();
