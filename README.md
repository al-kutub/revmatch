# RevMatch

Static affiliate matcher (Phase 1). Tell us traffic tier × niche × geo — get a short ranked list of programs that fit. No auth, no backend, no build step.

**Live:** https://al-kutub.github.io/revmatch/

## Run locally

No build step. From this folder:

```bash
python3 -m http.server 5173
# then open http://localhost:5173
```

Or open `index.html` directly in a modern browser (Google Fonts need network on first load).

## Files

| File | Role |
|------|------|
| `index.html` | Landing — problem → wizard CTA + FTC disclosure stub |
| `app.html` | Matcher stub (`#wizard`) — interactive wizard lands in Ticket 3 |
| `styles.css` | Mobile-usable layout |
| `programs.json` | Seed catalog (≥8 programs, both lanes; `link_status` handoff-ready) |
| `rank.js` | Deterministic ranking (`traffic × niche × geo` → top 3–5) |
| `rank-demo.js` | Console smoke demo + schema checks |
| `README.md` | This file |

## Ranking smoke demo

```bash
node rank-demo.js
```

Example (browser console after loading `rank.js` + fetching `programs.json`):

```js
RevMatchRank.rank(catalog, "under_10k", "tech", "us", { topN: 5 });
```

## Scope

**Ticket 1:** public repo, landing, Pages URL, disclosure footer stub.  
**Ticket 2:** `programs.json` + rule-driven `rank.js` (no LLM; no fabricated live referral URLs).  
**Out:** full wizard UI (Ticket 3), Phase 2 travel microsite, auth.
