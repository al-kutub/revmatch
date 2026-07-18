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
`programs.json` must be served over HTTP for the matcher (file:// fetch is blocked).

## Files

| File | Role |
|------|------|
| `index.html` | Landing — problem → wizard CTA + expandable FTC disclosure |
| `app.html` | Matcher wizard → ranked cards |
| `app.js` | Wizard UI, results render, CTA + UTM wiring |
| `analytics.js` | Client events (`page_view`, `wizard_start`, `wizard_complete`, `referral_click`) |
| `styles.css` | Mobile-usable layout |
| `programs.json` | Seed catalog (drop-in live URL swap via `referral_url` + `link_status: live`) |
| `rank.js` | Deterministic ranking (`traffic × niche × geo` → top 3–5) |
| `rank-demo.js` | Console smoke demo + schema checks |
| `guides/` | Short integration guide per program |
| `README.md` | This file |

## Analytics events

Events fire client-side (buffered on `window.__rmEvents`; optional `dataLayer` / `gtag` if present). Append `?debug=1` to log to the console.

| Event | When |
|-------|------|
| `page_view` | Landing, matcher, or guide page loads |
| `wizard_start` | First focus/change on wizard inputs |
| `wizard_complete` | Successful match (includes traffic/niche/geo, result ids, rank_ms) |
| `referral_click` | Outbound CTA click (join or live referral), including guide CTAs |

## Outbound UTM

All outbound join/referral links get (via `RevMatchRank.withTracking`):

- `utm_source=revmatch`
- `utm_medium=referral`
- `utm_campaign=phase1`
- `ref=revmatch` (optional, always set in Phase 1 catalog)

## Live URL swap (Admin / Ebrahim)

In `programs.json`, for a program row:

1. Set `referral_url` to the live affiliate/referral URL.
2. Set `link_status` to `"live"`.
3. Keep `tracking` as-is (or adjust campaign if needed).
4. Redeploy / push to Pages — matcher CTAs switch from join → live automatically.

`join_cta` and `pending` rows keep using `join_url` with the same UTM append.

## Ranking smoke demo

```bash
node rank-demo.js
```

Example (browser console after loading `rank.js` + fetching `programs.json`):

```js
RevMatchRank.rank(catalog, "under_10k", "tech", "us", { topN: 5 });
```

## Scope

**Ticket 1:** public repo, landing, Pages URL.  
**Ticket 2:** `programs.json` + rule-driven `rank.js` (no LLM; no fabricated live referral URLs).  
**Ticket 3:** wizard UI, results cards, guides, disclosure, analytics.  
**Out:** auth/saved history, Phase 2 travel microsite, Phase 3 dashboard.
