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
| `README.md` | This file |

## Scope (Phase 1 Ticket 1)

In: public repo, landing, Pages URL, disclosure footer stub.  
Out: ranking engine, catalog, full wizard, Phase 2 travel microsite, auth, LLM.
