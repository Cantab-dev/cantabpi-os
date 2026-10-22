// Generates the Big Pharma AG seed dataset into data/ and data/seed/.
// Run: node tools/build-seed.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SEED = path.join(DATA, 'seed');

const T0 = '2026-10-21T08:00:00Z';
const meta = (v = 1, at = T0, by = 'seed', reason = 'Initial dataset') => ({ version: v, updated_at: at, updated_by: by, reason });
const withMeta = (rows) => rows.map((r) => ({ ...r, _meta: meta() }));

const D = {};

D.engagement = withMeta([{
  id: 'en-01', client: 'Big Pharma AG', name: 'Agentic AI for field sales: pilot to scale',
  objective: 'Prove the value of AI agents for field sales reps in a two-region pilot, then design and justify the rollout to all nine EU markets.',
  start: '2026-08-03', end: '2026-12-04', as_of: '2026-10-21', currency: 'EUR',
  partner_id: 'pe-01', manager_id: 'pe-02', sponsor_id: 'pe-07'
}]);

D.people = withMeta([
  { id: 'pe-01', name: 'Clara Weber', org: 'consulting', title: 'Partner', rate_day: 4500, capacity_days_week: 1.5 },
  { id: 'pe-02', name: 'Tomás Reyes', org: 'consulting', title: 'Engagement manager', rate_day: 3200, capacity_days_week: 5 },
  { id: 'pe-03', name: 'Aisha Rahman', org: 'consulting', title: 'Consultant', rate_day: 2200, capacity_days_week: 5 },
  { id: 'pe-04', name: 'Jonas Lindqvist', org: 'consulting', title: 'Consultant', rate_day: 2200, capacity_days_week: 5 },
  { id: 'pe-05', name: 'Mei Tanaka', org: 'consulting', title: 'Data scientist', rate_day: 2400, capacity_days_week: 5 },
  { id: 'pe-06', name: 'Lukas Brandt', org: 'consulting', title: 'AI engineer', rate_day: 2400, capacity_days_week: 5 },
  { id: 'pe-07', name: 'Dr Sabine Keller', org: 'client', title: 'Head of Commercial Excellence (sponsor)' },
  { id: 'pe-08', name: 'Marco Rossi', org: 'client', title: 'Sales Director, EU' },
  { id: 'pe-09', name: 'Nina Hoffmann', org: 'client', title: 'Product owner, field force AI' },
  { id: 'pe-10', name: 'Peter Vogel', org: 'client', title: 'Head of data platform, IT' },
  { id: 'pe-11', name: 'Dr Hannah Becker', org: 'client', title: 'Medical-legal compliance lead' }
]);

D.phases = withMeta([
  { id: 'ph-01', order: 1, name: 'Pilot', start: '2026-08-03', end: '2026-09-25' },
  { id: 'ph-02', order: 2, name: 'Scale-up design', start: '2026-09-28', end: '2026-11-06' },
  { id: 'ph-03', order: 3, name: 'Rollout plan', start: '2026-11-09', end: '2026-12-04' }
]);

D.milestones = withMeta([
  { id: 'ms-01', phase_id: 'ph-01', name: 'Kick-off', date: '2026-08-03', type: 'kickoff', status: 'done' },
  { id: 'ms-02', phase_id: 'ph-01', name: 'Pilot go-live, 40 reps in 2 regions', date: '2026-08-24', type: 'go_live', status: 'done' },
  { id: 'ms-03', phase_id: 'ph-01', name: 'Pilot results readout', date: '2026-09-25', type: 'readout', status: 'done' },
  { id: 'ms-04', phase_id: 'ph-02', name: 'Scale-up business case to SteerCo', date: '2026-10-30', type: 'steerco', status: 'at_risk' },
  { id: 'ms-05', phase_id: 'ph-02', name: 'Board decision on scale-up', date: '2026-11-06', type: 'board', status: 'planned' },
  { id: 'ms-06', phase_id: 'ph-03', name: 'Rollout plan sign-off', date: '2026-12-04', type: 'signoff', status: 'planned' }
]);

D.deliverables = withMeta([
  { id: 'dl-01', phase_id: 'ph-01', milestone_id: 'ms-02', name: 'Pilot design and success metrics', owner_id: 'pe-03', due: '2026-08-14', status: 'done' },
  { id: 'dl-02', phase_id: 'ph-01', milestone_id: 'ms-02', name: 'Pilot agent configuration', owner_id: 'pe-06', due: '2026-08-21', status: 'done' },
  { id: 'dl-03', phase_id: 'ph-01', milestone_id: 'ms-03', name: 'Pilot results report', owner_id: 'pe-05', due: '2026-09-25', status: 'done' },
  { id: 'dl-04', phase_id: 'ph-02', milestone_id: 'ms-04', name: 'Value model', owner_id: 'pe-04', due: '2026-10-23', status: 'in_progress' },
  { id: 'dl-05', phase_id: 'ph-02', milestone_id: 'ms-04', name: 'Scale-up business case', owner_id: 'pe-02', due: '2026-10-30', status: 'at_risk' },
  { id: 'dl-06', phase_id: 'ph-02', milestone_id: 'ms-05', name: 'Target operating model and governance', owner_id: 'pe-03', due: '2026-11-04', status: 'in_progress' },
  { id: 'dl-07', phase_id: 'ph-02', milestone_id: 'ms-05', name: 'Board proposal deck', owner_id: 'pe-02', due: '2026-11-06', status: 'not_started' },
  { id: 'dl-08', phase_id: 'ph-03', milestone_id: 'ms-06', name: 'Rollout roadmap by country wave', owner_id: 'pe-04', due: '2026-11-27', status: 'not_started' },
  { id: 'dl-09', phase_id: 'ph-03', milestone_id: 'ms-06', name: 'Change and enablement plan', owner_id: 'pe-03', due: '2026-12-02', status: 'not_started' },
  { id: 'dl-10', phase_id: 'ph-03', milestone_id: 'ms-06', name: 'Letter of proposal for rollout support', owner_id: 'pe-01', due: '2026-12-04', status: 'not_started' }
]);

D.tasks = withMeta([
  { id: 'tk-01', phase_id: 'ph-01', deliverable_id: 'dl-01', name: 'Pilot design workshops', owner_id: 'pe-03', start: '2026-08-03', end: '2026-08-12', status: 'done', progress_pct: 100, depends_on: [] },
  { id: 'tk-02', phase_id: 'ph-01', deliverable_id: 'dl-02', name: 'Agent build and configuration', owner_id: 'pe-06', start: '2026-08-05', end: '2026-08-21', status: 'done', progress_pct: 100, depends_on: [] },
  { id: 'tk-03', phase_id: 'ph-01', deliverable_id: 'dl-02', name: 'Rep onboarding, 40 reps', owner_id: 'pe-03', start: '2026-08-17', end: '2026-08-21', status: 'done', progress_pct: 100, depends_on: ['tk-01'] },
  { id: 'tk-04', phase_id: 'ph-01', deliverable_id: 'dl-03', name: 'Pilot run and monitoring', owner_id: 'pe-05', start: '2026-08-24', end: '2026-09-18', status: 'done', progress_pct: 100, depends_on: ['tk-02', 'tk-03'] },
  { id: 'tk-05', phase_id: 'ph-01', deliverable_id: 'dl-03', name: 'Pilot impact analysis', owner_id: 'pe-05', start: '2026-09-14', end: '2026-09-25', status: 'done', progress_pct: 100, depends_on: [] },
  { id: 'tk-06', phase_id: 'ph-02', deliverable_id: 'dl-04', name: 'Baseline and lever sizing', owner_id: 'pe-04', start: '2026-09-28', end: '2026-10-09', status: 'done', progress_pct: 100, depends_on: [] },
  { id: 'tk-07', phase_id: 'ph-02', deliverable_id: 'dl-05', name: 'Market research and benchmarks', owner_id: 'pe-03', start: '2026-09-28', end: '2026-10-14', status: 'done', progress_pct: 100, depends_on: [] },
  { id: 'tk-08', phase_id: 'ph-02', deliverable_id: 'dl-04', name: 'CRM data extraction, all markets', owner_id: 'pe-05', start: '2026-10-05', end: '2026-10-16', status: 'late', progress_pct: 70, depends_on: [] },
  { id: 'tk-09', phase_id: 'ph-02', deliverable_id: 'dl-04', name: 'Value model build', owner_id: 'pe-04', start: '2026-10-12', end: '2026-10-23', status: 'in_progress', progress_pct: 60, depends_on: ['tk-06'] },
  { id: 'tk-10', phase_id: 'ph-02', deliverable_id: 'dl-05', name: 'Sensitivity and risk analysis', owner_id: 'pe-05', start: '2026-10-19', end: '2026-10-27', status: 'at_risk', progress_pct: 15, depends_on: ['tk-08'] },
  { id: 'tk-11', phase_id: 'ph-02', deliverable_id: 'dl-05', name: 'Storyline and issue tree', owner_id: 'pe-02', start: '2026-10-12', end: '2026-10-23', status: 'in_progress', progress_pct: 70, depends_on: [] },
  { id: 'tk-12', phase_id: 'ph-02', deliverable_id: 'dl-06', name: 'IT architecture for scale', owner_id: 'pe-06', start: '2026-10-12', end: '2026-10-30', status: 'in_progress', progress_pct: 45, depends_on: [] },
  { id: 'tk-13', phase_id: 'ph-02', deliverable_id: 'dl-06', name: 'Operating model and governance design', owner_id: 'pe-03', start: '2026-10-19', end: '2026-11-04', status: 'in_progress', progress_pct: 20, depends_on: [] },
  { id: 'tk-14', phase_id: 'ph-02', deliverable_id: 'dl-05', name: 'SteerCo business case pack', owner_id: 'pe-02', start: '2026-10-26', end: '2026-10-30', status: 'not_started', progress_pct: 0, depends_on: ['tk-09', 'tk-10', 'tk-11'] },
  { id: 'tk-15', phase_id: 'ph-02', deliverable_id: 'dl-07', name: 'Board deck and pre-wires', owner_id: 'pe-02', start: '2026-11-02', end: '2026-11-06', status: 'not_started', progress_pct: 0, depends_on: ['tk-14'] },
  { id: 'tk-16', phase_id: 'ph-03', deliverable_id: 'dl-08', name: 'Country wave sequencing', owner_id: 'pe-04', start: '2026-11-09', end: '2026-11-27', status: 'not_started', progress_pct: 0, depends_on: [] },
  { id: 'tk-17', phase_id: 'ph-03', deliverable_id: 'dl-09', name: 'Change and enablement planning', owner_id: 'pe-03', start: '2026-11-09', end: '2026-12-02', status: 'not_started', progress_pct: 0, depends_on: [] },
  { id: 'tk-18', phase_id: 'ph-03', deliverable_id: 'dl-10', name: 'Rollout proposal drafting', owner_id: 'pe-01', start: '2026-11-23', end: '2026-12-04', status: 'not_started', progress_pct: 0, depends_on: [] }
]);

const raciSpec = {
  'dl-01': { 'pe-03': 'R', 'pe-02': 'A', 'pe-09': 'C', 'pe-11': 'C', 'pe-07': 'I' },
  'dl-02': { 'pe-06': 'R', 'pe-02': 'A', 'pe-10': 'C', 'pe-11': 'C', 'pe-09': 'I' },
  'dl-03': { 'pe-05': 'R', 'pe-02': 'A', 'pe-03': 'C', 'pe-07': 'I', 'pe-08': 'I' },
  'dl-04': { 'pe-04': 'R', 'pe-02': 'A', 'pe-05': 'C', 'pe-09': 'C', 'pe-07': 'I' },
  'dl-05': { 'pe-02': 'R', 'pe-04': 'R', 'pe-01': 'A', 'pe-07': 'C', 'pe-08': 'C' },
  'dl-06': { 'pe-03': 'R', 'pe-02': 'A', 'pe-09': 'C', 'pe-10': 'C', 'pe-11': 'C' },
  'dl-07': { 'pe-02': 'R', 'pe-01': 'A', 'pe-07': 'C', 'pe-08': 'I' },
  'dl-08': { 'pe-04': 'R', 'pe-02': 'A', 'pe-08': 'C', 'pe-10': 'C' },
  'dl-09': { 'pe-03': 'R', 'pe-02': 'A', 'pe-09': 'C', 'pe-11': 'I' },
  'dl-10': { 'pe-02': 'R', 'pe-01': 'A', 'pe-07': 'C' }
};
let n = 0;
D.raci = [];
for (const [dl, m] of Object.entries(raciSpec)) for (const [pe, role] of Object.entries(m)) {
  n += 1; D.raci.push({ id: 'ra-' + String(n).padStart(2, '0'), deliverable_id: dl, person_id: pe, role });
}
D.raci = withMeta(D.raci);

// Time entries: weeks 1..18, as-of week 12 (actuals for weeks 1..11)
const WEEKS = 18, ASOF_WEEK = 12;
const plan = {
  'pe-01': (w) => ([8, 18].includes(w) ? 2 : [13, 14].includes(w) ? 1.5 : 1),
  'pe-02': (w) => ({ 10: 5.5, 11: 6, 12: 6, 13: 6.5, 14: 6 }[w] || 5),
  'pe-03': () => 5,
  'pe-04': (w) => (w <= 8 ? 4.5 : 5),
  'pe-05': (w) => ({ 10: 5.5, 11: 6.5, 12: 6.5, 13: 6.5, 14: 5.5 }[w] || (w >= 15 ? 3 : 5)),
  'pe-06': (w) => (w <= 8 ? 5 : w <= 13 ? 3 : w === 14 ? 3.5 : 2)
};
const actualAdj = { 'pe-01': { 3: 1.5, 8: 2.5 }, 'pe-02': { 4: 5.5, 11: 6.5 }, 'pe-03': { 6: 4.5 }, 'pe-04': { 2: 4 }, 'pe-05': { 7: 5.5, 11: 7 }, 'pe-06': { 9: 2.5, 10: 3 } };
D.time_entries = [];
n = 0;
for (const pe of Object.keys(plan)) for (let w = 1; w <= WEEKS; w++) {
  n += 1;
  const p = plan[pe](w);
  const rec = { id: 'te-' + String(n).padStart(3, '0'), person_id: pe, week: w, planned_days: p };
  if (w < ASOF_WEEK) rec.actual_days = (actualAdj[pe] && actualAdj[pe][w] != null) ? actualAdj[pe][w] : p;
  D.time_entries.push(rec);
}
D.time_entries = withMeta(D.time_entries);

const PR = {
  'ph-01': [['pe-01', 'C', 'Steers pilot scope and signs off the results readout'], ['pe-02', 'A', 'Runs the pilot day to day; owns go-live and the readout'], ['pe-03', 'R', 'Designs the pilot, success metrics and rep onboarding'], ['pe-04', 'C', 'Sets up the baseline data later used for sizing'], ['pe-05', 'R', 'Monitors pilot telemetry and writes the impact analysis'], ['pe-06', 'R', 'Builds and configures the three pilot agents'], ['pe-07', 'C', 'Approves pilot scope and attends the readout'], ['pe-08', 'I', 'Releases 40 reps in two regions for the pilot'], ['pe-09', 'C', 'Prioritises agent features with the pilot reps'], ['pe-10', 'C', 'Provides CRM access and the integration sandbox'], ['pe-11', 'C', 'Approves guardrails and rules for generated content']],
  'ph-02': [['pe-01', 'A', 'Owns the business case and the board recommendation'], ['pe-02', 'R', 'Builds the SteerCo story and runs the workstreams'], ['pe-03', 'R', 'Designs the target operating model and governance'], ['pe-04', 'R', 'Builds the value model and sizes the levers'], ['pe-05', 'R', 'Runs CRM extraction and the sensitivity analysis'], ['pe-06', 'R', 'Designs the IT architecture for nine markets'], ['pe-07', 'C', 'Shapes the case and pre-wires the board'], ['pe-08', 'C', 'Validates adoption assumptions market by market'], ['pe-09', 'C', 'Defines the product roadmap for scale'], ['pe-10', 'R', 'Delivers the CRM extract for all markets'], ['pe-11', 'I', 'Kept informed on guardrail scope at scale']],
  'ph-03': [['pe-01', 'A', 'Owns the rollout proposal and commercial terms'], ['pe-02', 'R', 'Leads wave planning and drafts the proposal'], ['pe-03', 'R', 'Writes the change and enablement plan'], ['pe-04', 'R', 'Sequences the country waves'], ['pe-05', 'I', 'Hands over the adoption tracking metrics'], ['pe-06', 'C', 'Estimates integration effort per wave'], ['pe-07', 'C', 'Agrees the wave plan and sign-off criteria'], ['pe-08', 'C', 'Commits market sales teams to wave dates'], ['pe-09', 'C', 'Prepares to own the run model after handover'], ['pe-10', 'C', 'Plans data remediation in the two lagging markets'], ['pe-11', 'I', 'Informed of market-specific compliance steps']]
};
n = 0;
D.phase_raci = [];
for (const [ph, rows] of Object.entries(PR)) for (const [pe, role, comment] of rows) { n += 1; D.phase_raci.push({ id: 'px-' + String(n).padStart(3, '0'), phase_id: ph, person_id: pe, role, comment }); }
D.phase_raci = withMeta(D.phase_raci);

D.reviews = withMeta([
  { id: 'rv-01', deliverable_id: 'dl-01', reviewer_id: 'pe-02', date: '2026-08-11', cycle: 1, outcome: 'changes_requested' },
  { id: 'rv-02', deliverable_id: 'dl-01', reviewer_id: 'pe-02', date: '2026-08-13', cycle: 2, outcome: 'approved' },
  { id: 'rv-03', deliverable_id: 'dl-02', reviewer_id: 'pe-02', date: '2026-08-20', cycle: 1, outcome: 'approved' },
  { id: 'rv-04', deliverable_id: 'dl-03', reviewer_id: 'pe-01', date: '2026-09-22', cycle: 1, outcome: 'changes_requested' },
  { id: 'rv-05', deliverable_id: 'dl-03', reviewer_id: 'pe-01', date: '2026-09-24', cycle: 2, outcome: 'approved' },
  { id: 'rv-06', deliverable_id: 'dl-04', reviewer_id: 'pe-02', date: '2026-10-12', cycle: 1, outcome: 'changes_requested' },
  { id: 'rv-07', deliverable_id: 'dl-04', reviewer_id: 'pe-02', date: '2026-10-16', cycle: 2, outcome: 'changes_requested' },
  { id: 'rv-08', deliverable_id: 'dl-04', reviewer_id: 'pe-01', date: '2026-10-20', cycle: 3, outcome: 'changes_requested' },
  { id: 'rv-09', deliverable_id: 'dl-06', reviewer_id: 'pe-02', date: '2026-10-19', cycle: 1, outcome: 'changes_requested' }
]);

D.actions = withMeta([
  { id: 'ac-01', source: 'project_manager', title: 'Escalate CRM data access with the IT lead', rationale: 'CRM extraction is 5 days late and blocks the value model and sensitivity work feeding the 30 Oct SteerCo.', priority: 'high', owner_id: 'pe-02', due: '2026-10-22', status: 'proposed', task_id: 'tk-08', person_id: 'pe-10', milestone_id: 'ms-04' },
  { id: 'ac-02', source: 'project_manager', title: 'Agree a fallback scope for the sensitivity analysis', rationale: 'If data lands after 23 Oct, run sensitivity on the seven ready markets and show the other two as a range.', priority: 'medium', owner_id: 'pe-02', due: '2026-10-23', status: 'proposed', task_id: 'tk-10', milestone_id: 'ms-04' },
  { id: 'ac-03', source: 'project_manager', title: 'Pre-wire the sponsor on the value range', rationale: 'The value range is now driven by adoption; align the sponsor before SteerCo to avoid surprises.', priority: 'medium', owner_id: 'pe-01', due: '2026-10-27', status: 'accepted', person_id: 'pe-07', milestone_id: 'ms-04' },
  { id: 'ac-04', source: 'team_manager', title: 'Move CRM data QA from Mei to Lukas', rationale: 'Mei is planned at 130% of capacity in weeks 12-13 while Lukas is planned at 60%.', priority: 'high', owner_id: 'pe-02', due: '2026-10-22', status: 'proposed', task_id: 'tk-08', person_id: 'pe-05' },
  { id: 'ac-05', source: 'team_manager', title: 'Agree the value-model structure before the next review', rationale: 'The value model is on its third review cycle; agreeing the structure with the partner stops the rework.', priority: 'medium', owner_id: 'pe-04', due: '2026-10-23', status: 'proposed', task_id: 'tk-09', person_id: 'pe-04' },
  { id: 'ac-06', source: 'team_manager', title: 'Protect the engagement manager in weeks 13-14', rationale: 'Tomás is planned at 120-130% through SteerCo and board preparation; hand pre-wire logistics to Jonas.', priority: 'low', owner_id: 'pe-01', due: '2026-10-26', status: 'proposed', person_id: 'pe-02' }
]);

D.issue_nodes = withMeta([
  { id: 'in-01', kind: 'question', order: 1, text: 'How should Big Pharma AG scale its field-sales AI agents across the EU?' },
  { id: 'in-02', parent_id: 'in-01', kind: 'branch', order: 1, text: 'Is the value real and large enough?', answer: 'Yes: the pilot shows more and better calls, worth {value.net_impact} of EBIT a year at scale' },
  { id: 'in-03', parent_id: 'in-02', kind: 'hypothesis', order: 1, text: 'Freed admin time converts into more customer calls', status: 'confirmed', analysis: 'Pilot vs control call volumes' },
  { id: 'in-04', parent_id: 'in-02', kind: 'hypothesis', order: 2, text: 'Next-best-action raises prescription conversion', status: 'confirmed', analysis: 'Conversion by HCP segment, pilot vs control' },
  { id: 'in-05', parent_id: 'in-02', kind: 'hypothesis', order: 3, text: 'Personalised content lifts HCP engagement', status: 'open', analysis: 'Content open and follow-up rates' },
  { id: 'in-06', parent_id: 'in-02', kind: 'hypothesis', order: 4, text: 'Medical-legal review effort falls', status: 'confirmed', analysis: 'Review log, hours per item' },
  { id: 'in-07', parent_id: 'in-01', kind: 'branch', order: 2, text: 'Can it scale across all nine markets?', answer: 'Mostly: seven markets are ready; two need CRM data remediation first' },
  { id: 'in-08', parent_id: 'in-07', kind: 'hypothesis', order: 1, text: 'CRM data quality is sufficient in all markets', status: 'refuted', analysis: 'Record completeness by market' },
  { id: 'in-09', parent_id: 'in-07', kind: 'hypothesis', order: 2, text: 'Reps adopt the agents without extra incentives', status: 'open', analysis: 'Daily use over time; benchmark decay' },
  { id: 'in-10', parent_id: 'in-01', kind: 'branch', order: 3, text: 'Are the risks manageable?', answer: 'Yes, with medical-legal guardrails and early works-council engagement' },
  { id: 'in-11', parent_id: 'in-10', kind: 'hypothesis', order: 1, text: 'Guardrails keep compliance incidents at zero', status: 'confirmed', analysis: 'Incident log over generated notes' },
  { id: 'in-12', parent_id: 'in-10', kind: 'hypothesis', order: 2, text: 'Works councils accept usage analytics', status: 'open', analysis: 'Works council consultation, Germany' },
  { id: 'in-13', parent_id: 'in-01', kind: 'branch', order: 4, text: 'What does it take to deliver?', answer: 'Three gated waves over 18 months, with one-off cost recovered within two years' },
  { id: 'in-14', parent_id: 'in-13', kind: 'hypothesis', order: 1, text: 'A three-wave rollout over 18 months is feasible', status: 'open', analysis: 'Comparable rollout timelines' },
  { id: 'in-15', parent_id: 'in-13', kind: 'hypothesis', order: 2, text: 'The investment pays back within two years', status: 'confirmed', analysis: 'Value model cash profile' }
]);

D.sources = withMeta([
  { id: 'so-01', title: 'Pilot telemetry: 40 reps in 2 regions, Aug-Sep 2026', publisher: 'Big Pharma AG / project team', year: 2026, type: 'pilot_data', credibility: 'high' },
  { id: 'so-02', title: 'CRM activity extract, 9 EU markets, 2024-2026', publisher: 'Big Pharma AG IT', year: 2026, type: 'client_data', credibility: 'high' },
  { id: 'so-03', title: 'Rep survey after the pilot (n = 38)', publisher: 'Project team', year: 2026, type: 'pilot_data', credibility: 'medium' },
  { id: 'so-04', title: 'Benchmark: AI-assisted field-force programmes at 6 companies', publisher: 'Cantab Pi research', year: 2026, type: 'benchmark', credibility: 'medium' },
  { id: 'so-05', title: 'Interview: former head of sales operations, top-10 pharma', publisher: 'Expert network', year: 2026, type: 'expert_interview', credibility: 'medium' },
  { id: 'so-06', title: 'Medical-legal review log, pilot period', publisher: 'Big Pharma AG compliance', year: 2026, type: 'client_data', credibility: 'high' },
  { id: 'so-07', title: 'Interview: works council representative, Germany', publisher: 'Project team', year: 2026, type: 'expert_interview', credibility: 'medium' },
  { id: 'so-08', title: 'Industry report: generative AI in pharma commercial', publisher: 'Industry analyst', year: 2025, type: 'industry_report', credibility: 'low' }
]);

D.findings = withMeta([
  { id: 'fi-01', source_id: 'so-01', hypothesis_id: 'in-03', stance: 'supports', text: 'Pilot reps made 14% more calls per week than the control group', metric: '+14% calls', quote: "Treatment reps logged 14% more HCP calls per week than matched controls over weeks 3 to 8." },
  { id: 'fi-02', source_id: 'so-03', hypothesis_id: 'in-03', stance: 'supports', text: 'Reps report saving 3-4 hours a week on call notes and preparation', metric: '3.5 h/week', quote: "Notes and call prep used to take most of my Friday afternoon. Now it is done before I leave the car." },
  { id: 'fi-03', source_id: 'so-01', hypothesis_id: 'in-04', stance: 'supports', text: 'Conversion on visits suggested by next-best-action was 5% above control', metric: '+5% conv.', quote: "Visits suggested by next-best-action converted 5% better than comparable visits without a suggestion." },
  { id: 'fi-04', source_id: 'so-04', hypothesis_id: 'in-04', stance: 'supports', text: 'Benchmark programmes report 3-8% conversion uplift', metric: '3-8%', quote: "Reported conversion uplift ranged from 3% to 8% across the six programmes reviewed." },
  { id: 'fi-05', source_id: 'so-01', hypothesis_id: 'in-05', stance: 'neutral', text: 'Content open rates rose, but the follow-up effect was not significant after 6 weeks', metric: 'n.s.', quote: "Open rates on personalised content rose, but follow-up requests were flat after six weeks." },
  { id: 'fi-06', source_id: 'so-06', hypothesis_id: 'in-06', stance: 'supports', text: 'Review time per item fell from 9 to 4 hours', metric: '-5 h/item', quote: "Median review time per generated item fell from nine hours to four." },
  { id: 'fi-07', source_id: 'so-02', hypothesis_id: 'in-08', stance: 'refutes', text: 'Two markets have more than 30% of HCP records incomplete', metric: '>30% gaps', quote: "In two markets, more than 30% of HCP master records lack specialty or territory fields." },
  { id: 'fi-08', source_id: 'so-03', hypothesis_id: 'in-09', stance: 'supports', text: '78% of pilot reps used the agent daily by week 4', metric: '78% daily', quote: "By week four, 78% of pilot reps opened the agent on every working day." },
  { id: 'fi-09', source_id: 'so-05', hypothesis_id: 'in-09', stance: 'refutes', text: 'Adoption typically drops 15-20 points after a pilot without incentives', metric: '-15-20 pts', quote: "Once the pilot attention fades, daily use usually drops 15 to 20 points unless someone keeps chasing it." },
  { id: 'fi-10', source_id: 'so-06', hypothesis_id: 'in-11', stance: 'supports', text: 'Zero compliance incidents across 2,900 generated call notes', metric: '0 incidents', quote: "No off-label or compliance incident was raised across 2,900 generated call notes." },
  { id: 'fi-11', source_id: 'so-07', hypothesis_id: 'in-12', stance: 'refutes', text: 'Works council requires an opt-out from individual usage reporting', quote: "We will not accept individual usage reporting without an opt-out for each employee." },
  { id: 'fi-12', source_id: 'so-04', hypothesis_id: 'in-14', stance: 'supports', text: 'Comparable rollouts took 12-20 months across 6-10 markets', metric: '12-20 mo', quote: "Programmes covering six to ten markets took between 12 and 20 months to reach full rollout." },
  { id: 'fi-13', source_id: 'so-08', hypothesis_id: 'in-15', stance: 'neutral', text: 'Industry estimates of payback range widely, from 1 to 4 years', metric: '1-4 yrs', quote: "Published payback estimates for commercial AI range from one to four years." },
  { id: 'fi-14', source_id: 'so-01', hypothesis_id: 'in-15', stance: 'supports', text: 'Pilot unit economics imply payback within 18 months at 80% adoption', metric: '<18 mo', quote: "At 80% adoption, pilot unit economics pay back the rollout cost within 18 months." }
]);

// ---- Model (values computed from formulas) ----
const I = {
  C4: ['EU commercial EBIT 2026', 410, 0, '€m', 'FY2026 plan'],
  C5: ['Market momentum to 2028', -35, 0, '€m', 'Loss of exclusivity and price erosion'],
  C6: ['Field reps in scope', 2400, 0, 'reps', 'Nine EU markets'],
  C7: ['Admin hours freed per rep per week', 3.5, 1, 'h', 'Pilot telemetry and rep survey'],
  C8: ['Share of freed time used for calls', 60, 0, '%', 'Pilot observation'],
  C9: ['Calls per field hour', 1.6, 1, 'calls', 'CRM activity extract'],
  C10: ['Working weeks per year', 44, 0, 'weeks', 'HR calendar'],
  C11: ['Contribution per incremental call', 79, 0, '€', 'Finance, 2025 actuals'],
  C12: ['Revenue in scope for next-best-action', 1100, 0, '€m', 'Promoted brands, EU'],
  C13: ['Conversion uplift from next-best-action', 5, 1, '%', 'Pilot vs control'],
  C14: ['Contribution margin', 40, 0, '%', 'Finance'],
  C15: ['Revenue in scope for content', 750, 0, '€m', 'Brands with digital content'],
  C16: ['Engagement uplift from content', 3, 1, '%', 'Benchmark midpoint; pilot n.s.'],
  C17: ['Medical-legal reviews per year', 6000, 0, 'reviews', 'Compliance log'],
  C18: ['Hours saved per review', 5, 0, 'h', 'Pilot review log'],
  C19: ['Cost per review hour', 200, 0, '€', 'Compliance budget'],
  C20: ['Field-force hires avoided', 64, 0, 'FTE', 'Attrition backfill not needed'],
  C21: ['Fully loaded cost per rep', 125, 0, '€k', 'HR'],
  C22: ['AI run cost per rep per year', 5000, 0, '€', 'Vendor quote and cloud'],
  C23: ['Adoption rate at scale', 83, 0, '%', 'Pilot 78% daily use, ramped'],
  C24: ['Discount rate', 9, 1, '%', 'Group WACC'],
  C25: ['One-off rollout investment', 12, 0, '€m', 'Integration and training']
};
const iv = (r) => I[r][1];
const C = {};
C.C4 = ['Incremental calls per year', iv('C6') * iv('C7') * iv('C8') / 100 * iv('C9') * iv('C10'), 0, 'calls', 'Inputs!C6*Inputs!C7*Inputs!C8/100*Inputs!C9*Inputs!C10'];
C.C5 = ['Lever: more calls', C.C4[1] * iv('C11') / 1e6, 1, '€m', 'C4*Inputs!C11/1000000'];
C.C6 = ['Lever: next-best-action conversion', iv('C12') * iv('C13') / 100 * iv('C14') / 100, 1, '€m', 'Inputs!C12*Inputs!C13/100*Inputs!C14/100'];
C.C7 = ['Lever: content personalisation', iv('C15') * iv('C16') / 100 * iv('C14') / 100, 1, '€m', 'Inputs!C15*Inputs!C16/100*Inputs!C14/100'];
C.C8 = ['Lever: medical-legal review effort', iv('C17') * iv('C18') * iv('C19') / 1e6, 1, '€m', 'Inputs!C17*Inputs!C18*Inputs!C19/1000000'];
C.C9 = ['Lever: avoided hires', iv('C20') * iv('C21') / 1000, 1, '€m', 'Inputs!C20*Inputs!C21/1000'];
C.C10 = ['AI run cost', -iv('C6') * iv('C22') / 1e6, 1, '€m', '-Inputs!C6*Inputs!C22/1000000'];
C.C11 = ['Adoption haircut', -(C.C5[1] + C.C6[1] + C.C7[1]) * (1 - iv('C23') / 100), 1, '€m', '-(C5+C6+C7)*(1-Inputs!C23/100)'];
C.C12 = ['Momentum case 2028', iv('C4') + iv('C5'), 0, '€m', 'Inputs!C4+Inputs!C5'];
C.C13 = ['Net impact of scale-up', ['C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11'].reduce((s, k) => s + C[k][1], 0), 1, '€m', 'SUM(C5:C11)'];
const ramp = [0.6, 1, 1, 1, 1];
const r = iv('C24') / 100;
const npv = ramp.reduce((s, f, i) => s + C.C13[1] * f / Math.pow(1 + r, i + 1), 0) - iv('C25');
const O = {
  C4: ['EBIT 2028 with scale-up', C.C12[1] + C.C13[1], 0, '€m', 'Calculations!C12+Calculations!C13'],
  C5: ['5-year NPV of scale-up', npv, 0, '€m', 'NPV(Inputs!C24/100, Calculations!C13*{0.6,1,1,1,1})-Inputs!C25'],
  C6: ['Run-rate value per rep', C.C13[1] / iv('C6') * 1e6 / 1000, 1, '€k', 'Calculations!C13/Inputs!C6*1000']
};
D.model_cells = [];
n = 0;
const ids = {};
const push = (sheet, obj, kind) => {
  for (const [ref, [label, value, decimals, unit, x]] of Object.entries(obj)) {
    n += 1;
    const id = 'mc-' + String(n).padStart(2, '0');
    ids[sheet + '!' + ref] = id;
    const rec = { id, sheet, ref, label, kind, value: Math.round(value * 10000) / 10000, decimals, unit };
    if (kind === 'input') rec.note = x; else rec.formula = x;
    D.model_cells.push(rec);
  }
};
push('Inputs', I, 'input');
push('Calculations', C, 'calc');
push('Outputs', O, 'output');
D.model_cells = withMeta(D.model_cells);

const r1 = (v) => Math.round(v * 10) / 10;
D.value_steps = withMeta([
  { id: 'vs-01', order: 1, label: 'EBIT 2026', kind: 'start', value: iv('C4'), model_cell_id: ids['Inputs!C4'] },
  { id: 'vs-02', order: 2, label: 'Market\nmomentum', kind: 'delta', value: iv('C5'), model_cell_id: ids['Inputs!C5'] },
  { id: 'vs-03', order: 3, label: 'Momentum\ncase 2028', kind: 'subtotal', model_cell_id: ids['Calculations!C12'] },
  { id: 'vs-04', order: 4, label: 'More calls', kind: 'delta', value: r1(C.C5[1]), hypothesis_id: 'in-03', model_cell_id: ids['Calculations!C5'] },
  { id: 'vs-05', order: 5, label: 'Next-best\naction', kind: 'delta', value: r1(C.C6[1]), hypothesis_id: 'in-04', model_cell_id: ids['Calculations!C6'] },
  { id: 'vs-06', order: 6, label: 'Content', kind: 'delta', value: r1(C.C7[1]), hypothesis_id: 'in-05', model_cell_id: ids['Calculations!C7'] },
  { id: 'vs-07', order: 7, label: 'Review\neffort', kind: 'delta', value: r1(C.C8[1]), hypothesis_id: 'in-06', model_cell_id: ids['Calculations!C8'] },
  { id: 'vs-08', order: 8, label: 'Avoided\nhires', kind: 'delta', value: r1(C.C9[1]), model_cell_id: ids['Calculations!C9'] },
  { id: 'vs-09', order: 9, label: 'AI run\ncost', kind: 'delta', value: r1(C.C10[1]), model_cell_id: ids['Calculations!C10'] },
  { id: 'vs-10', order: 10, label: 'Adoption\nhaircut', kind: 'delta', value: r1(C.C11[1]), hypothesis_id: 'in-09', model_cell_id: ids['Calculations!C11'] },
  { id: 'vs-11', order: 11, label: 'Target 2028', kind: 'subtotal', model_cell_id: ids['Outputs!C4'] }
]);

D.value_settings = withMeta([{ id: 'vt-01', npv_base: Math.round(npv), npv_cell_id: ids['Outputs!C5'], annotation_from_id: 'vs-03', annotation_to_id: 'vs-11' }]);

D.sensitivity_drivers = withMeta([
  { id: 'sd-01', name: 'Rep adoption rate', downside_input: '55%', downside_value: 118, upside_input: '90%', upside_value: 190 },
  { id: 'sd-02', name: 'Next-best-action uplift', downside_input: '3%', downside_value: 132, upside_input: '8%', upside_value: 197 },
  { id: 'sd-03', name: 'Admin time freed', downside_input: '2.5 h/wk', downside_value: 141, upside_input: '5 h/wk', upside_value: 186 },
  { id: 'sd-04', name: 'Rollout speed', downside_input: '18 mo', downside_value: 145, upside_input: '9 mo', upside_value: 181 },
  { id: 'sd-05', name: 'AI run cost per rep', downside_input: '€7.5k', downside_value: 151, upside_input: '€3.5k', upside_value: 177 },
  { id: 'sd-06', name: 'Discount rate', downside_input: '11%', downside_value: 154, upside_input: '8%', upside_value: 178 },
  { id: 'sd-07', name: 'Content uplift', downside_input: '0%', downside_value: 159, upside_input: '4%', upside_value: 174 }
]);

D.narratives = withMeta([
  { id: 'nv-01', view: 'value_estimator', slot: 'bridge.eyebrow', order: 1, text: 'EBIT bridge · EU commercial · €m · run-rate 2028', highlight: false },
  { id: 'nv-02', view: 'value_estimator', slot: 'bridge.title', order: 1, text: 'Scaling the agents lifts 2028 EBIT to {bridge.target}, {bridge.net_impact} above the momentum case', highlight: false },
  { id: 'nv-03', view: 'value_estimator', slot: 'bridge.annotation', order: 1, text: '{bridge.net_impact} net impact', highlight: false },
  { id: 'nv-04', view: 'value_estimator', slot: 'bridge.footnote', order: 1, text: 'Momentum case = 2028 EBIT without the agents. Levers are sized from the two-region pilot; the adoption haircut applies to the call, conversion and content levers. Illustrative figures.', highlight: false },
  { id: 'nv-05', view: 'value_estimator', slot: 'sensitivity.eyebrow', order: 1, text: 'Sensitivity · 5-year NPV · €m · one input at a time', highlight: false },
  { id: 'nv-06', view: 'value_estimator', slot: 'sensitivity.title', order: 1, text: '{sensitivity.top_driver} is the swing factor; no single input turns NPV negative', highlight: false },
  { id: 'nv-07', view: 'value_estimator', slot: 'so_what.title', order: 1, text: 'Approve the scale-up in three waves, gated on adoption', highlight: false },
  { id: 'nv-08', view: 'value_estimator', slot: 'so_what.point', order: 1, text: 'Rep adoption drives the largest NPV swing. Pilot reps reached 78% daily use, but benchmarks show a 15-20 point drop without incentives.', highlight: false },
  { id: 'nv-09', view: 'value_estimator', slot: 'so_what.point', order: 2, text: 'Even at the downside adoption rate NPV stays at {sensitivity.top_downside}, so the case survives a plausible miss.', highlight: false },
  { id: 'nv-10', view: 'value_estimator', slot: 'so_what.point', order: 3, text: 'Approve wave 1 (Germany, Italy) now; release wave 2 only if daily use stays above 70% by month 4.', highlight: true },
  { id: 'nv-11', view: 'presentation_builder', slot: 'governing_thought', order: 1, text: 'Scale the field-sales agents to all nine EU markets in three gated waves: the pilot proved {value.net_impact} of annual EBIT, and the remaining risks are manageable.', highlight: false }
]);

D.deck = withMeta([{ id: 'dk-01', title: 'Scaling field-sales AI agents across the EU', version: 'v1.0', date: '2026-10-22', status: 'review', pdf_url: 'deck/scale-up-proposal.pdf' }]);

D.slides = withMeta([
  { id: 'sl-01', number: 1, section: 'Cover', title: 'Scaling field-sales AI agents across the EU', status: 'review' },
  { id: 'sl-02', number: 2, section: 'Summary', title: 'Scaling the field-sales agents across the EU adds about €51m of EBIT a year from 2028', issue_node_id: 'in-01', status: 'review' },
  { id: 'sl-03', number: 3, section: 'Evidence', title: 'The pilot proved the value: 14% more calls, 5% higher conversion and zero compliance incidents', issue_node_id: 'in-02', status: 'review' },
  { id: 'sl-04', number: 4, section: 'Value', title: 'The scale-up lifts 2028 EBIT to €426m, €51m above the momentum case, and holds even at 55% adoption', issue_node_id: 'in-15', status: 'review' },
  { id: 'sl-05', number: 5, section: 'Feasibility and risks', title: 'Seven of nine markets are ready now, and the remaining risks are manageable with gated waves', issue_node_id: 'in-07', status: 'review' },
  { id: 'sl-06', number: 6, section: 'Decision', title: 'We ask the Board to approve wave 1 now and release waves 2 and 3 on adoption gates', issue_node_id: 'in-13', status: 'review' }
]);

D.skills = withMeta([
  { id: 'sk-01', name: 'Summarise CRM history', description: 'Condenses recent HCP interactions into a short brief' },
  { id: 'sk-02', name: 'Next-best-action', description: 'Ranks approved messages for an HCP from history and segment' },
  { id: 'sk-03', name: 'Compliance check', description: 'Screens text against medical-legal rules and approved claims' },
  { id: 'sk-04', name: 'Plan analysis', description: 'Finds slippage, float and dependency conflicts in the plan' },
  { id: 'sk-05', name: 'Recommended actions', description: 'Drafts actions with owner, due date and rationale' },
  { id: 'sk-06', name: 'Bridge and sensitivity', description: 'Builds value bridges and tornado charts from model outputs' },
  { id: 'sk-07', name: 'Executive writing', description: 'Writes action titles and so-what statements in house style' },
  { id: 'sk-08', name: 'Model reconciliation', description: 'Compares view figures with model cells and flags differences' },
  { id: 'sk-09', name: 'Interview extraction', description: 'Pulls claims, numbers and verbatim quotes from interview notes' },
  { id: 'sk-10', name: 'Hypothesis mapping', description: 'Matches claims to hypotheses in the issue tree and sets the stance' }
]);
D.agents = withMeta([
  { id: 'ag-01', name: 'Call-prep agent', audience: 'client', goal: "Prepare every rep for tomorrow's HCP calls with recent history, one approved next-best message and any open requests.", trigger: 'Daily at 06:00 local time, workdays', owner_id: 'pe-06', status: 'live', skill_ids: ['sk-01', 'sk-02', 'sk-03'],
    system_prompt: "You prepare field sales reps at Big Pharma AG for their next working day.\nFor each HCP on the rep's route plan, summarise the last three interactions in CRM in no more than three lines.\nSuggest exactly one next-best message, chosen only from the approved content library, and say why in one sentence.\nFlag any open medical information request for that HCP.\nNever mention off-label use or competitor products by name. Anything clinical must quote approved content verbatim.\nWrite a one-page brief per rep and log a call-prep note against each HCP in CRM.\nIf data is missing or a rule would be broken, say so in the brief instead of guessing." },
  { id: 'ag-02', name: 'Project manager agent', audience: 'team', goal: 'Keep the plan true to today and tell the engagement manager what to do this week.', trigger: 'On every plan change, and daily at 08:00', owner_id: 'pe-02', status: 'live', skill_ids: ['sk-04', 'sk-05'],
    system_prompt: "You are the project manager agent for the Big Pharma AG engagement.\nRead the plan as of the engagement's as-of date. Find late tasks, tasks at risk, dependency conflicts and milestones with no float.\nUpdate task status and dates only when the owner has confirmed them.\nFor each real issue, raise one recommended action with an owner, a due date and a one-sentence rationale that names the consequence.\nNever raise more than five open actions at once; close or merge before adding.\nWrite for the engagement manager: short, specific, no jargon." },
  { id: 'ag-03', name: 'Value estimator agent', audience: 'team', goal: 'Keep the value bridge, sensitivity and so-what consistent with the model and the evidence.', trigger: 'When model outputs change', owner_id: 'pe-04', status: 'testing', skill_ids: ['sk-06', 'sk-07', 'sk-08'],
    system_prompt: "You maintain the client-facing value view for the Big Pharma AG scale-up.\nWhen the model changes, align each bridge step to its linked model cell and re-run the sensitivity drivers before changing the base NPV.\nWrite every figure in titles and so-what points as a placeholder, never as typed numbers.\nKeep one highlighted recommendation, phrased as a decision the client can take.\nIf the model and the evidence disagree, do not change the model; raise it with the model builder." },
  { id: 'ag-04', name: 'Interview synthesis agent', audience: 'team', goal: 'Turn interview notes into sourced findings mapped to the issue tree, so the team sees within minutes what each interview proves or disproves.', trigger: 'On upload of interview notes; digest Fridays 16:00', owner_id: 'pe-03', status: 'testing', skill_ids: ['sk-09', 'sk-10', 'sk-07'],
    system_prompt: "You support the Big Pharma AG consulting team.\nWhen interview notes are uploaded, register the interview as a source with its type and a credibility rating, and say in one line why you rated it so.\nExtract every claim that bears on a hypothesis in the issue tree. Record it as a finding with a verbatim quote, a short metric where the notes give a number, and whether it supports, refutes or leaves the hypothesis open.\nNever paraphrase inside a quote, and never name an interviewee who asked to stay anonymous.\nIf a claim fits no hypothesis, list it in the digest as a possible new branch instead of forcing it into the tree.\nIf new evidence contradicts a hypothesis's status, flag it to the analyst. Do not change the status yourself.\nEvery Friday, post a one-page digest: new findings by branch, contradictions, and hypotheses that still rest on fewer than two findings." }
]);
const AL = [
  ['ag-01', 'tools', 'Route plan and call history', 'Last three interactions per HCP', 'read', 'CRM'],
  ['ag-01', 'tools', 'Approved content library', 'Approved items with claims metadata', 'read', 'Content library'],
  ['ag-01', 'tools', 'Medical information requests', 'Open requests per HCP', 'read', 'MI system'],
  ['ag-01', 'tools', 'Call-prep note', 'One note per HCP, before 07:00', 'write', 'CRM'],
  ['ag-01', 'state', 'last_run', 'Start of the latest run', null, null, 'datetime', '2026-10-21 06:00'],
  ['ag-01', 'state', 'reps_in_scope', 'Reps receiving briefs', null, null, 'integer', '40'],
  ['ag-01', 'state', 'wave', 'Rollout wave', null, null, 'text', 'Pilot: 2 regions'],
  ['ag-01', 'guardrails', 'Never mention off-label use'],
  ['ag-01', 'guardrails', 'No competitor product names'],
  ['ag-01', 'guardrails', 'Clinical statements quote approved content verbatim'],
  ['ag-01', 'guardrails', 'Weekly human review of a 5% sample of outputs', 'Compliance lead reviews and signs off'],
  ['ag-02', 'tools', 'tasks', 'Dates, status, progress, owner', 'read_write', 'Engagement data'],
  ['ag-02', 'tools', 'milestones', 'Status and date', 'read_write', 'Engagement data'],
  ['ag-02', 'tools', 'deliverables', 'Status and due date', 'read_write', 'Engagement data'],
  ['ag-02', 'tools', 'actions', 'Only actions it raised', 'read_write', 'Engagement data'],
  ['ag-02', 'tools', 'people and phases', 'Context for owners and dates', 'read', 'Engagement data'],
  ['ag-02', 'state', 'as_of', 'Date the plan is judged against', null, null, 'date', '2026-10-21'],
  ['ag-02', 'state', 'open_actions', 'Actions it raised that are still open', null, null, 'integer', '3'],
  ['ag-02', 'state', 'last_review', 'Latest full plan review', null, null, 'datetime', '2026-10-21 08:00'],
  ['ag-02', 'guardrails', "Never mark work done without the owner's confirmation"],
  ['ag-02', 'guardrails', 'Escalations go to the engagement manager, not to the client'],
  ['ag-02', 'guardrails', 'At most five open actions at a time'],
  ['ag-03', 'tools', 'value_steps', 'Bridge bars and links to the model', 'read_write', 'Engagement data'],
  ['ag-03', 'tools', 'sensitivity_drivers', 'Tornado inputs', 'read_write', 'Engagement data'],
  ['ag-03', 'tools', 'narratives', 'Value view text only', 'read_write', 'Engagement data'],
  ['ag-03', 'tools', 'model_cells', 'Model inputs and outputs', 'read', 'Engagement data'],
  ['ag-03', 'tools', 'findings', 'Evidence behind each lever', 'read', 'Engagement data'],
  ['ag-03', 'state', 'model_version', 'Model version last aligned to', null, null, 'text', 'v4, 21 Oct'],
  ['ag-03', 'state', 'links_differing', 'Bridge links that differ from the model', null, null, 'integer', '0'],
  ['ag-03', 'state', 'npv_base', 'Base NPV used by the tornado, €m', null, null, 'number', '168'],
  ['ag-03', 'guardrails', 'Every figure in narrative text is a placeholder'],
  ['ag-03', 'guardrails', 'Never changes model cells; asks the model builder'],
  ['ag-03', 'guardrails', 'Client-facing text stays within slot limits'],
  ['ag-04', 'tools', 'Interview notes', 'Uploaded notes and transcripts', 'read', 'Team drive'],
  ['ag-04', 'tools', 'issue_nodes', 'Hypotheses to map claims to', 'read', 'Engagement data'],
  ['ag-04', 'tools', 'sources', 'Registers each interview as a source', 'read_write', 'Engagement data'],
  ['ag-04', 'tools', 'findings', 'Claims with quote, metric and stance', 'read_write', 'Engagement data'],
  ['ag-04', 'tools', 'Weekly evidence digest', 'Posts the Friday digest', 'action', 'Team channel'],
  ['ag-04', 'state', 'interviews_processed', 'Interviews turned into findings so far', null, null, 'integer', '7'],
  ['ag-04', 'state', 'last_digest', 'Date of the latest Friday digest', null, null, 'date', '2026-10-16'],
  ['ag-04', 'state', 'open_contradictions', 'Contradictions flagged and not yet resolved', null, null, 'integer', '1'],
  ['ag-04', 'state', 'awaiting_review', 'New findings a consultant has not yet checked', null, null, 'list', 'fi-11, fi-12'],
  ['ag-04', 'guardrails', 'Quotes are verbatim; never paraphrase inside quotation marks'],
  ['ag-04', 'guardrails', 'Never names an interviewee who asked to stay anonymous'],
  ['ag-04', 'guardrails', 'Never changes a hypothesis status; flags it to the analyst'],
  ['ag-04', 'guardrails', 'A consultant reviews every new finding before client use', 'Unreviewed findings never reach a client deck']
];
const alOrd = {};
D.agent_lines = withMeta(AL.map((x, i) => {
  const [agent_id, block, name, detail, access, resource, type, value] = x;
  const k = agent_id + block; alOrd[k] = (alOrd[k] || 0) + 1;
  const r = { id: 'al-' + String(i + 1).padStart(3, '0'), agent_id, block, order: alOrd[k], name };
  if (detail) r.detail = detail;
  if (access) { r.access = access; r.resource = resource; }
  if (type) { r.type = type; if (value != null) r.value = value; }
  return r;
}));

D.proposal = withMeta([{ id: 'pr-01', title: 'Wave 1 rollout of field-sales AI agents: Germany and Italy', addressee_id: 'pe-07', date: '2026-11-27', status: 'draft' }]);
D.proposal_sections = withMeta([
  { id: 'ps-01', key: 'context', order: 1, title: 'Context', text: 'Over eight weeks, 40 reps in two regions used AI agents for call preparation, next-best-action and call notes. They made 14% more calls, converted 5% better on suggested visits, and generated 2,900 call notes without a compliance incident. The Board is asked to approve the scale-up on 6 November.' },
  { id: 'ps-02', key: 'objectives', order: 2, title: 'Objectives', text: 'Roll the agents out to all field reps in Germany and Italy within 16 weeks.\nReach at least 70% daily use by month 4, the gate for wave 2.\nHand over a run model that {client.name} operates without external support.' },
  { id: 'ps-03', key: 'scope', order: 3, title: 'Scope', text: 'In scope: about 900 reps in Germany and Italy, the three pilot agents, CRM integration, medical-legal guardrails, training and adoption tracking. Out of scope: new agent use cases, markets beyond wave 1, and changes to incentive schemes.' },
  { id: 'ps-04', key: 'approach', order: 4, title: 'Approach', text: 'Weeks 1-4: production readiness, data remediation and guardrail sign-off.\nWeeks 5-12: rollout in four cohorts with floor-walkers and weekly adoption reviews.\nWeeks 13-16: stabilisation, run-model handover and the wave-2 gate assessment.' },
  { id: 'ps-05', key: 'team', order: 5, title: 'Team', text: 'The pilot team continues, led by the engagement manager with partner oversight. The client provides a product owner, a data platform lead and a compliance reviewer for the full 16 weeks.' },
  { id: 'ps-06', key: 'fees', order: 6, title: 'Fees', text: 'Professional fees total {fees.total} for {fees.days} consultant days, set out below. Expenses are charged at cost and capped at 8% of fees.' },
  { id: 'ps-07', key: 'terms', order: 7, title: 'Terms', text: 'This proposal is valid for 60 days and is subject to the framework agreement between {client.name} and Cantab Pi. Fees are invoiced monthly in arrears.' }
]);
D.proposal_staffing = withMeta([
  { id: 'pf-01', person_id: 'pe-01', days: 16 },
  { id: 'pf-02', person_id: 'pe-02', days: 80 },
  { id: 'pf-03', person_id: 'pe-03', days: 80 },
  { id: 'pf-04', person_id: 'pe-04', days: 60 },
  { id: 'pf-05', person_id: 'pe-05', days: 40 },
  { id: 'pf-06', person_id: 'pe-06', days: 64 }
]);

// ---- Simulated agent edits after seeding (gives the change log and highlights real content) ----
const log = [];
let gv = 1;
const tableVersion = Object.fromEntries(Object.keys(D).map((k) => [k, 1]));
function edit(agent, at, reason, table, id, before, after) {
  gv += 1;
  const rec = D[table].find((x) => x.id === id);
  Object.assign(rec, after);
  rec._meta = meta(gv, at, agent, reason);
  tableVersion[table] = gv;
  log.push({ version: gv, at, agent, reason, changes: [{ op: before ? 'update' : 'create', table, id, before: before || null, after }] });
}
edit('project_manager', '2026-10-21T09:12:00Z', 'CRM extract not received from IT; task now 5 days overdue', 'tasks', 'tk-08', { status: 'in_progress', progress_pct: 60 }, { status: 'late', progress_pct: 70 });
edit('project_manager', '2026-10-21T09:13:00Z', 'Business case depends on the late CRM extract', 'milestones', 'ms-04', { status: 'planned' }, { status: 'at_risk' });
edit('team_manager', '2026-10-21T09:20:00Z', 'Mei planned above capacity in weeks 12-13', 'actions', 'ac-04', null, (({ _meta, ...x }) => x)(D.actions.find((a) => a.id === 'ac-04')));
edit('model_builder', '2026-10-21T09:41:00Z', 'Conversion uplift updated to the pilot result (5%)', 'model_cells', ids['Calculations!C6'], { value: 20 }, { value: D.model_cells.find((m) => m.id === ids['Calculations!C6']).value });
edit('value_estimator', '2026-10-21T09:45:00Z', 'Next-best-action lever aligned to the model', 'value_steps', 'vs-05', { value: 20 }, { value: r1(C.C6[1]) });

// ---- Write ----
fs.mkdirSync(SEED, { recursive: true });
for (const [t, rows] of Object.entries(D)) {
  const s = JSON.stringify(rows, null, 2) + '\n';
  fs.writeFileSync(path.join(DATA, t + '.json'), s);
  fs.writeFileSync(path.join(SEED, t + '.json'), s);
}
const version = { global: gv, tables: tableVersion };
fs.writeFileSync(path.join(DATA, '_version.json'), JSON.stringify(version, null, 2) + '\n');
fs.writeFileSync(path.join(SEED, '_version.json'), JSON.stringify(version, null, 2) + '\n');
fs.writeFileSync(path.join(DATA, '_log.json'), JSON.stringify(log, null, 2) + '\n');
fs.writeFileSync(path.join(SEED, '_log.json'), JSON.stringify(log, null, 2) + '\n');

console.log('tables', Object.keys(D).length, 'global version', gv);
console.log('model: net impact', C.C13[1].toFixed(2), 'target', O.C4[1].toFixed(2), 'npv', npv.toFixed(2), 'calls lever', C.C5[1].toFixed(2), 'haircut', C.C11[1].toFixed(2));
