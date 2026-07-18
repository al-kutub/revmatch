#!/usr/bin/env node
/**
 * Ticket 3 smoke: UTM on join_cta + live paths, ranking still green.
 * Usage: node t3-smoke.js
 */
const fs = require("fs");
const path = require("path");
const { rank, withTracking, acceptHandoffRow } = require("./rank.js");
const analytics = require("./analytics.js");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "programs.json"), "utf8"));
let failed = false;

function assert(cond, msg) {
  if (!cond) {
    failed = true;
    console.error("FAIL", msg);
  } else {
    console.log("OK ", msg);
  }
}

const tracking = {
  utm_source: "revmatch",
  utm_medium: "referral",
  utm_campaign: "phase1",
  ref: "revmatch",
};

const joinProg = catalog.programs.find((p) => p.link_status === "join_cta" && p.join_url);
assert(!!joinProg, "catalog has join_cta program");
const joinTracked = withTracking(joinProg.join_url, tracking);
assert(joinTracked.includes("utm_source=revmatch"), "join_cta gets utm_source");
assert(joinTracked.includes("utm_medium=referral"), "join_cta gets utm_medium");
assert(joinTracked.includes("utm_campaign=phase1"), "join_cta gets utm_campaign");
assert(joinTracked.includes("ref=revmatch"), "join_cta gets ref");

const liveUrl = "https://example.com/ref/revmatch-demo?existing=1";
const liveTracked = withTracking(liveUrl, tracking);
assert(liveTracked.includes("utm_source=revmatch"), "live path gets utm_source");
assert(liveTracked.includes("existing=1"), "live path preserves existing params");
assert(liveTracked.includes("utm_campaign=phase1"), "live path gets campaign");

const handoff = {
  program_id: joinProg.program_id,
  name: joinProg.name,
  lane: joinProg.lane,
  tier: joinProg.tier,
  referral_url: liveUrl,
  link_status: "live",
  join_url: joinProg.join_url,
  tracking,
  payout_notes: "smoke",
};
assert(acceptHandoffRow(handoff).ok, "live handoff row accepted");

const ranked = rank(catalog, "under_10k", "tech", "us", { topN: 5 });
assert(ranked.length >= 3 && ranked.length <= 5, `rank returns 3–5 (got ${ranked.length})`);

const guideDir = path.join(__dirname, "guides");
for (const p of catalog.programs) {
  const g = path.join(guideDir, `${p.program_id}.html`);
  assert(fs.existsSync(g), `guide exists: ${p.program_id}`);
}
assert(fs.existsSync(path.join(guideDir, "index.html")), "guides index exists");

assert(Array.isArray(analytics.EVENT_NAMES), "analytics EVENT_NAMES exported");
for (const name of ["page_view", "wizard_start", "wizard_complete", "referral_click"]) {
  assert(analytics.EVENT_NAMES.includes(name), `event documented: ${name}`);
  analytics.track(name, { smoke: true });
}
assert(
  globalThis.__rmEvents && globalThis.__rmEvents.length >= 4,
  "analytics buffer records events",
);

if (failed) {
  console.error("\nT3 smoke FAILED");
  process.exit(1);
}
console.log("\nT3 smoke PASSED");
