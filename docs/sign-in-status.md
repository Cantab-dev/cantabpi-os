# Cantab OS — Sign-in and access: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Draft | v0.1 | Nela | 2026-10-14 |

This document is both the plan and the record of what exists. Each item has a status; update the
status in the same change that builds the item.

Status values: `planned` (agreed, not built) · `built` (deployed and checked live) · `changed` (built,
then altered; note what changed) · `open` (needs a decision).

## Scope

Connect claude.ai (and Claude Code) to Cantab OS as the signed-in user, through Supabase Auth's OAuth
2.1 server, with Row Level Security deciding which rows each user sees. This replaces the shared
development key and the acting user. It follows Supabase's current guide for MCP servers on Edge
Functions (`@supabase/server`, `@supabase/middleware`); the legacy approaches are not used.

Not in scope: shared or workspace data, roles, per-client tokens, a call log, in-host views.

Already done (2026-10-14): the consent app at `https://cantabpios.lovable.app` (Lovable, see
[COMMS.md](COMMS.md)); in Supabase Auth, the OAuth server is on with path `/oauth/consent`, dynamic
client registration is on, new-user sign-ups are off, and the Site URL points to the consent app. The
project signs tokens with ES256.

## How a call works after this change

1. claude.ai calls the MCP URL without a token and gets a 401 that points it to the server's OAuth
   metadata.
2. claude.ai registers itself (dynamic registration) and sends the user to Supabase Auth, which
   redirects to the consent app. The user signs in there and clicks Approve.
3. claude.ai calls the MCP URL with the user's access token. `withSupabase` checks the token and
   gives the tools a database client that acts as that user.
4. RLS limits every read and write to rows where `profile_id` is the user. The tools don't filter
   by owner themselves.

## Database

### profiles — `planned`
- New table `public.profiles`: `id uuid` primary key referencing `auth.users(id)` on delete cascade,
  `email text`, `display_name text`, `created_at`, `updated_at`.
- A trigger on `auth.users` creates the profile when a user is created. The three existing users are
  backfilled.
- RLS: a user can read and update their own profile only.

### Owner column — `planned`
- On all six tables, `owner_id` is renamed `profile_id`, following the agreed naming (primary key
  `id`, foreign key `<table>_id`).
- It references `public.profiles(id)`, is `not null`, and defaults to `auth.uid()`, so a new row
  belongs to whoever creates it. All existing rows already have an owner.
- Indexed, because every policy checks it.

### RLS policies — `planned`
- On each of the six tables, one policy for the `authenticated` role covering all operations:
  `(select auth.uid()) = profile_id` in both `using` and `with check`. A user can't read, change or
  delete another user's rows, or move a row to someone else.
- `anon` gets nothing.

### Functions the tools rely on — `planned`
- `next_label` becomes `security definer` and is granted to `authenticated`, so a signed-in user's
  insert can take the next label without direct access to the sequences.
- `append_context` drops its owner argument and runs as the caller (`security invoker`), so RLS
  decides which rows `note` can touch. Granted to `authenticated`.
- Labels stay unique across the whole database. A user sees gaps in the numbers where other users'
  rows are.

## MCP function — `planned` (v0.4.0)

- `index.ts` follows Supabase's MCP block: `pipeline([withOAuthProtectedResource(),
  withSupabase({ auth: 'user', cors })], handleMcp)`, with a fresh server per request bound to the
  user's client. Dependencies: `npm:@supabase/server@1` (1.6.0 or later) and `npm:@supabase/middleware@1`.
  The MCP SDK stays at 2.0.0.
- Removed: the development-key check, the service-role client, `CANTAB_DEV_KEY` and
  `CANTAB_ACTING_USER_ID`.
- `tools.ts`: the owner filter and the owner stamp on `write_*` are removed (RLS and the column
  default replace them). `note` calls `append_context` without an owner. The tools, arguments and
  messages stay the same.
- Server instructions say that every tool acts as the signed-in user.
- `config.toml`: `[functions.mcp] verify_jwt = false` stays, because the function checks the token itself.

## Testing — `planned`

| Check | How |
|---|---|
| Unit tests still pass | `deno test` |
| No token → 401 with a `WWW-Authenticate` header pointing to the OAuth metadata | `smoke.sh` |
| The OAuth metadata names Supabase Auth as the authorisation server | `smoke.sh` |
| All tool checks pass as `claude@test.com`, who sees only their own 15 rows | `smoke.sh`, signing in with the test user's password from the git-ignored `.env.local` |
| As Nela, `list` shows her own rows; Claude's labels return "not found" | `smoke.sh` second pass, or a Claude Code session as Nela |
| A direct Data API call with Nela's token can't read Claude's rows | `smoke.sh` |
| Claude Code connects through OAuth (`/mcp` → authenticate) | Nela |
| claude.ai connects as Nela: Settings → Connectors → Add custom connector, URL only | Nela |
| Siniša connects and sees none of Nela's rows | Siniša |

## Rollout order

1. **Nela:** add the test user's password to `.env.local` as `CANTAB_TEST_PASSWORD`. Claude never
   reads it into chat.
2. **Claude:** build the migration, the function and `smoke.sh`, and run the unit tests locally.
3. **Nela:** run `npx supabase db push`, then straight away `npx supabase functions deploy mcp`.
   The migration renames `owner_id`, so v0.3.0 stops working the moment it lands. No tool works
   until the deploy.
4. **Claude:** run `smoke.sh` live and clean up the test rows.
5. **Nela:** re-add Claude Code without the key header, then authenticate through `/mcp`.
6. **Nela:** connect claude.ai as Nela, then Siniša for the negative test.
7. **Nela, once both are connected:** turn **off** dynamic client registration, then run
   `npx supabase config pull`. It has to be after both, because each client registers itself once.
8. **Nela:** remove the secrets `CANTAB_DEV_KEY` and `CANTAB_ACTING_USER_ID`
   (`npx supabase secrets unset …`).

## Risks

- **Claude Code and the testing guide change.** The development-key route stops working. The
  testing guide needs rewriting for OAuth.
- **Direct Data API access.** Once `authenticated` has table access, a signed-in user could also
  call Supabase's Data API with their token. RLS still limits them to their own rows, but they could
  change a label. Suggestion 7 in `tools-status.md` (a rule that refuses label changes) closes that.
- **Consent app address.** Each Lovable rename breaks sign-in until the Site URL and Redirect URLs are
  changed too.
- **Dynamic registration window.** Any MCP client can register while it's on; a user still has to
  approve it.

**Changelog** (rationale in DECISIONS.md; file history in git)
- v0.1 (2026-10-14) — Plan drafted: profiles, `profile_id`, RLS, function switched to `@supabase/server`. → DECISIONS.md 2026-10-14
