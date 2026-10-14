#!/usr/bin/env bash
# Live checks against the deployed mcp function. Usage: bash scripts/smoke.sh
# Reads the development key from supabase/functions/.env (git-ignored); never prints it.
set -u
cd "$(dirname "$0")/.."
URL="https://etofljbxzllkucmearwl.supabase.co/functions/v1/mcp"
KEY="$(grep '^CANTAB_DEV_KEY=' supabase/functions/.env | cut -d= -f2)"
N=0

rpc() { # rpc <method> <params-json>
  N=$((N + 1))
  curl -sS -X POST "$URL" \
    -H "Authorization: Bearer $KEY" \
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

echo "--- no key"
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$URL" -H 'Content-Type: application/json' -d '{}'
echo "--- wrong key"
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$URL" -H 'Authorization: Bearer wrong' -H 'Content-Type: application/json' -d '{}'

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
call write_todo '{"name":"Test - smoke todo","category":"test","due":"2026-11-30","importance":2}'
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

# edit and delete (v0.3.0). Work on a fresh test row so dummy data stays as it is.
LBL="$(rpc tools/call '{"name":"write_todo","arguments":{"name":"Test - edit me","due":"2026-11-30","importance":1}}' | grep -o '"label":"todo:[0-9]*"' | head -1 | cut -d'"' -f4)"
echo "--- test row: $LBL"
call edit "{\"label\":\"$LBL\",\"importance\":3,\"status\":true,\"due\":\"\"}"
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

# Acting user only: Nela's copies must not show. Expect total 4 todos (plus any Test rows left).
call list '{"entity":"todos"}'
