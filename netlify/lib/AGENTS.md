# Shared pure modules (netlify/lib/)

## Overview

Pure, unit tested logic for Meet Sera: offers, call variables, login rules, the Vapi squad helpers, the report pipeline and the OpenAI client. `server/index.js` imports these. The `netlify/functions/sera-*` files next to them are legacy and not used in production.

## Key files

| File | Owns |
|---|---|
| openai.js | OpenAI Responses API client (`generateJson`, strict JSON schema, model `gpt-5.6-terra`) |
| seraVapi/ | Vapi call creation, reading a finished call back (`getCall`, `callToEndOfCall`), offer handoff control messages, resumable round timers (`planForResume`), webhook parsing. `index.js` is server only; `clientEvents.js` and `squad.js` are browser safe |
| seraOffers/ | Builds and validates the 3 offers from the résumé |
| seraReport/ | Scoring, report assembly, truth checks, PDF render (`pdfAssets.node.js` loads logo and Noto fonts) |
| seraLogin/, seraCall/ | Login rules, first name cleanup, per round variables and summaries |
| fixtures/ | Sample transcripts, offers and résumé used by tests and the sample PDF |
| gemini.js, eligibilityStore.js | Unused legacy (Gemini, Netlify Blobs) |

## Commands

```bash
npm test                  # node --test over netlify/lib and server
npm run sample:pdf        # render docs/samples/sera-report-sample.pdf from fixtures
```

## Conventions

- Keep modules pure: no env reads, no network, except `openai.js`, `seraVapi/call.js` and `pdfAssets.node.js`. Callers pass an `llmCall` function in.
- A module imported by the browser must not import Node APIs or read env (`clientEvents.js`, `squad.js`, `src/shared/*`).
- Tests sit beside the code as `*.test.js` and use `node:test` with `node:assert/strict`.
- Use fixtures for tests. Never call real Vapi, OpenAI or R2 from a test.
- Offers come only from the candidate's résumé. No canned offers.

## Gotchas

- `pdfjs-dist` is ESM only; `netlify.toml` marks it external for the old Netlify bundle.
- `openai.js` sends `strict: true` JSON schemas, so the model output must match the schema exactly.

## Related specs

- [docs/sera-report-spec.md](../../docs/sera-report-spec.md)
- [docs/sera-interview-contract.md](../../docs/sera-interview-contract.md)
- [docs/sera-vapi.md](../../docs/sera-vapi.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
