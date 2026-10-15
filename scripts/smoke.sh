#!/usr/bin/env bash
# Live checks against the deployed mcp function. Usage: bash scripts/smoke.sh
# Signs in as the test user (default claude@test.com) with CANTAB_TEST_PASSWORD from the git-ignored
# .env.local, and calls the tools with that user's access token. Never prints the password or token.
set -u
cd "$(dirname "$0")/.."
SB="https://etofljbxzllkucmearwl.supabase.co"
URL="$SB/functions/v1/mcp"
PUB="sb_publishable_34K6u6ySwpvniPF2qj8-sQ_LjAd6eXO" # publishable key: public by design
EMAIL="${CANTAB_TEST_EMAIL:-claude@test.com}"
PASS="$(grep '^CANTAB_TEST_PASSWORD=' .env.local | cut -d= -f2- | tr -d '\r' | sed 's/^"\(.*\)"$/\1/')"
ESC_PASS="$(printf '%s' "$PASS" | sed 's/\\/\\\\/g; s/"/\\"/g')"
TOKEN="$(curl -sS -X POST "$SB/auth/v1/token?grant_type=password" -H "apikey: $PUB" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$ESC_PASS\"}" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)"
[ -n "$TOKEN" ] || { echo "Sign-in as $EMAIL failed: check CANTAB_TEST_PASSWORD in .env.local"; exit 1; }
N=0

rpc() { # rpc <method> <params-json>
  N=$((N + 1))
  curl -sS -X POST "$URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$N,\"method\":\"$1\",\"params\":$2}" | sed 's/^data: //' | grep -v '^event:' | grep -v '^$'
}
call() { # call <tool> <arguments-json>
  echo "--- $1 $2"
  rpc tools/call "{\"name\":\"$1\",\"arguments\":$2}" | cut -c1-"${WIDTH:-600}"
  echo
}

if [ "${1:-all}" = "call" ]; then call "$2" "$3"; exit 0; fi

echo "--- signed in as $EMAIL"
echo "--- no token: status and challenge"
curl -sS -o /dev/null -D - -X POST "$URL" -H 'Content-Type: application/json' -d '{}' | tr -d '\r' | grep -i '^HTTP\|^www-authenticate'
echo "--- wrong token"
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$URL" -H 'Authorization: Bearer wrong' -H 'Content-Type: application/json' -d '{}'
META="$(curl -sS -o /dev/null -D - -X POST "$URL" -d '{}' | tr -d '\r' | grep -io 'resource_metadata="[^"]*"' | cut -d'"' -f2)"
echo "--- OAuth metadata: $META"
[ -n "$META" ] && curl -sS "$META" | grep -o '"authorization_servers":\[[^]]*\]'
echo "--- Data API without a user token (expect no rows or a refusal)"
curl -sS "$SB/rest/v1/todos?select=label" -H "apikey: $PUB"; echo
echo "--- Data API as $EMAIL (expect only their own labels)"
curl -sS "$SB/rest/v1/todos?select=label&order=label_no" -H "apikey: $PUB" -H "Authorization: Bearer $TOKEN"; echo

echo "--- tools/list (name | title)"
rpc tools/list '{}' | grep -o '"name":"[a-z_]*"\|"title":"[A-Za-z ]*"' | paste -sd' ' | sed 's/"name":/\n/g'

call list '{"entity":"todos"}'
call list '{"entity":"skills"}'
call list '{"entity":"contacts"}'
call list '{"entity":"todos","page":0}'
call list '{"entity":"todos","page":99}'
call get '{"labels":["todo:1","lead:1","skill:1","todo:999","banana","todo:1"]}'
call get '{"labels":[]}'
call get '{"labels":["todo:1","todo:2","todo:3","todo:4","todo:5","todo:6","todo:7","todo:8","todo:9","todo:10","todo:11"]}'
call write_todo '{"name":"Test - smoke todo","category":"admin","due":"2026-11-30","importance":2,"action":"Check the smoke run"}'
call write_todo '{"name":"Test - bad category","category":"test"}'
call write_todo '{"name":"Test - bad date","due":"2026-02-30"}'
call write_todo '{"name":"Test - bad importance","importance":5}'
call write_todo '{"name":"  "}'
call write_todo '{}'
call write_lead '{"name":"Test - lead","email":"not an email"}'
call write_lead '{"name":"Test - lead","full_name":"Test Person","email":"test@example.com","url_linkedin":"https://www.linkedin.com/in/example-test"}'
call write_sheet '{"name":"Test - sheet","url":"docs.google.com/x"}'
call write_sheet '{"name":"Test - sheet","url":"https://docs.google.com/spreadsheets/d/TEST"}'
call write_doc '{"name":"Test - doc","url":"https://docs.google.com/document/d/TEST"}'
call write_slide '{"name":"Test - slide","url":"https://docs.google.com/presentation/d/TEST"}'
call write_skill '{"description":"Test - skill","guideline":"Step one. Step two."}'
call write_skill '{"guideline":"no description"}'
call note '{"label":"todo:1","text":"Test note from smoke script."}'
call note '{"label":"skill:1","text":"x"}'
call note '{"label":"todo:999","text":"x"}'
call note '{"label":"todo:1","text":"   "}'
call note '{"label":"nonsense","text":"x"}'

# In-chat views (docs/chat-ux-status.md): view address on list, the view HTML, categories, filters,
# files together, and the fields every row carries.
echo "--- list declares the view; the view can be read"
VIEW="$(rpc tools/list '{}' | grep -o '"resourceUri":"ui://cantab-os/list/[0-9a-f]*"' | head -1 | cut -d'"' -f4)"
echo "$VIEW"
rpc resources/read "{\"uri\":\"$VIEW\"}" | grep -o 'text/html;profile=mcp-app\|function todos' | sort -u | paste -sd' '
call list '{"entity":"categories"}'
call list '{"entity":["docs","sheets"]}'
call list '{"entity":"todos","status":false,"importance_min":"2"}'
call list '{"entity":"leads","status":true}'
call list '{"entity":"todos","category":"nope"}'
call list '{"entity":["todos","docs"]}'

# edit and delete. Work on a fresh test row so dummy data stays as it is.
LBL="$(rpc tools/call '{"name":"write_todo","arguments":{"name":"Test - edit me","due":"2026-11-30","importance":1}}' | grep -o '"label":"todo:[0-9]*"' | head -1 | cut -d'"' -f4)"
echo "--- test row: $LBL"
call edit "{\"label\":\"$LBL\",\"importance\":3,\"status\":true,\"due\":\"\"}"
call edit "{\"label\":\"$LBL\",\"importance\":\"2\",\"category\":\"personal\",\"action\":\"First action\"}"
call edit "{\"label\":\"$LBL\",\"action\":\"Second action\"}"
call edit "{\"label\":\"$LBL\",\"category\":\"nope\"}"
call edit "{\"label\":\"$LBL\"}"
call edit "{\"label\":\"$LBL\",\"email\":\"a@b.com\"}"
call edit "{\"label\":\"$LBL\",\"context\":\"x\"}"
call edit "{\"label\":\"$LBL\",\"name\":\"  \"}"
call edit "{\"label\":\"$LBL\",\"due\":\"2026-02-30\"}"
call edit '{"label":"todo:999","status":true}'
call edit '{"label":"banana","status":true}'
call delete "{\"label\":\"$LBL\"}"
call delete "{\"label\":\"$LBL\"}"
call delete '{"label":"banana"}'

# RLS: only the signed-in user's rows. As claude@test.com expect 4 todos (plus any Test rows left),
# and Nela's todo:39 must be "not found" for get, edit, note and delete.
call list '{"entity":"todos"}'
call get '{"labels":["todo:39"]}'
call edit '{"label":"todo:39","status":true}'
call note '{"label":"todo:39","text":"x"}'
call delete '{"label":"todo:39"}'
