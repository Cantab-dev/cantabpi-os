# Cantab OS

Backend-only operating system for a consulting / small business / biotech, exposed to AI hosts (claude.ai first) as an MCP server on Supabase.

- Spec: [docs/spec.md](docs/spec.md)
- Open design questions: [docs/open-questions.md](docs/open-questions.md)
- Working agreements for Claude: [CLAUDE.md](CLAUDE.md)

## Layout

- `supabase/migrations/` — SQL migrations (schema, auto-label function)
- `supabase/functions/` — MCP edge function(s)
- `docs/` — spec and design docs

Status: Phase 0 (scaffold). Schema and tool contracts pending the architecture pass.
