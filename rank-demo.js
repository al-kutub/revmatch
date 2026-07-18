#!/usr/bin/env node
/**
 * Console smoke demo for RevMatch ranking.
 * Usage: node rank-demo.js
 */
const fs = require("fs");
const path = require("path");
const { rank, acceptHandoffRow } = require("./rank.js");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "programs.json"), "utf8"));

const samples = [
  { traffic: "under_10k", niche: "tech", geo: "us" },
  { traffic: "10k_100k", niche: "lifestyle", geo: "uk_eu" },
  { traffic: "100k_1m", niche: "finance", geo: "us" },
  { traffic: "1m_plus", niche: "general", geo: "global" },
];

console.log(`Catalog: ${catalog.programs.length} programs\n`);

let failed = false;
for (const sample of samples) {
  const results = rank(catalog, sample.traffic, sample.niche, sample.geo, { topN: 5 });
  const ids = results.map((r) => r.program_id);
  const again = rank(catalog, sample.traffic, sample.niche, sample.geo, { topN: 5 }).map(
    (r) => r.program_id,
  );
  const stable = ids.join(",") === again.join(",");
  if (!stable || results.length < 3 || results.length > 5) {
    failed = true;
    console.error("FAIL", sample, { ids, stable, n: results.length });
  } else {
    console.log(
      `OK  ${sample.traffic} × ${sample.niche} × ${sample.geo} → [${ids.join(", ")}]`,
    );
  }
}

// Handoff drop-in shape check
const handoff = {
  program_id: "propellerads",
  name: "PropellerAds",
  lane: "display_ppc",
  tier: "beginner",
  referral_url: "https://example.com/ref/revmatch-propeller",
  link_status: "live",
  tracking: {
    utm_source: "revmatch",
    utm_medium: "referral",
    utm_campaign: "phase1",
    ref: "revmatch",
  },
  payout_notes: "test",
  join_url: "https://propellerads.com/",
};
const check = acceptHandoffRow(handoff);
if (!check.ok) {
  failed = true;
  console.error("Handoff schema FAIL", check.errors);
} else {
  console.log("OK  handoff row accepted (live referral_url drop-in)");
}

// Catalog integrity
const beginners = catalog.programs.filter((p) => p.tier === "beginner");
const mids = catalog.programs.filter((p) => p.tier === "mid" || p.tier === "advanced");
const lanes = new Set(catalog.programs.map((p) => p.lane));
const liveFabricated = catalog.programs.filter(
  (p) => p.link_status === "live" && p.referral_url,
);
if (catalog.programs.length < 8) {
  failed = true;
  console.error("FAIL need ≥8 programs");
}
if (!lanes.has("display_ppc") || !lanes.has("product_affiliate")) {
  failed = true;
  console.error("FAIL both lanes required");
}
if (beginners.length < 1 || mids.length < 1) {
  failed = true;
  console.error("FAIL need beginner + mid/advanced");
}
if (liveFabricated.length > 0) {
  failed = true;
  console.error("FAIL fabricated live referral URLs present");
}
console.log(
  `OK  integrity: n=${catalog.programs.length} beginner=${beginners.length} mid+=${mids.length} lanes=${[...lanes].join("+")} live_refs=${liveFabricated.length}`,
);

if (failed) {
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
