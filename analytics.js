/**
 * RevMatch Phase 1 analytics — lightweight, no backend.
 * Events: page_view, wizard_start, wizard_complete, referral_click
 *
 * Debug: window.__rmEvents (ring buffer) and ?debug=1 logs to console.
 * Optional: push to dataLayer / gtag if present (no-op otherwise).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RevMatchAnalytics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_BUFFER = 100;
  const EVENT_NAMES = ["page_view", "wizard_start", "wizard_complete", "referral_click"];

  function ensureBuffer() {
    if (typeof globalThis === "undefined") return [];
    if (!Array.isArray(globalThis.__rmEvents)) {
      globalThis.__rmEvents = [];
    }
    return globalThis.__rmEvents;
  }

  function isDebug() {
    if (typeof location === "undefined") return false;
    try {
      return new URLSearchParams(location.search).get("debug") === "1";
    } catch {
      return false;
    }
  }

  /**
   * @param {string} name
   * @param {Record<string, unknown>} [props]
   */
  function track(name, props) {
    if (!EVENT_NAMES.includes(name) && isDebug()) {
      console.warn("[RevMatch analytics] unknown event:", name);
    }

    const payload = {
      event: name,
      ts: new Date().toISOString(),
      path: typeof location !== "undefined" ? location.pathname + location.hash : "",
      ...(props || {}),
    };

    const buf = ensureBuffer();
    buf.push(payload);
    if (buf.length > MAX_BUFFER) buf.shift();

    if (isDebug()) {
      console.info("[RevMatch]", name, props || {});
    }

    try {
      if (typeof globalThis !== "undefined" && Array.isArray(globalThis.dataLayer)) {
        globalThis.dataLayer.push({ event: name, revmatch: props || {} });
      }
      if (typeof globalThis !== "undefined" && typeof globalThis.gtag === "function") {
        globalThis.gtag("event", name, props || {});
      }
    } catch {
      /* ignore third-party failures */
    }

    return payload;
  }

  function pageView(extra) {
    return track("page_view", extra);
  }

  return {
    EVENT_NAMES,
    track,
    pageView,
  };
});
