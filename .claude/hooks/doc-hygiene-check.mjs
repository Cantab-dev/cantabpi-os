// SessionStart hook — cheap, mechanical doc-hygiene check. Profiles M and L.
//
// Surfaces only what a machine can verify without judgment (Documentation_Rulebook.md Part C §6):
//   1. _temp files older than `tempAgeDays`
//   2. spec/plan docs missing the status header table
//   3. a status word outside the vocabulary
//   4. a status that belongs to the other ladder (a living doc marked Executed; a plan marked Current)
//   5. a retired doc (Executed / Closed / Superseded / Dropped) not under archive/
//   6. a handoff doc past its split trigger
//   7. the always-loaded files past their ceiling (root CLAUDE.md, optionally the memory index)
//   8. the ladder check (4) is switched off: docs carry ladder-specific states, but neither
//      livingDirs nor planDirs is configured -- so the check would otherwise be silently inactive
//
// Deliberately NOT here: anything needing a read-and-compare against reality. Those stay in the
// weekly sweep. `Approved` and `In progress` are sweep-enforced only — nothing here can detect
// sign-off or "work started" (Rulebook Part C §3).
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
  noHeaderFiles: [
    "DECISIONS.md",
    "COMMS.md",
    "COMMS_archive.md",
    "Document_Log.md",
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

// First cell of the status-table data row, markup stripped. Null if there is no header table.
function statusCell(lines) {
  const idx = lines.findIndex((l) => l.includes(HEADER));
  if (idx === -1) return null;
  let i = idx + 1;
  if (lines[i] && /^\s*\|[\s\-|]+\|\s*$/.test(lines[i])) i++;
  const row = lines[i];
  if (!row) return null;
  const cell = row.split("|")[1];
  return cell === undefined ? null : cell.replace(/[*_`]/g, "").trim();
}

function statusWord(cell) {
  const lower = cell.toLowerCase();
  return VOCAB.find((w) => lower.startsWith(w)) ?? null;
}

function under(file, dirs, root) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  return dirs.some((d) => rel === d || rel.startsWith(d.replace(/\/+$/, "") + "/"));
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

function checkTempFiles(root, cfg) {
  const all = [];
  walk(root, cfg, true, all);
  const cutoff = Date.now() - cfg.tempAgeDays * 86400000;
  for (const f of all) {
    if (!/_temp(\.[^.]+)?$/i.test(path.basename(f))) continue;
    try {
      const m = statSync(f).mtimeMs;
      if (m < cutoff) {
        const age = Math.round((Date.now() - m) / 86400000);
        findings.push(`_temp file ${age}d old, no decision recorded: ${path.relative(root, f)}`);
      }
    } catch {
      // unreadable, skip
    }
  }
}

function checkDoc(file, cfg, root) {
  const name = path.basename(file);
  if (!name.endsWith(".md")) return;
  if (cfg.noHeaderFiles.includes(name)) return;
  if (/^HANDOFF/i.test(name)) return; // handoff docs carry no status header (Rulebook Part A §3)
  if (/_temp(\.[^.]+)?$/i.test(name)) return;
  const label = path.relative(root, file).split(path.sep).join("/");
  const lines = readLines(file);
  if (lines === null) return;

  const cell = statusCell(lines);
  if (cell === null) {
    findings.push(`missing Status/Version/Owner/Last-updated header: ${label}`);
    return;
  }
  const word = statusWord(cell);
  if (word === null) {
    findings.push(`status word outside the vocabulary: ${label} — status cell reads "${cell.slice(0, 60)}"`);
    return;
  }
  if (PLAN_ONLY.includes(word) || LIVING_ONLY.includes(word)) ladderSpecific.push(label);
  if (PLAN_ONLY.includes(word) && under(file, cfg.livingDirs, root)) {
    findings.push(`plan state "${word}" on a living doc (a living doc is Draft/Current/Closed): ${label}`);
  }
  if (LIVING_ONLY.includes(word) && under(file, cfg.planDirs, root)) {
    findings.push(`living state "${word}" on a static plan (a plan is Draft/Proposed/Approved/In progress/Executed): ${label}`);
  }
  if (RETIRED.includes(word) && !file.includes(`${path.sep}archive${path.sep}`)) {
    findings.push(`status is ${word} but the file isn't under archive/: ${label}`);
  }
}

function checkSize(file, limit, what, root) {
  const lines = readLines(file);
  if (lines === null) return;
  if (lines.length > limit) {
    findings.push(`${what} past its ${limit}-line ceiling: ${path.relative(root, file) || file} — ${lines.length} lines`);
  }
}

try {
  const cfg = loadConfig();
  const root = path.resolve(cfg.root ?? process.cwd());

  checkTempFiles(root, cfg);

  for (const d of cfg.docDirs) {
    const dir = path.resolve(root, d);
    if (!existsSync(dir)) continue;
    const files = [];
    walk(dir, cfg, d !== ".", files);
    for (const f of files) checkDoc(f, cfg, root);
  }

  // The ladder check is opt-in (the hook can't know which dirs hold plans). Say so when it matters,
  // rather than leaving it silently inactive.
  if (cfg.livingDirs.length === 0 && cfg.planDirs.length === 0 && ladderSpecific.length > 0) {
    findings.push(
      `ladder check is inactive: ${ladderSpecific.length} doc(s) carry a ladder-specific status ` +
        `(e.g. ${ladderSpecific[0]}) but livingDirs and planDirs are both empty in hygiene.config.json`,
    );
  }

  for (const h of cfg.handoffFiles) {
    checkSize(path.resolve(root, h), cfg.handoffLineLimit, "handoff doc (split trigger)", root);
  }
  checkSize(path.join(root, "CLAUDE.md"), cfg.claudeMdLineLimit, "always-loaded CLAUDE.md", root);
  if (cfg.memoryIndex) checkSize(cfg.memoryIndex, cfg.memoryIndexLineLimit, "always-loaded memory index", root);

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
