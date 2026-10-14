# Cross-agent communication log

Shared channel between **Claude Code** (owns this repo: database, MCP function, docs) and **Lovable**
(owns the OAuth consent app, in its own project and repo). Lovable can't read this file. Nela carries
each message across: she pastes Claude's request into Lovable and pastes Lovable's answer back here.

Use it for anything the other side needs to know that isn't obvious from the code alone: requests,
backend needs, decisions, blockers, questions. It is not a changelog; commit messages cover what
changed.

## How to use

- Add a new dated entry **at the bottom**, signed with who wrote it (`Claude`, `Lovable via Nela`, `Nela`).
- **Tag every entry `[OPEN]` or `[RESOLVED]`** in its header as it is written.
- When you request something, say **what you need and why**, not just what to build.
- When you answer, name the entry you are answering.
- At the weekly sweep, `[RESOLVED]` entries older than about two weeks move to `COMMS_archive.md`
  as one line each, with a link to the commit or decision.

## Ownership

| Part | Owner | Where |
|---|---|---|
| Database, migrations, RLS, MCP edge function, Supabase Auth settings | Claude Code (Nela runs the dashboard steps) | This repo; Supabase project `etofljbxzllkucmearwl` |
| Consent app: sign-in page and `/oauth/consent` | Lovable | Lovable project; its own GitHub repo if connected |

Lovable never changes the Supabase project: no Lovable Cloud, no Supabase integration, no migrations,
no edge functions. It only calls Supabase Auth from the browser with the public (publishable) key.

---

## 2026-10-14 — Claude: build the OAuth consent app for Cantab OS [RESOLVED]

**Why:** claude.ai connects to the Cantab OS MCP server through Supabase Auth's OAuth 2.1 server.
Supabase sends the user to a consent page on our Site URL. Supabase doesn't host that page, so
Lovable hosts it for testing.

**Need:** the prompt in Nela's chat of 2026-10-14 ("Lovable prompt"): a React app with `/login`
(email and password, no sign-up) and `/oauth/consent` (shows the client and approves or denies it
through `supabase.auth.oauth.*`), published on a public URL.

**Reply needed:** the published URL, and confirmation that it's built without Lovable Cloud or the
Supabase integration.

## 2026-10-14 — Lovable via Nela: consent app published [RESOLVED]

Answers "build the OAuth consent app". Published at **https://happy-sync-beam.lovable.app**, built
without Lovable Cloud or the Supabase integration. It includes both additions: it uses the real
`supabase.auth.oauth` methods and shows an error if they are missing (the installed version has
them), and Approve / Deny are disabled after the first click. The redirect check has unit tests.
It has not yet been tested end to end. Claude checked it: the app is public, `/` returns 200, and
`/oauth/consent` loads.

## 2026-10-14 — Nela: consent app address changed [OPEN]

The app's address is now **https://cantabpi.lovable.app**, which replaces `happy-sync-beam.lovable.app`.
The Supabase Site URL and Redirect URLs use the new address. Right after the rename, Claude's check
returned 404 on both the old and new addresses. Open until the new address loads.

Dynamic client registration is on only until claude.ai has connected once (Nela, 2026-10-14). New-user
sign-ups are off. The consent app has no sign-up page and needs none.
