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
| Consent app: sign-in page and `/oauth/consent`; live view page `/v/:slot` (since 2026-10-21) | Lovable | Lovable project; its own GitHub repo if connected |

Lovable never changes the Supabase project: no Lovable Cloud, no Supabase integration, no migrations,
no edge functions. It calls Supabase from the browser with the public (publishable) key, always as the signed-in user: Auth, and since 2026-10-21 (live views) table reads, database functions, Storage signed URLs and Realtime.

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

## 2026-10-14 — Nela: consent app address changed [RESOLVED]

The app's address is now **https://cantabpios.lovable.app**, which replaces `happy-sync-beam` and the
short-lived `cantabpi`. Claude checked it: `/` and `/oauth/consent` both return 200. Open until the
Supabase Site URL and Redirect URLs use this address.

Dynamic client registration is on only until claude.ai has connected once (Nela, 2026-10-14). New-user
sign-ups are off. The consent app has no sign-up page and needs none.

## 2026-10-15 — Claude: show who is signed in, and let them sign out [OPEN]

**Why:** the only place to sign out is the consent page. Once someone has signed in, the browser keeps
the Supabase session, so connecting or reconnecting a connector goes straight through as the last user
(Nela saw this on 2026-10-15). Testers switch between accounts (Nela, Siniša, `claude@test.com`) and need
to see who they are signed in as and change it.

**Need:**
1. A header on every page: "Signed in as <email>" and a **Sign out** button when signed in; a link to
   `/login` when not.
2. On `/oauth/consent`, next to the approve buttons: "Not you? Sign out". It signs out and returns to
   `/login` with the same `authorization_id`, so the connect flow carries on as the other user.
3. Sign out with `supabase.auth.signOut({ scope: 'local' })`. The default (global) revokes every session
   of the user, which may include the access claude.ai holds and would disconnect it without warning.
   Signing out of this site should end only this browser's session.

**Not in this request:** removing claude.ai's access. That stays **Disconnect** in claude.ai. A
"connected apps" page that revokes access may follow later.

Unchanged: no Lovable Cloud, no Supabase integration, publishable key only.

**Reply needed:** the change is published, and sign-out uses the local scope.

## 2026-10-16 — Lovable via Nela: sign-out implemented [RESOLVED]

Answers "show who is signed in, and let them sign out" (2026-10-15). Nela reports the sign-out is
implemented. Not yet confirmed: that it signs out with the local scope, and that the consent page has the
"Not you? Sign out" link. Nela confirms those two details; the request entry stays `[OPEN]` until then.

## 2026-10-16 — Claude: weekly sweep closes the address entry [RESOLVED]

Closes "consent app address changed" (2026-10-14): the Supabase Site URL and Redirect URLs use
`cantabpios.lovable.app` and sign-in works. Its line saying dynamic client registration is on only until
claude.ai has connected once is superseded: it stays on (DECISIONS.md, 2026-10-15).

## 2026-10-21 — Claude: live view page `/v/:slot` [OPEN]

**Why:** Cantab OS is adding live views (plan: `docs/live-views-status.md`). An assistant in claude.ai calls a
`view` tool, and a page the user keeps open in the Claude desktop app's browser pane follows it in about a
second, with no reload: a slide's PDF at a given page, or a fixed sales dashboard. The page holds no state of
its own. Each view is a row in `ui_views`; the page renders that row and follows it through Supabase Realtime.
It lives in this app because users are already signed in here (decision of 2026-10-21; may move after the POC).

**Boundary change:** until now this app only called Supabase Auth. The page also reads tables, calls database
functions (`rpc`), signs Storage URLs and subscribes to Realtime, always as the signed-in user, with the
publishable key. Unchanged: no Lovable Cloud, no Supabase integration, no service key, no migrations, no
direct writes to any table.

**Need:** one route, `/v/:slot`, slot 1 to 10.

1. **Sign-in.** If no session, go to `/login` and come back to the same `/v/N` after signing in.
2. **Load.** `rpc('view_open', { p_slot })` returns `{status: 'empty', slot}` or `{status: 'ok', view}`, where
   `view` = `{slot, template, agent_params, ui_params, version, last_writer, last_active_at}`. Call it again
   when the tab becomes visible and after a Realtime reconnect.
3. **Follow.** Subscribe to `postgres_changes` on `public.ui_views` (all events, filter
   `profile_id=eq.<user id>`). Act only on rows whose `slot_no` is this slot. On insert or update, take the
   new row if its `version` is higher than the one shown. A delete carries only the old `id`: if it is the
   shown row's id, show the empty state.
4. **Empty state:** "View N is empty. Ask Claude to show something here." Unknown template: "This view needs
   a newer page."
5. **Header:** "View N", and a small "Updated by Claude" when `last_writer` is `agent`.
6. **Template `pdf`.** `agent_params.slide_id` and `ui_params.page` (default 1).
   - Read `name, storage_url` from `slides` where `id` = slide_id. `storage_url` looks like
     `https://…/storage/v1/object/slide-pdfs/<user id>/slide-5.pdf`; the part after `slide-pdfs/` is the path.
   - `storage.from('slide-pdfs').createSignedUrl(path, 3600)`. Re-sign after 50 minutes, and when the slide
     row changes (Realtime update on `public.slides`, filter `id=eq.<slide_id>`).
   - Show it full-height in an `<iframe>` with `#page=<page>`. Remount the iframe when the page changes; a
     hash change alone may not move the PDF viewer.
   - Always show an "Open PDF" link to the signed URL (Safari and iOS cannot show PDFs in an iframe).
   - Previous / next buttons and the page number. A change calls
     `rpc('view_update', { p_slot, p_expected_version: version, p_ui_patch: { page } })`.
7. **Template `dashboard`.** `agent_params.dashboard` is `sales_overview` (the only key for now), and
   `agent_params.filters` is `{period?, region?}`.
   - Data: `rpc('dashboard_sales_overview', { p_period: filters.period ?? '30d', p_region: filters.region ?? null })`.
     It returns `{period, region, from, to, tiles: {revenue, deals, avg_deal}, by_week: [{week, revenue}],
     breakdown: {by: 'region' | 'product', rows: [{key, revenue}]}}`.
   - Fixed layout, top to bottom:
     - title "Sales overview" with the date range;
     - two selects, period (7d, 30d, qtd, ytd) and region (All, emea, amer, apac);
     - three tiles: Revenue, Deals, Average deal (amounts in EUR, thousands separators);
     - a line chart of revenue by week;
     - a bar chart of `breakdown.rows`, titled "By region" or "By product".
   - A select change calls `rpc('view_update', { p_slot, p_expected_version: version, p_agent_patch: { filters } })`
     with the **whole** filters object (the merge is shallow; leave `region` out for All).
   - Refetch when `public.demo_sales` changes (Realtime, filter `profile_id=eq.<user id>`), at most once per
     400 ms.
8. **Writes and conflicts.** `view_update` returns `{status: 'ok', view}`, `{status: 'conflict', view}` (someone,
   usually Claude, changed it first) or `{status: 'gone'}`.
   - On conflict, show the returned view. For a page change, retry once on the new version.
   - For a filter change, don't retry: show "Claude changed this view; your change was not applied" next to
     the control.
   - Errors (`invalid_parameter: …`) also show next to the control, never as a toast.
9. **Never** write to `ui_views`, `slides` or `demo_sales` directly: the functions are the only way in.

**First check (spike, step 0):** in the Claude desktop app's browser pane, `/v/1` stays signed in and updates
when Claude calls `view`. Nela checks this as soon as the page is published.

**Reply needed:** the page is published at `https://cantabpios.lovable.app/v/1`, plus anything in this spec that
did not work as written.
