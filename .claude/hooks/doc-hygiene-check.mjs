// SessionStart hook — cheap, mechanical doc-hygiene check. Profiles M and L.
//
// Surfaces only what a machine can verify without judgment (Documentation_Rulebook.md Part C §6):
//   1. _temp files older than `tempAgeDays` (project root plus any `tempDirs`)
//   2. spec/plan docs missing the status header table — or carrying a status in another format
//   3. a status word outside the vocabulary
//   4. a status that belongs to the other ladder (a living doc marked Executed; a plan marked Current)
//   5. a retired doc (Executed / Closed / Superseded / Dropped) not under archive/ — unless its folder
//      is listed in `noArchiveDirs` (a folder another tool owns, with its own convention)
//   6. a handoff doc past its split trigger
//   7. the always-loaded files past their ceiling (root CLAUDE.md, optionally the memory index)
//   8. the ladder check (4) is switched off: docs carry ladder-specific states, but no living/plan
//      dirs or files are configured -- so the check would otherwise be silently inactive
//   9. an `On hold: <reason>, since <YYYY-MM-DD>` line older than `onHoldMaxDays`
//  10. the kit has moved on: `kitPath` given and its CHANGELOG top version differs from `kitVersion`
//
// Deliberately NOT here: anything needing a read-and-compare against reality. Those stay in the
// weekly sweep. `Approved` and `In progress` are sweep-enforced only — nothing here can detect
// sign-off or "work started" (Rulebook Part C §3).
//
// Paths in the config may be relative to `root` or absolute — so one hook can cover a docs tree and
// a separate repo checkout (split trees).
//
// Never blocks session start: any internal error is swallowed and the hook exits 0 silently.
// Node only, no dependencies. Project-specific settings live in hygiene.config.json beside this file.

import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---- Defaults. Override per project in hygiene.config.json; nothing here is project-specific. ----
const DEFAULTS = {
  root: null, // null = the directory the hook is run from (the project root)
  docDirs: ["docs", ".docs"], // scanned for spec/plan docs; "." = root, top level only
  livingDirs: [], // docs under these are living docs (Draft -> Current -> Closed)
  planDirs: [], // docs under these are static plans (Draft -> ... -> Executed)
  livingFiles: [], // single files, when one folder mixes living docs and plans
  planFiles: [],
  noArchiveDirs: [], // retired docs may stay here (a folder another tool owns)
  noHeaderFiles: [
    "DECISIONS.md",
    "COMMS.md",
    "COMMS_archive.md",
    "Document_Log.md",
    "Kit_Exceptions.md",
    "test_tracker.md",
    "README.md",
    "CHANGELOG.md",
  ],
  handoffFiles: ["HANDOFF.md"],
  handoffLineLimit: 200,
  claudeMdLineLimit: 120,
  memoryIndex: null, // absolute path to the memory index, if you want its ceiling checked
  memoryIndexLineLimit: 40,
  tempAgeDays: 14,
  tempDirs: [], // extra trees to scan for aging _temp files (e.g. a separate repo checkout)
  onHoldMaxDays: 30,
  kitPath: null, // path to a local clone of the kit, for the version check
  kitVersion: null, // the kit version this project last adopted (also recorded in CLAUDE.md)
  skipDirs: [".git", ".claude", "node_modules", "archive"],
};

// The vocabulary — ONE machine copy. Documentation_Rulebook.md Part C §3 is canonical; if it
// changes, change this and nothing else.
const LIVING_ONLY = ["current", "closed"];
const PLAN_ONLY = ["proposed", "approved", "in progress", "executed"];
const SHARED = ["draft", "superseded", "dropped"];
const VOCAB = [...LIVING_ONLY, ...PLAN_ONLY, ...SHARED].sort((a, b) => b.length - a.length);
const RETIRED = ["executed", "closed", "superseded", "dropped"];
const HEADER = "| Status | Version | Owner | Last updated |";
const HEAD_LINES = 15; // a status outside the table is only looked for this near the top

const findings = [];
const ladderSpecific = []; // docs whose status only makes sense on one ladder

function loadConfig() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(here, "hygiene.config.json");
  let user = {};
  if (existsSync(file)) {
    try {
      user = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      // unreadable config: fall back to defaults rather than fail
    }
  }
  const cfg = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (user[key] !== undefined && user[key] !== null) cfg[key] = user[key];
  }
  return cfg;
}

function readLines(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return readFileSync(filePath, "utf8").split(/\r?\n/);
  } catch {
    return null;
  }
}

const clean = (s) => s.replace(/[*_`]/g, "").trim();

// First cell of the status-table data row, markup stripped. Null if there is no header table.
function statusCell(lines) {
  const idx = lines.findIndex((l) => l.includes(HEADER));
  if (idx === -1) return null;
  let i = idx + 1;
  if (lines[i] && /^\s*\|[\s\-|:]+\|\s*$/.test(lines[i])) i++;
  const row = lines[i];
  if (!row) return null;
  const cell = row.split("|")[1];
  return cell === undefined ? null : clean(cell);
}

// A status written some other way near the top: a vertical `| **Status** | X |` table,
// `**Status:** X`, `**Status: X**`, or a leading `Status: X | …` line. Null if none.
function looseStatus(lines) {
  for (const l of lines.slice(0, HEAD_LINES)) {
    const m =
      l.match(/^\|\s*\*\*Status\*\*\s*\|([^|]*)\|/) ||
      l.match(/^\*\*Status:?\*\*:?\s*(.*)$/) ||
      l.match(/^\*\*Status:\s*([^*]*)\*\*/) ||
      l.match(/^Status:\s*(.*)$/);
    if (m) return clean(m[1]);
  }
  return null;
}

function statusWord(cell) {
  const lower = cell.toLowerCase();
  return VOCAB.find((w) => lower.startsWith(w)) ?? null;
}

const norm = (p) => path.resolve(p).split(path.sep).join("/").toLowerCase();
const resolveAll = (list, root) => list.map((d) => norm(path.resolve(root, d)));

function under(file, dirs) {
  const f = norm(file);
  return dirs.some((d) => f === d || f.startsWith(d.replace(/\/+$/, "") + "/"));
}

// Relative to root when inside it; otherwise the full path (split trees).
function label(file, root) {
  const rel = path.relative(root, file);
  return (rel.startsWith("..") || path.isAbsolute(rel) ? file : rel).split(path.sep).join("/");
}

function walk(dir, cfg, recursive, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.isDirectory()) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (recursive && !cfg.skipDirs.includes(e.name)) walk(full, cfg, true, out);
    } else if (e.isFile()) {
      out.push(full);
    }
  }
}

function checkTempFiles(dirs, cfg, root) {
  const all = [];
  for (const d of dirs) walk(d, cfg, true, all);
  const cutoff = Date.now() - cfg.tempAgeDays * 86400000;
  for (const f of all) {
    if (!/_temp(\.[^.]+)?$/i.test(path.basename(f))) continue;
    try {
      const m = statSync(f).mtimeMs;
      if (m < cutoff) {
        const age = Math.round((Date.now() - m) / 86400000);
        findings.push(`_temp file ${age}d old, no decision recorded: ${label(f, root)}`);
      }
    } catch {
      // unreadable, skip
    }
  }
}

function checkOnHold(lines, lbl, cfg) {
  for (const l of lines.slice(0, HEAD_LINES + 5)) {
    const m = l.match(/^On hold:.*since (\d{4}-\d{2}-\d{2})/i);
    if (!m) continue;
    const days = Math.floor((Date.now() - Date.parse(m[1])) / 86400000);
    if (days > cfg.onHoldMaxDays) {
      findings.push(`on hold for ${days} days (over ${cfg.onHoldMaxDays}) — resume, drop or re-confirm: ${lbl}`);
    }
    return;
  }
}

function checkDoc(file, cfg, root, sets) {
  const name = path.basename(file);
  if (!name.endsWith(".md")) return;
  if (cfg.noHeaderFiles.includes(name)) return;
  if (/^HANDOFF/i.test(name)) return; // handoff docs carry no status header (Rulebook Part A §3)
  if (/_temp(\.[^.]+)?$/i.test(name)) return;
  const lbl = label(file, root);
  const lines = readLines(file);
  if (lines === null) return;

  let cell = statusCell(lines);
  if (cell === null) {
    const loose = looseStatus(lines);
    if (loose === null) {
      findings.push(`missing Status/Version/Owner/Last-updated header: ${lbl}`);
      return;
    }
    findings.push(`status not in the header-table format ("${loose.slice(0, 40)}"): ${lbl}`);
    cell = loose; // still check what it says — a retired doc in the wrong format is still retired
  }
  checkOnHold(lines, lbl, cfg);
  const word = statusWord(cell);
  if (word === null) {
    findings.push(`status word outside the vocabulary: ${lbl} — status cell reads "${cell.slice(0, 60)}"`);
    return;
  }
  // A file listed by name wins over its folder's ladder (one folder may mix living docs and plans).
  const f = norm(file);
  const listedLiving = sets.livingFiles.includes(f);
  const listedPlan = sets.planFiles.includes(f);
  const living = listedLiving || (!listedPlan && under(file, sets.livingDirs));
  const plan = listedPlan || (!listedLiving && under(file, sets.planDirs));
  if (PLAN_ONLY.includes(word) || LIVING_ONLY.includes(word)) ladderSpecific.push(lbl);
  if (PLAN_ONLY.includes(word) && living) {
    findings.push(`plan state "${word}" on a living doc (a living doc is Draft/Current/Closed): ${lbl}`);
  }
  if (LIVING_ONLY.includes(word) && plan) {
    findings.push(`living state "${word}" on a static plan (a plan is Draft/Proposed/Approved/In progress/Executed): ${lbl}`);
  }
  if (RETIRED.includes(word) && !norm(file).includes("/archive/") && !under(file, sets.noArchiveDirs)) {
    findings.push(`status is ${word} but the file isn't under archive/: ${lbl}`);
  }
}

function checkSize(file, limit, what, root) {
  const lines = readLines(file);
  if (lines === null) return;
  if (lines.length > limit) {
    findings.push(`${what} past its ${limit}-line ceiling: ${label(file, root) || file} — ${lines.length} lines`);
  }
}

function checkKitVersion(cfg, root) {
  if (!cfg.kitPath || !cfg.kitVersion) return;
  const lines = readLines(path.resolve(root, cfg.kitPath, "CHANGELOG.md"));
  if (lines === null) return; // no local kit clone: nothing to compare against
  const top = lines.map((l) => l.match(/^- \*\*(\d+\.\d+\.\d+)\*\*/)).find(Boolean);
  if (top && top[1] !== cfg.kitVersion) {
    findings.push(
      `kit is at ${top[1]}, this project adopted ${cfg.kitVersion} — read the kit CHANGELOG entries marked ` +
        `[action] since then, diff what applies, then update kitVersion here and in CLAUDE.md`,
    );
  }
}

try {
  const cfg = loadConfig();
  const root = path.resolve(cfg.root ?? process.cwd());
  const sets = {
    livingDirs: resolveAll(cfg.livingDirs, root),
    planDirs: resolveAll(cfg.planDirs, root),
    livingFiles: resolveAll(cfg.livingFiles, root),
    planFiles: resolveAll(cfg.planFiles, root),
    noArchiveDirs: resolveAll(cfg.noArchiveDirs, root),
  };

  checkTempFiles([root, ...cfg.tempDirs.map((d) => path.resolve(root, d)).filter(existsSync)], cfg, root);

  for (const d of cfg.docDirs) {
    const dir = path.resolve(root, d);
    if (!existsSync(dir)) continue;
    const files = [];
    walk(dir, cfg, d !== ".", files);
    for (const f of files) checkDoc(f, cfg, root, sets);
  }

  // The ladder check is opt-in (the hook can't know which docs are plans). Say so when it matters,
  // rather than leaving it silently inactive.
  const ladderConfigured = cfg.livingDirs.length + cfg.planDirs.length + cfg.livingFiles.length + cfg.planFiles.length > 0;
  if (!ladderConfigured && ladderSpecific.length > 0) {
    findings.push(
      `ladder check is inactive: ${ladderSpecific.length} doc(s) carry a ladder-specific status ` +
        `(e.g. ${ladderSpecific[0]}) but no living/plan dirs or files are configured in hygiene.config.json`,
    );
  }

  for (const h of cfg.handoffFiles) {
    checkSize(path.resolve(root, h), cfg.handoffLineLimit, "handoff doc (split trigger)", root);
  }
  checkSize(path.join(root, "CLAUDE.md"), cfg.claudeMdLineLimit, "always-loaded CLAUDE.md", root);
  if (cfg.memoryIndex) checkSize(cfg.memoryIndex, cfg.memoryIndexLineLimit, "always-loaded memory index", root);
  checkKitVersion(cfg, root);

  if (findings.length > 0) {
    const bullets = findings.map((f) => `- ${f}`).join("\n");
    console.log(
      JSON.stringify({
        systemMessage: `Doc-hygiene (mechanical check): ${findings.length} item(s) flagged — see context.`,
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext:
            `Mechanical doc-hygiene check (Documentation_Rulebook.md Part C §6) found ${findings.length} item(s), ` +
            `none judged, just surfaced:\n${bullets}\n` +
            `These are flags, not fixes — don't act on them without the user's go.`,
        },
      }),
    );
  }
} catch {
  // Never block session start over this check.
}
process.exit(0);
