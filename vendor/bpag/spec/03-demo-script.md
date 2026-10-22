# Demo script

A 15-minute live demo in which agents change the engagement data and the views follow. Each step is a write request in `demo/`, run in order through the data tool. The same requests can be run without the tool server:

```
node tools/run-demo.js         # reset to seed, then run every step and save
node tools/run-demo.js 03      # run only step 03 against the current data
node tools/run-demo.js --dry   # check the whole sequence without changing files
```

Before the demo, reset (`reset` verb, or `node validator/validate.js --reset`). Open the view named in each step before running it, so the audience sees the change land: changed items flash or pulse, and keep a red dot with the agent's reason on hover.

| # | File | Agent | Open this view | What changes on screen | The point |
|---|---|---|---|---|---|
| 0 | none | none | Engagement home | Plan by phase with today at 21 Oct; RACI by phase | The engagement at a glance |
| 1 | `01-project-manager.json` | Project manager | Project manager | CRM extraction turns from red "Late 5d" to dark grey and extends to 23 Oct; a red dependency connector to the sensitivity work appears | The agent keeps the plan true to today and surfaces the knock-on effect |
| 2 | `02-team-manager.json` | Team manager | Team manager | Mei's weeks 12–13 drop from 130% (red) to 100%; Lukas's rise from 60% to 90%; the title no longer names Mei; the action shows Done | Load rebalanced across the team, and the recommended action closed |
| 3 | `03-model-builder.json` | Model builder | Model builder | Seven rows flash; the link panel turns to "4 of 12 links differ from the model" | The model moved; the client view is now out of date and the environment shows exactly where |
| 4 | `04-value-estimator.json` | Value estimator | Value estimator | The NBA bar shrinks to +17.6 and the haircut to −9.3; the headline reads €422m / €47m without any text edit; the tornado re-centres on €155m; the model view shows all links matching again | Placeholders keep the story true; cross-agent consistency is restored in one write |
| 5 | none (no write) | none | Presentation builder | The governing thought now says €47m | Text that quotes figures follows the numbers |
| 6 | `05-analyst.json` | Analyst | Analyst, then Story builder | A new benchmark source and a supporting finding with its quote; "Reps adopt the agents…" turns Confirmed; the story builder title reads 6 of 10 confirmed | New evidence flows from research into the issue tree |
| 7 | `06-story-builder.json` | Story builder | Presentation builder | Slide 5 now carries the risks answer; the feasibility card shows "No slide yet" | The storyline check makes the gap visible |
| 8 | `07-agent-builder.json` | Agent builder | Agent builder | The interview synthesis agent goes Live and gains the expert-network tool | Agents for the team are configured in the same environment |
| 9 | `08-engagement-starter.json` | Engagement starter | Engagement home | In the Rollout plan column Clara becomes C and Tomás A; the title updates | Roles adapt as the engagement moves on |
| 10 | `09-proposal-builder.json` | Proposal builder | Proposal builder | Mei's days rise to 60; total fees €933,600; the Fees paragraph reads €934k for 360 days | Commercials and text cannot drift apart |
| 11 | `10-rejected-headline.json` | Value estimator | Value estimator | Nothing changes; the tool returns "text is 122 characters, allowed ≤ 110" | The templates cannot be broken; the agent gets a precise reason and retries |

Expected tool output for the full run (`node tools/run-demo.js --dry`): steps 1–9 commit at versions 7–15, and step 10 is rejected. Warning W04 appears throughout, because the SteerCo pack still starts before the sensitivity work ends; that tension is deliberate. W01 and W02 appear only after step 3 and are cleared by step 4.
