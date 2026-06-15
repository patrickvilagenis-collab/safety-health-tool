// accidents.js — domain content for the Accident Reporting module:
// the energy-based incident taxonomy (SIF), categorisation lists and the
// root-cause analysis (RCA) methodologies with their layouts.

// Energy-based incident classification (SIF taxonomy).
export const ACCIDENT_TYPES = [
  {
    id: 'he_sif', label: 'High Energy SIF', short: 'HE SIF', tone: 'bad', sif: true,
    severity: 'Fatality / Serious Injury', highEnergy: true, control: false,
    desc: 'Fatality or serious injury resulting from a release of high energy.',
  },
  {
    id: 'serious_near_miss', label: 'Serious Near Miss (pSIF)', short: 'pSIF', tone: 'bad', sif: false,
    severity: 'Potential serious injury', highEnergy: true, control: false,
    desc: 'Incident with a release of high energy in the absence of a direct control where a serious injury is NOT sustained.',
  },
  {
    id: 'sif_exposure', label: 'SIF Exposure', short: 'Exposure', tone: 'warn', sif: false,
    severity: 'Exposure', highEnergy: true, control: false,
    desc: 'Condition where high energy is present in the absence of a direct control.',
  },
  {
    id: 'safeguard_worked', label: 'Safeguard Worked', short: 'Safeguard', tone: 'good', sif: false,
    severity: 'Controlled', highEnergy: true, control: true,
    desc: 'Incident with a release of high energy in the presence of a direct control where a serious injury is NOT sustained.',
  },
  {
    id: 'low_energy_sif', label: 'Low Energy SIF', short: 'LE SIF', tone: 'warn', sif: true,
    severity: 'Serious injury (low energy)', highEnergy: false, control: null,
    desc: 'Incident with a release of low energy where a serious injury IS sustained.',
  },
  {
    id: 'low_severity', label: 'Low Severity', short: 'Low', tone: 'muted', sif: false,
    severity: 'Low', highEnergy: false, control: null,
    desc: 'Low-priority situation that did not result in, or is unlikely to result in, a SIF.',
  },
];

export const getAccidentType = (id) => ACCIDENT_TYPES.find((t) => t.id === id) || null;

export const INCIDENT_CATEGORIES = [
  'Injury / illness', 'Near miss', 'Property / equipment damage', 'Environmental',
  'Vehicle', 'Fire / explosion', 'Dangerous occurrence', 'Other',
];

export const INJURY_NATURES = [
  'None', 'Bruise / contusion', 'Cut / laceration', 'Fracture', 'Sprain / strain',
  'Burn', 'Electric shock', 'Crush', 'Amputation', 'Fatality', 'Other',
];

export const BODY_PARTS = [
  'Head', 'Eyes', 'Face', 'Neck', 'Back', 'Chest', 'Arm', 'Hand / fingers',
  'Leg', 'Foot', 'Multiple', 'Other / n.a.',
];

export const ACCIDENT_STATUSES = ['draft', 'reported', 'investigation', 'closed'];

// ---------------------------------------------------------------------------
// RCA methodologies — each has its own layout in the form.
// ---------------------------------------------------------------------------
export const METHODOLOGIES = [
  { id: 'five_whys', label: '5 Whys', icon: '➤',
    hint: 'Ask "why" iteratively, drilling from the problem statement down to the root cause.' },
  { id: 'fishbone', label: 'Fishbone (Ishikawa)', icon: '🐟',
    hint: 'Group the possible causes of the effect into the 6M categories.' },
  { id: 'tripod', label: 'Tripod Beta', icon: '△',
    hint: 'Map Hazard → Event → Target and, for each failed barrier, its active failure, precondition and latent (organisational) failure.' },
  { id: 'taproot', label: 'TapRooT', icon: '🌳',
    hint: 'Build the sequence of events (SnapCharT), then analyse each causal factor down to its root cause category.' },
];

export const getMethodology = (id) => METHODOLOGIES.find((m) => m.id === id) || null;

// Energy helpers — read from the detailed per-energy rows when present, falling
// back to the older single/array fields and the classification flags.
export function accidentEnergyRows(a) {
  return Array.isArray(a.energy) ? a.energy.filter((e) => e.energyId) : [];
}
export function accidentEnergyIds(a) {
  const rows = accidentEnergyRows(a);
  if (rows.length) return rows.map((e) => e.energyId);
  if (Array.isArray(a.energyTypes) && a.energyTypes.length) return a.energyTypes;
  return a.energyType ? [a.energyType] : [];
}
export function accidentHighEnergy(a) {
  const rows = accidentEnergyRows(a);
  if (rows.length) return rows.some((e) => e.highEnergy);
  return !!a.highEnergy;
}
export function accidentDirectControl(a) {
  const rows = accidentEnergyRows(a);
  if (rows.length) return rows.every((e) => e.directControl);
  return !!a.directControlPresent;
}

// Fishbone 6M
export const FISHBONE_CATEGORIES = ['People', 'Method', 'Machine', 'Material', 'Measurement', 'Environment'];

// TapRooT Root Cause Tree (simplified basic-cause categories)
export const TAPROOT_CATEGORIES = [
  'Procedures', 'Training', 'Quality Control', 'Communications', 'Management System',
  'Human Engineering', 'Work Direction', 'Immediate Supervision', 'Equipment / Material', 'External / Other',
];

// Empty RCA scaffold — every methodology keeps its own data so the user can
// switch methodology without losing what they entered.
export function emptyRca() {
  return {
    five_whys: { problem: '', branches: [newWhyBranch()] }, // multiple causal factors, each a why-chain
    fishbone: { effect: '', causes: Object.fromEntries(FISHBONE_CATEGORIES.map((c) => [c, ['']])) },
    tripod: { agent: '', event: '', target: '', barriers: [] }, // barrier: {desc, active, precondition, latent}
    taproot: { events: [''], factors: [] },                     // factor: {desc, category, root}
  };
}

export const newWhyBranch = () => ({ factor: '', whys: ['', '', ''], root: '' });
export const newTripodBarrier = () => ({ desc: '', active: '', precondition: '', latent: '' });
export const newTaprootFactor = () => ({ desc: '', whys: [''], category: '', root: '' });
