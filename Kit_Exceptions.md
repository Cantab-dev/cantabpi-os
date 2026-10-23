# Kit exceptions — cantabpi-os

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v0.1 | Nela | 2026-10-23 |

Where this project departs from the kit (cantabpi-project-kit 0.12.0) on purpose. One row per departure, newest first.
An unrecorded departure can't be told apart from drift.

| Date | Departure | Why | Where |
|---|---|---|---|
| 2026-10-23 | The doc-hygiene hook also skips folders named `input` (`skipDirs` in `.claude/hooks/hygiene.config.json`; the kit's default skips `.git`, `.claude`, `node_modules`, `archive`) | `03_documentation/input/` holds Siniša's package as received (specs without our header). It is source material, not our documents, and is never edited; without the skip the hook flagged 16 of its files every session | `.claude/hooks/hygiene.config.json` |

**Changelog** (file history in git)
- v0.1 (2026-10-23) — Created with the first exception, in the weekly sweep.
