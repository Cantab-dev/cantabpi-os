# View: Agent builder

File `views/agent-builder.html` · view key `agent_builder` · agent `agent_builder` · audience: team

## 1. Purpose and user

Shows an agent's setup in a simple, fixed framework, so a consultant can read, check and change it:

- goal
- system prompt
- tools with their data access
- state variables
- skills
- trigger and guardrails

The view is aimed at the consulting team. It shows the team's own agents first, led by the interview synthesis agent, which turns interview notes into sourced findings in the analyst's tables. Agents built for the client, such as the pilot's call-prep agent, follow as a second group. The agent builder agent writes these setups.

## 2. Questions answered

- What is the agent for, and what instructions does it run with?
- What can it read, what can it change, and in which systems?
- What does it remember between runs, which skills does it use, and when does it run?
- What must it never do?

## 3. Data read

| Table | Fields |
|---|---|
| `engagement` | `client` |
| `people` | `name` |
| `agents` | `name`, `audience`, `goal`, `system_prompt`, `trigger`, `owner_id`, `status`, `skill_ids` |
| `agent_lines` | `agent_id`, `block`, `order`, `name`, `detail`, `access`, `resource`, `type`, `value` |
| `skills` | `name`, `description` |

## 4. Derived values

| Value | Rule |
|---|---|
| Agent list | consulting team agents first, then client agents, each by name; the first (interview synthesis agent) is shown by default |
| Writing tools | tools with access `write` or `read_write` (block title) |
| Skills assigned | skills in the agent's `skill_ids`, shown first and marked; the rest of the catalogue is shown as available |
| Prompt lines | `system_prompt` split at line breaks and numbered |

## 5. Layout and visualisations

- **Selector.** An agent selector (`id="agent-select"`, grouped "Consulting team agents" / "Client agents") with a status pill.
- **Goal (full width).** The goal in large text, with the agent name and owner.
- **Left column.**
  - **System prompt**: a numbered, monospaced prompt document.
  - **Tools and data access**: table of tool, access (Read · Write · Read / write · Action, as distinct chips), resource and scope.
  - **Guardrails**: list of rules, each marked "!", with an optional detail line.
- **Right column.**
  - **Trigger and schedule.**
  - **State variables**: table of name, type and current value; the description shows on hover.
  - **Skills**: the full catalogue with assigned skills ticked and highlighted.

On narrow screens the two columns stack.

## 6. Interactions

The selector redraws the view for another agent. Agent-changed lines show the change dot and note.

## 7. Render contract

| Item | Limit |
|---|---|
| Agents | ≤ 12; name ≤ 40; goal ≤ 200; system prompt ≤ 1,500 chars; trigger ≤ 60; up to 8 skills |
| Agent lines | ≤ 150 in total; name ≤ 64; detail ≤ 120; order 1..n per agent and block |
| Line fields by block (I24) | tools need `access` and `resource`; state needs `type` (value optional); guardrails take neither |
| Skills | ≤ 30; name ≤ 32; description ≤ 100 |

## 8. Agent actions for the demo

**A. Give the call-prep agent pharmacovigilance routing.**

```json
{ "agent": "agent_builder", "reason": "Adverse-event routing added after compliance review",
  "ops": [
    { "op": "create", "table": "agent_lines", "record": { "agent_id": "ag-01", "block": "tools", "order": 9, "name": "Adverse event report", "detail": "Forward any adverse event mention within 24 hours", "access": "action", "resource": "Pharmacovigilance" } },
    { "op": "create", "table": "agent_lines", "record": { "agent_id": "ag-01", "block": "guardrails", "order": 9, "name": "Adverse event mentions go to pharmacovigilance within 24 hours" } }
  ] }
```

Expected effect: a fifth tool with an amber Action chip and a fifth guardrail appear and flash, and the tools title reads "5 tools · 1 can change data".

**B. Move the agent to wave 1 and update its state.**

```json
{ "agent": "agent_builder", "reason": "Wave 1 go-live in Germany and Italy",
  "ops": [
    { "op": "update", "table": "agent_lines", "id": "al-006", "set": { "value": "900" } },
    { "op": "update", "table": "agent_lines", "id": "al-007", "set": { "value": "Wave 1: DE, IT" } }
  ] }
```

**C. Put the interview synthesis agent live and give it the expert network.**

```json
{ "agent": "agent_builder", "reason": "Interview agent passed review on seven interviews",
  "ops": [
    { "op": "update", "table": "agents", "id": "ag-04", "set": { "status": "live" } },
    { "op": "create", "table": "agent_lines", "record": { "agent_id": "ag-04", "block": "tools", "order": 2.5, "name": "Expert network transcripts", "detail": "Transcripts of paid expert calls", "access": "read", "resource": "Expert network" } }
  ] }
```

Expected effect: the status pill turns green, and a third tool appears after "Interview notes" (the rest renumber).

**D. Rejected: a tool without access.** Creating a tools line with no `access` returns I24: "tools lines need access and resource".

## 9. Acceptance checks

- The seed shows four agents: three consulting team agents and one client agent.
- The interview synthesis agent is shown first, with:
  - a 7-line prompt
  - 5 tools (2 can change data)
  - 4 state variables
  - 3 of 10 skills assigned
  - 4 guardrails
- For the call-prep agent:
  - a 7-line prompt
  - 4 tools (1 can change data)
  - 3 state variables
  - 3 of 10 skills assigned
  - 4 guardrails
- The project manager agent shows 5 tools, 4 of them read / write.
- Demo writes A, B and C commit; D is rejected.
