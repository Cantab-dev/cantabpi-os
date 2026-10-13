# Cantab OS — Architecture proposal (DRAFT, 2026-10-13)

Status: proposal for review. Nothing here is built. Items marked **DECIDE** need an answer from Nela before implementation.

## 1. Platform facts this design rests on

Checked against Anthropic and Supabase documentation on 2026-10-13.

| Topic | Fact | Consequence |
|---|---|---|
| In-host UI | The mechanism is **MCP Apps**. The server registers an HTML resource under a `ui://` URI (`text/html;profile=mcp-app`) and links a tool to it with `_meta.ui.resourceUri`. The host renders that HTML in a sandbox. | The server ships the actual view. There is no "layout suggestion" format that the host interprets. |
| Tool result | `content` (text, read by the model and by hosts without UI) plus `structuredContent` (JSON, read by the view). | Every tool returns both. Hosts without MCP Apps (Claude Code, others) still work as text. |
| Display modes | `inline` card, inline carousel, `fullscreen`, `pip`. No side panel. Inline cards: no nested scroll, max ~2 actions, ~5 data points. | The closest thing to the spec's "side window" is fullscreen. |
| External pages | `frameDomains` (embedding third-party iframes) is restricted in Claude. All external origins are blocked unless declared in `_meta.ui.csp`. | A Google Doc/Sheet/Slide cannot be shown inside the view. It can only be opened as a link. |
| Mobile | Rendered in a native WebView; connector must first be added on web or desktop. | Same views work on mobile if built responsive from 320px. |
| Connector auth | claude.ai connects from Anthropic's servers over Streamable HTTP and supports OAuth with dynamic client registration. | The MCP server must be public HTTPS and OAuth-protected. |
| Supabase | Supabase Auth can act as the OAuth 2.1 server. `@supabase/server` gives `withOAuthProtectedResource()` and `withSupabase({ auth: 'user' })`, so tools run with the user's JWT and RLS applies. Needs asymmetric JWT keys, dynamic registration on, `verify_jwt = false` on the function, and **a hosted consent page**. | "Backend only" needs one exception: a small static sign-in/consent page. |
| Edge Functions | Stateless, one request at a time, no sampling. | No server-side session state; all state in Postgres. |

## 2. Components

1. **Postgres (Supabase)** — tables, RLS, label function.
2. **Edge function `mcp`** — the MCP server: tools + `ui://` view resources. URL `https://etofljbxzllkucmearwl.supabase.co/functions/v1/mcp`.
3. **Supabase Auth** — users, OAuth 2.1 server for hosts.
4. **Consent page** — one static page (sign in, approve the host). Not an application front end. **DECIDE** where to host it (Cloudflare Pages, Vercel or GitHub Pages).
5. **Supabase Storage** — PDF copies of slides.

## 3. Tenancy and access — **DECIDE**

Recommended: **workspace model**.

- `workspaces (id, name)` and `workspace_members (workspace_id, user_id, role)` with roles `admin` and `member`.
- Every entity row carries `workspace_id`. RLS: a user sees rows of workspaces they belong to.
- **Todos are personal**: also carry `owner_id`; only the owner sees them.
- **Leads, documents and skills are shared** in the workspace. Members read and write leads and documents. Skills are admin-write (safe default until the trust model is decided).
- A user with one workspace never has to name it; the server resolves it.

Alternative: no workspaces, one Supabase project per organisation. Simpler now, but serving a second organisation then means a second deployment. Adding `workspace_id` later means rewriting every table, policy and label, so I recommend paying for it now.

**DECIDE** sign-in method for users: Google, Microsoft or email magic link.

## 4. Data model

Changes from the spec are marked ▲.

- **todos**: `label, name, category, due (date), importance (1-3), done (bool), owner_id`
- **leads**: `label, name, full_name, email, url_linkedin`
- **documents** ▲: `label, kind (sheet | doc | slide), name, url, storage_url (slides only)`. One table instead of three identical ones. Labels and tools stay per kind (`sheet:3`, `doc:8`, `slide:2`).
- **skills**: `label, description, guideline`
- **notes** ▲: `label, text, author_id, created_at`. The `context` of a record is its notes in order. Replaces a single text column that every write would have to read and rewrite; with several users that loses updates and loses authorship.
- **label_counters**: `workspace_id, entity, last_n`.
- All entity tables: `id, workspace_id, created_at, updated_at, archived_at` ▲.

**Labels**: `<entity>:<n>`, unique per workspace, allocated by one SQL function that atomically increments `label_counters`. Numbers are never reused, so labels stay stable after delete. The prefix tells `get` and `note` which table to use.

## 5. Tools

| Tool | Arguments | Notes |
|---|---|---|
| `list` | `entity`, optional `include_done` / `include_archived` | Returns all columns except id and context. Todos default to open only ▲. |
| `get` | `labels[]` | Mixed entities allowed. Returns columns plus notes. |
| `write_todo`, `write_lead`, `write_sheet`, `write_doc`, `write_slide`, `write_skill` | entity fields, optional `label` ▲ | No label: create, label generated. With label: update the given fields. The spec had no way to mark a todo done or correct a lead. |
| `note` | `label`, `text` | Appends a note. |
| `archive` ▲ | `label` | Soft delete. The spec had no delete. |

## 6. Views (the "host view" of each tool)

Three shared `ui://` views, not one per tool:

- **list view** — used by `list`. Compact rows per entity; todos get a done toggle (calls `write_todo` from the view). Inline; fullscreen button when long.
- **record view** — used by `get` and all `write_*`, `note`, `archive`. One card: key fields, latest notes, and an **Open** link for documents and LinkedIn.
- **slide view** (later) — fullscreen PDF from Supabase Storage. This is the only case where a document can be shown inside the host, because the PDF is ours.

Text entry stays in chat, per the host's design guidelines; views only toggle, open and confirm.

## 7. What changes versus the original spec

1. No side window. Google files open as links in a new tab; own PDFs can be shown fullscreen.
2. Views are HTML shipped by Cantab OS, not layout hints.
3. One small hosted consent page is required.
4. Schema: single `documents` table, `notes` table, `archived_at`, workspace columns.
5. Tools: update through `write_*` with a label, plus `archive`.

## 8. Build order

1. **Spike A (rendering)**: authless edge function, one tool, one view. Add as a custom connector; check claude.ai web, desktop and mobile. No data involved.
2. **Spike B (auth)**: enable OAuth server, signing keys, consent page; confirm the connector signs in and a tool sees the user's id.
3. Migrations: tables, RLS, label function. Dummy data.
4. Tools and the two views.
5. Slide view, skills workflows.

Prerequisite for step 1: Supabase CLI access to the project (`npx supabase login`).

## Sources

- https://claude.com/docs/connectors/building/mcp-apps/quickstart.md
- https://claude.com/docs/connectors/building/mcp-apps/design-guidelines.md
- https://claude.com/docs/connectors/building/mcp-apps/getting-started.md
- https://supabase.com/docs/guides/ai-tools/byo-mcp.md
- https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- https://support.claude.com/en/articles/11503834
