# Open questions — resolve before design (Opus phase)

Answer these, then run the architecture/design pass on Opus (`/model opus`).

1. **Google vs Microsoft 365.** Spec assumes Gmail + Google Calendar + Google Docs/Sheets/Slides. Connectors seen in the dev environment: Microsoft 365 (Outlook mail/calendar, Teams, SharePoint) and Google Drive only. Which ecosystem is real for mail and calendar? Docs/Sheets/Slides stay Google?
2. **Rendering mechanism.** Anthropic's documented mechanism is MCP Apps: server declares a `ui://` resource linked to a tool via `_meta.ui.resourceUri`; Claude renders it in a sandboxed iframe inline in the conversation. The spec's "URL in a side window" is not a documented generic behaviour. Validate against the MCP Apps docs and decide.
3. **Auth / tenancy.** Single user (only you) or multiple CantabPI users? Drives RLS and schema.
4. **Skills trust model.** `skills.guideline` is read back into model context. Who may write it? Treat as trusted config or untrusted data?
5. **"Oria"** in the ppt use case — typo or a product? Clarify the integration target.
6. **Label scheme.** Format per entity (`todo:12`, `lead:7`, ...)? Per-entity counters (concurrency-safe)? Stable after delete?

## Feasibility spike (cheap, de-risks #2)
Before the full schema: deploy one trivial MCP edge function with a single tool + `ui://` resource, connect it as a custom connector in claude.ai, confirm what renders on desktop and mobile.
