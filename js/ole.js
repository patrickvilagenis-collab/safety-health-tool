// ole.js — domain content for Operational Learning Events (OLE).
//
// An OLE is a facilitated learning meeting: a task/process is broken into
// steps; for each step the team captures findings (with 4D mapping and observed
// process variability); findings can also sit OUTSIDE the swimlane (systemic /
// not tied to a single step). Findings generate traceable actions.

export const OLE_STATUSES = [
  { id: 'new', label: 'New', tone: 'warn' },
  { id: 'in_progress', label: 'In progress', tone: 'warn' },
  { id: 'completed', label: 'Completed', tone: 'ok' },
  { id: 'actions_pending', label: 'Actions pending', tone: 'bad' },
  { id: 'closed', label: 'Closed', tone: 'good' },
];
export const getOleStatus = (id) => OLE_STATUSES.find((s) => s.id === id) || { id, label: id, tone: 'muted' };

// The 4 D's — a registered trademark of Learning Teams Inc.
export const FOUR_D = [
  { id: 'different', label: 'Different', icon: '🔀', desc: 'Done differently than the standard or what is normally expected' },
  { id: 'difficult', label: 'Difficult', icon: '🥵', desc: 'Takes the most effort or concentration' },
  { id: 'dumb', label: 'Dumb', icon: '🤔', desc: "Doesn't make sense or seems illogical" },
  { id: 'dangerous', label: 'Dangerous', icon: '⚠️', desc: 'Could go wrong or lead to injury or harm' },
];
export const getFourD = (id) => FOUR_D.find((d) => d.id === id);

export const FINDING_SEVERITY = ['Low', 'Medium', 'High'];
export const ATTENDEE_ROLES = ['Facilitator', 'Participant', 'Technician', 'Supervisor', 'Observer', 'Process owner', 'Subcontractor'];

let _seq = 0;
const uid = (p) => `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const newStep = (order) => ({ id: uid('step'), order: order || 0, name: '', description: '' });

export const newFinding = (stepId = null) => ({
  id: uid('find'),
  stepId,                 // null ⇒ outside the swimlane (systemic)
  description: '',
  fourD: [],              // ids from FOUR_D
  variability: false,     // does the work deviate from the standard?
  variabilityDesc: '',    // describe the variability observed
  location: '',           // where it was found (machine room, pit…)
  severity: 'Medium',
  photos: [],
});

export const newAttendee = () => ({ name: '', role: 'Participant', company: 'Schindler' });

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------
export function oleFindings(o) { return Array.isArray(o.findings) ? o.findings : []; }
export function oleSwimlaneFindings(o) { return oleFindings(o).filter((f) => f.stepId); }
export function oleOutsideFindings(o) { return oleFindings(o).filter((f) => !f.stepId); }
export function oleVariabilityCount(o) { return oleFindings(o).filter((f) => f.variability).length; }
export function oleFourDCount(o, d) { return oleFindings(o).filter((f) => (f.fourD || []).includes(d)).length; }

export function oleFourDTotals(list) {
  const m = Object.fromEntries(FOUR_D.map((d) => [d.id, 0]));
  for (const o of list) for (const f of oleFindings(o)) for (const d of (f.fourD || [])) if (m[d] != null) m[d]++;
  return FOUR_D.map((d) => [`${d.icon} ${d.label}`, m[d.id]]);
}
