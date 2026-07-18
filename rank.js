/**
 * RevMatch ranking — deterministic, table/rule driven (no LLM).
 * Inputs: traffic tier × niche × geo → ordered top N programs.
 *
 * Browser: <script src="rank.js"></script> then RevMatchRank.rank(...)
 * Node:    node rank-demo.js
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RevMatchRank = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TRAFFIC_TIERS = ["under_10k", "10k_100k", "100k_1m", "1m_plus"];
  const NICHES = ["tech", "finance", "health", "lifestyle", "general"];
  const GEOS = ["us", "uk_eu", "global"];
  const DEFAULT_TOP_N = 5;

  const TRAFFIC_INDEX = Object.fromEntries(TRAFFIC_TIERS.map((t, i) => [t, i]));

  function assertEnum(value, allowed, label) {
    if (!allowed.includes(value)) {
      throw new Error(`Invalid ${label}: "${value}". Expected one of: ${allowed.join(", ")}`);
    }
  }

  function normalizeCatalog(catalog) {
    if (!catalog || !Array.isArray(catalog.programs)) {
      throw new Error("Catalog must include a programs[] array");
    }
    return catalog.programs;
  }

  /**
   * Score one program for the given inputs. Higher is better.
   * Stable tie-break: program_id ascending (applied in rank()).
   */
  function scoreProgram(program, traffic, niche, geo) {
    let score = 0;
    const reasons = [];

    const fit = Array.isArray(program.traffic_fit) ? program.traffic_fit : [];
    if (fit.includes(traffic)) {
      score += 40;
      reasons.push("traffic_fit");
    } else {
      // Soft penalty — still rankable so the list is never empty of near-misses
      const want = TRAFFIC_INDEX[traffic];
      const distances = fit
        .map((t) => TRAFFIC_INDEX[t])
        .filter((i) => typeof i === "number")
        .map((i) => Math.abs(i - want));
      const nearest = distances.length ? Math.min(...distances) : 3;
      score += Math.max(0, 20 - nearest * 10);
      reasons.push("traffic_near");
    }

    // Tier alignment with traffic volume
    const tier = program.tier;
    if (traffic === "under_10k" || traffic === "10k_100k") {
      if (tier === "beginner") {
        score += 20;
        reasons.push("beginner_for_low_traffic");
      } else if (tier === "mid") {
        score += 8;
      } else if (tier === "advanced") {
        score -= 15;
        reasons.push("advanced_too_early");
      }
    } else if (traffic === "100k_1m") {
      if (tier === "mid") {
        score += 20;
        reasons.push("mid_for_growth");
      } else if (tier === "beginner") {
        score += 12;
      } else if (tier === "advanced") {
        score += 10;
      }
    } else {
      // 1m_plus
      if (tier === "advanced" || tier === "mid") {
        score += 20;
        reasons.push("scale_tier");
      } else {
        score += 8;
      }
    }

    const niches = Array.isArray(program.niches) ? program.niches : [];
    if (niches.includes(niche)) {
      score += 25;
      reasons.push("niche_match");
    } else if (niches.includes("general")) {
      score += 10;
      reasons.push("niche_general");
    } else {
      score -= 5;
    }

    const geos = Array.isArray(program.geos) ? program.geos : [];
    if (geos.includes(geo)) {
      score += 20;
      reasons.push("geo_exact");
    } else if (geo !== "global" && geos.includes("global")) {
      score += 10;
      reasons.push("geo_global_fallback");
    } else {
      score -= 8;
    }

    // Prefer actionable CTAs over pending; live wins when Ebrahim swaps URLs in
    if (program.link_status === "live") {
      score += 8;
      reasons.push("link_live");
    } else if (program.link_status === "join_cta") {
      score += 4;
      reasons.push("link_join_cta");
    }

    // Light lane diversity is handled post-score in rank(); keep score pure here
    return { score, reasons };
  }

  /**
   * @param {object} catalog - programs.json root
   * @param {string} traffic - traffic tier
   * @param {string} niche
   * @param {string} geo
   * @param {{ topN?: number }} [opts]
   * @returns {Array<object>} ranked program cards (top N)
   */
  function rank(catalog, traffic, niche, geo, opts) {
    assertEnum(traffic, TRAFFIC_TIERS, "traffic");
    assertEnum(niche, NICHES, "niche");
    assertEnum(geo, GEOS, "geo");

    const topN = (opts && opts.topN) || DEFAULT_TOP_N;
    const programs = normalizeCatalog(catalog);

    const scored = programs.map((program) => {
      const { score, reasons } = scoreProgram(program, traffic, niche, geo);
      return {
        program_id: program.program_id,
        name: program.name,
        lane: program.lane,
        tier: program.tier,
        link_status: program.link_status,
        referral_url: program.referral_url,
        join_url: program.join_url,
        payout_notes: program.payout_notes,
        rpm_band: program.rpm_band,
        tracking: program.tracking,
        score,
        reasons,
      };
    });

    // Stable sort: score desc, then program_id asc
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.program_id < b.program_id ? -1 : a.program_id > b.program_id ? 1 : 0;
    });

    // Prefer at least one of each lane in the top window when possible
    const picked = [];
    const used = new Set();
    const lanesNeeded = new Set(["display_ppc", "product_affiliate"]);

    for (const row of scored) {
      if (picked.length >= topN) break;
      if (lanesNeeded.has(row.lane) && !used.has(row.lane)) {
        picked.push(row);
        used.add(row.lane);
        lanesNeeded.delete(row.lane);
      }
    }
    for (const row of scored) {
      if (picked.length >= topN) break;
      if (picked.some((p) => p.program_id === row.program_id)) continue;
      picked.push(row);
    }

    // Re-sort picked by score to keep deterministic order for callers
    picked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.program_id < b.program_id ? -1 : a.program_id > b.program_id ? 1 : 0;
    });

    return picked;
  }

  /** Apply UTM/ref tracking onto a URL (for live referral links). */
  function withTracking(url, tracking) {
    if (!url || !tracking) return url;
    try {
      const u = new URL(url);
      if (tracking.utm_source) u.searchParams.set("utm_source", tracking.utm_source);
      if (tracking.utm_medium) u.searchParams.set("utm_medium", tracking.utm_medium);
      if (tracking.utm_campaign) u.searchParams.set("utm_campaign", tracking.utm_campaign);
      if (tracking.ref) u.searchParams.set("ref", tracking.ref);
      return u.toString();
    } catch {
      return url;
    }
  }

  /**
   * Validate that a handoff row can drop in without reinterpretation.
   * Returns { ok, errors[] }.
   */
  function acceptHandoffRow(row) {
    const errors = [];
    const required = ["program_id", "name", "lane", "tier", "link_status"];
    for (const key of required) {
      if (row[key] == null || row[key] === "") errors.push(`missing ${key}`);
    }
    if (row.link_status && !["live", "pending", "join_cta"].includes(row.link_status)) {
      errors.push(`invalid link_status: ${row.link_status}`);
    }
    if (row.link_status === "live" && !row.referral_url) {
      errors.push("live requires referral_url");
    }
    if (row.link_status === "join_cta" && !row.join_url) {
      errors.push("join_cta requires join_url");
    }
    if (row.tracking) {
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "ref"]) {
        if (!row.tracking[k]) errors.push(`tracking.${k} required`);
      }
    } else {
      errors.push("missing tracking");
    }
    return { ok: errors.length === 0, errors };
  }

  return {
    TRAFFIC_TIERS,
    NICHES,
    GEOS,
    rank,
    scoreProgram,
    withTracking,
    acceptHandoffRow,
  };
});
