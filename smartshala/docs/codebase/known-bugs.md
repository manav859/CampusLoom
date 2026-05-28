# Known Bugs

| # | Bug | Severity |
|---|-----|----------|
| 1 | ⚠️ **No known critical bugs** — the attendance source-of-truth bug was fixed (per checklist) | — |
| 2 | Frontend middleware rewrite may have edge cases with nested tenant paths | Low |
| 3 | DB warmup scheduler uses `setInterval` — could leak timers on hot reload in dev | Very Low |
