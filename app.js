/**
 * RevMatch matcher UI — wizard → ranked cards → outbound CTAs + guides.
 * Depends on: rank.js (RevMatchRank), analytics.js (RevMatchAnalytics)
 */
(function () {
  "use strict";

  const LABELS = {
    traffic: {
      under_10k: "Under 10k visits / mo",
      "10k_100k": "10k–100k",
      "100k_1m": "100k–1M",
      "1m_plus": "1M+",
    },
    niche: {
      tech: "Tech / SaaS",
      finance: "Finance",
      health: "Health",
      lifestyle: "Lifestyle",
      general: "Other / general",
    },
    geo: {
      us: "US",
      uk_eu: "UK / EU",
      global: "Global / other",
    },
    lane: {
      display_ppc: "Display / PPC",
      product_affiliate: "Product affiliate",
    },
    tier: {
      beginner: "Beginner",
      mid: "Mid",
      advanced: "Advanced",
    },
    link_status: {
      live: "Live referral",
      join_cta: "Join network",
      pending: "Join (link pending)",
    },
  };

  const DEFAULT_TRACKING = {
    utm_source: "revmatch",
    utm_medium: "referral",
    utm_campaign: "phase1",
    ref: "revmatch",
  };

  let catalog = null;
  let wizardStarted = false;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatRpm(band) {
    if (!band) return "RPM estimate unavailable";
    const cur = band.currency || "USD";
    const unit =
      band.unit === "per_1000_views" ? "est. RPM" : band.unit || "est.";
    const min = band.min != null ? band.min : "?";
    const max = band.max != null ? band.max : "?";
    return `${cur} $${min}–$${max} ${unit}`;
  }

  function tierFitLabel(program, traffic) {
    const reasons = Array.isArray(program.reasons) ? program.reasons : [];
    const label = LABELS.traffic[traffic] || traffic;
    if (reasons.includes("traffic_fit")) return `Fits ${label}`;
    if (Array.isArray(program.traffic_fit) && program.traffic_fit.includes(traffic)) {
      return `Fits ${label}`;
    }
    return `Near fit for ${label}`;
  }

  function resolveCta(program) {
    const tracking = program.tracking || DEFAULT_TRACKING;
    const status = program.link_status;

    if (status === "live" && program.referral_url) {
      return {
        href: RevMatchRank.withTracking(program.referral_url, tracking),
        label: "Open referral link",
        kind: "live",
      };
    }

    const join = program.join_url;
    if (join) {
      return {
        href: RevMatchRank.withTracking(join, tracking),
        label: status === "pending" ? "Apply / join network" : "Join network",
        kind: status === "pending" ? "pending" : "join_cta",
      };
    }

    return null;
  }

  function renderCard(program, traffic, index) {
    const cta = resolveCta(program);
    const guideHref = `guides/${encodeURIComponent(program.program_id)}.html`;
    const rpm = formatRpm(program.rpm_band);
    const rpmNote = program.rpm_band && program.rpm_band.note
      ? `<p class="card-note">${escapeHtml(program.rpm_band.note)}</p>`
      : "";

    const ctaHtml = cta
      ? `<a class="cta cta--card" href="${escapeHtml(cta.href)}" target="_blank" rel="noopener noreferrer"
            data-referral="1"
            data-program-id="${escapeHtml(program.program_id)}"
            data-link-kind="${escapeHtml(cta.kind)}"
            data-link-status="${escapeHtml(program.link_status || "")}">${escapeHtml(cta.label)}</a>`
      : `<span class="cta cta--disabled" aria-disabled="true">Link unavailable</span>`;

    return `<article class="result-card" data-program-id="${escapeHtml(program.program_id)}" style="--i:${index}">
      <header class="card-head">
        <h3 class="card-name">${escapeHtml(program.name)}</h3>
        <span class="card-rank">#${index + 1}</span>
      </header>
      <ul class="card-meta">
        <li><span>Tier</span> ${escapeHtml(LABELS.tier[program.tier] || program.tier)}</li>
        <li><span>Lane</span> ${escapeHtml(LABELS.lane[program.lane] || program.lane)}</li>
        <li><span>Fit</span> ${escapeHtml(tierFitLabel(program, traffic))}</li>
        <li><span>CTA</span> ${escapeHtml(LABELS.link_status[program.link_status] || program.link_status)}</li>
      </ul>
      <p class="card-rpm"><strong>${escapeHtml(rpm)}</strong>${program.rpm_band && program.rpm_band.estimate ? " · estimate" : ""}</p>
      ${rpmNote}
      <p class="card-payout">${escapeHtml(program.payout_notes || "See network terms for payout details.")}</p>
      <div class="card-actions">
        ${ctaHtml}
        <a class="guide-link" href="${guideHref}">Integration guide</a>
      </div>
    </article>`;
  }

  function showResults(programs, inputs) {
    const panel = $("#results");
    const list = $("#results-list");
    const summary = $("#results-summary");
    if (!panel || !list) return;

    summary.textContent = `${programs.length} programs for ${LABELS.traffic[inputs.traffic]} · ${LABELS.niche[inputs.niche]} · ${LABELS.geo[inputs.geo]}`;
    list.innerHTML = programs
      .map((p, i) => renderCard(p, inputs.traffic, i))
      .join("");
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setStatus(msg, isError) {
    const el = $("#wizard-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  async function loadCatalog() {
    const res = await fetch("programs.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`Could not load programs.json (${res.status})`);
    return res.json();
  }

  function readInputs(form) {
    const traffic = form.tier.value;
    const niche = form.niche.value;
    const geo = form.geo.value;
    if (!traffic || !niche || !geo) {
      throw new Error("Pick traffic tier, niche, and geo to match.");
    }
    return { traffic, niche, geo };
  }

  function onWizardFocus() {
    if (wizardStarted) return;
    wizardStarted = true;
    RevMatchAnalytics.track("wizard_start", { surface: "app" });
  }

  function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const btn = $("#match-btn");

    try {
      const inputs = readInputs(form);
      if (!catalog) {
        setStatus("Catalog still loading — try again in a moment.", true);
        return;
      }
      if (!wizardStarted) onWizardFocus();

      const started = performance.now();
      const ranked = RevMatchRank.rank(
        catalog,
        inputs.traffic,
        inputs.niche,
        inputs.geo,
        { topN: 5 },
      );
      const ms = Math.round(performance.now() - started);

      showResults(ranked, inputs);
      setStatus(`Matched in ${ms}ms · aim is under 60 seconds end-to-end.`);
      RevMatchAnalytics.track("wizard_complete", {
        traffic: inputs.traffic,
        niche: inputs.niche,
        geo: inputs.geo,
        result_count: ranked.length,
        rank_ms: ms,
        program_ids: ranked.map((r) => r.program_id),
      });

      if (btn) btn.blur();
    } catch (err) {
      setStatus(err.message || "Match failed", true);
    }
  }

  function onResultsClick(event) {
    const link = event.target.closest("[data-referral]");
    if (!link) return;
    RevMatchAnalytics.track("referral_click", {
      program_id: link.getAttribute("data-program-id"),
      link_kind: link.getAttribute("data-link-kind"),
      link_status: link.getAttribute("data-link-status"),
      href: link.href,
    });
  }

  async function init() {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    RevMatchAnalytics.pageView({ page: "matcher" });

    const form = $("#wizard-form");
    if (!form) return;

    form.addEventListener("focusin", onWizardFocus);
    form.addEventListener("change", onWizardFocus);
    form.addEventListener("submit", onSubmit);

    const results = $("#results");
    if (results) results.addEventListener("click", onResultsClick);

    const btn = $("#match-btn");
    try {
      catalog = await loadCatalog();
      form.querySelectorAll("select").forEach((el) => {
        el.disabled = false;
      });
      if (btn) btn.disabled = false;
      setStatus("Ready — three picks, then Match programs.");
    } catch (err) {
      setStatus(err.message || "Failed to load catalog", true);
      if (btn) btn.disabled = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
