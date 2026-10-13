# Cantab OS

Backend-only operating system for a consulting / small business / biotech: Supabase DB + MCP edge function. First host is claude.ai (MCP connector); ChatGPT later. See [docs/spec.md](docs/spec.md) for the full spec and [docs/open-questions.md](docs/open-questions.md) for unresolved decisions.

## Model policy (important)

- Architectural decisions are reserved for Opus or higher: DB schema, MCP tool/resource contracts, auth/RLS model, UI-rendering mechanism, anything costly to change later.
- Claude must ALWAYS hint the user to switch (`/model opus`) before making or locking in such decisions, and proactively suggest other situations that warrant a switch. Claude cannot switch models itself.
- Implementation of an already-approved design (migrations, edge-function code, dummy data, scaffolding) is fine on Sonnet.

## Resources

- GitHub: Cantab-dev/cantabpi-os
- Supabase project id: etofljbxzllkucmearwl
- Repo (code and project files): C:\dev\cantabpi-os
- SharePoint "CantabPI - XCO001 - Consulting/Cantabpi-OS": handoff, analysis and other documentation only; never put the repo or .git there

## Conventions

- Do not push or deploy without explicit user approval.
- Secrets never go in the repo; use Supabase secrets / local .env (git-ignored).
