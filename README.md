# Cantab OS

Backend-only operating system for a consulting / small business / biotech, exposed to AI hosts (claude.ai first) as an MCP server on Supabase.

- Spec: [docs/spec.md](docs/spec.md)
- What is built: [docs/data-structure-status.md](docs/data-structure-status.md), [docs/tools-status.md](docs/tools-status.md)
- Decisions: [docs/DECISIONS.md](docs/DECISIONS.md) · Open questions: [docs/open-questions.md](docs/open-questions.md)
- Rules for Claude and other agents: [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md)

## Layout

- `supabase/migrations/` — SQL migrations (schema, auto-label function)
- `supabase/functions/` — MCP edge function(s)
- `docs/` — spec, plan-and-status docs, decisions, document rules
- `.claude/` — Claude Code settings and the doc-hygiene hook
