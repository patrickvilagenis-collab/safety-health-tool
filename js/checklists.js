// checklists.js
// Domain content for the Safety Platform field visits.
// Derived from the "New SAFE visit process" field safety quick book,
// extended with Energy-Based Safety (EBS) and Job Hazard Analysis (JHA).
//
// A template is rendered by visitForm.js. Each item is answered with
// Conform / Variability / N/A, an optional remark and optional photos.

export const ANSWERS = [
  { id: 'conform', label: 'Conform', short: 'C', tone: 'good' },
  { id: 'variability', label: 'Variability', short: 'V', tone: 'bad' },
  { id: 'na', label: 'N/A', short: 'N/A', tone: 'muted' },
];

// Work types observed in the field (lift / elevator context).
export const WORK_TYPES = [
  'New installation (NI)',
  'Transformation (TRANS)',
  'Modernization (MOD)',
  'Repairs (REP)',
  'Existing installation / Maintenance (EI)',
];

export const EMPLOYEE_TYPES = ['Schindler', 'Subcontractor'];

export const INSTALLATION_TYPES = ['MR (Machine Room)', 'MRL (Machine Room-Less)'];

export const TRACTION_TYPES = [
  'EG (one speed)',
  'FA (two-speed)',
  'VF (variable frequency drive)',
  'HY (hydraulic)',
];

// ---------------------------------------------------------------------------
// Energy-Based Safety (EBS) — the Schindler Hazard Wheel
// Ten types of high-energy hazards ("STKY — Stuff That Kills You"). For each
// hazard present in the task you record the danger zone, whether a direct
// control exists and its condition, plus the hierarchy-of-controls level.
// ---------------------------------------------------------------------------
export const ENERGY_TYPES = [
  { id: 'gravity', label: 'Gravity', icon: '⬇️', hint: 'Falling from height ≥2 m · standing below/near hoisted loads · dropped objects during dismantling' },
  { id: 'motion', label: 'Motion', icon: '🔄', hint: 'Collision with vehicles >50 km/h · adjacent elevators running · counterweight movement on car roof · ejected debris from tools · steps/pallets movement' },
  { id: 'mechanical', label: 'Mechanical', icon: '⚙️', hint: 'Rotating equipment >100 rpm · entanglement in rotating parts · entrapment on chains/sprockets/belts · fly-off fragments · spring-loaded/tensioning releases' },
  { id: 'electrical', label: 'Electrical', icon: '⚡', hint: 'Contact with live circuits >50 V · arc flash · step & touch potential · charged capacitors · induced voltage · wrong LOTO' },
  { id: 'sound', label: 'Sound', icon: '🔊', hint: 'Miscommunication from loud noise · noise >150 dB (hearing loss) · surrounding noise masking warnings' },
  { id: 'biological', label: 'Biological', icon: '🦠', hint: 'Toxic gases inhalation · infectious diseases (needles/waste) · rodent infestation · bacteria in pit water · toxic dense gases trapped in pit' },
  { id: 'chemical', label: 'Chemical', icon: '🧪', hint: 'Asbestos in older equipment/walls · dust inhalation · skin & eye irritation' },
  { id: 'pressure', label: 'Pressure', icon: '💨', hint: 'Blast/explosion (compressor, flammable gases in pit) · hydraulic jack/rod release · hose damage · steam/chemical burns · pressurized buffers' },
  { id: 'temperature', label: 'Temperature', icon: '🌡️', hint: 'Surfaces ≥70 °C → 3rd-degree burns in ~2 s (brake drums/discs, motor) · overheated REP areas · just-cut/welded surfaces · arc-flash thermal energy' },
  { id: 'radiation', label: 'Radiation', icon: '☢️', hint: 'Welding arc · laser level eye contact · high-intensity light · prolonged sun (outdoor/glass lifts) · non-ionizing sources (antennas, transmitters)' },
];

// The danger zones where these hazards are typically found.
export const DANGER_ZONES = [
  { id: 'machine_room', label: 'Machine Room', icon: '⚙️' },
  { id: 'car_top', label: 'Car top', icon: '🛗' },
  { id: 'shaft_pit', label: 'Shaft / Pit', icon: '🕳️' },
  { id: 'escalator', label: 'Escalator', icon: '🪜' },
  { id: 'motor_vehicle', label: 'Motor vehicle', icon: '🚐' },
];

// Hierarchy of Controls — most effective at the top.
export const CONTROL_HIERARCHY = [
  { id: 'elimination', label: 'Elimination', rank: 1, tone: 'good', hint: 'Physically remove the hazard' },
  { id: 'substitution', label: 'Substitution', rank: 2, tone: 'good', hint: 'Replace the hazard' },
  { id: 'engineering', label: 'Engineering control', rank: 3, tone: 'ok', hint: 'Isolate people from the hazard (guards, blocks, LOTO)' },
  { id: 'administrative', label: 'Administrative control', rank: 4, tone: 'warn', hint: 'Change the way people work (procedures, training, signage)' },
  { id: 'ppe', label: 'PPE', rank: 5, tone: 'bad', hint: 'Protect the worker with equipment (harness, gloves)' },
];

// Condition of the control found in the field ("be aware of controls condition").
export const CONTROL_CONDITION = [
  { id: 'works', label: 'Exists and works', tone: 'good' },
  { id: 'inadequate', label: 'Exists but inadequate', tone: 'warn' },
  { id: 'unreliable', label: 'Exists but unreliable', tone: 'warn' },
  { id: 'not_working', label: 'Exists and does not work', tone: 'bad' },
  { id: 'absent', label: 'Does not exist', tone: 'bad' },
];

// A control is effective only when it exists and works (back-compat with the
// older conform/variability flag used by earlier records and seed data).
export function isControlEffective(e) {
  if (e.controlCondition) return e.controlCondition === 'works';
  return e.directControl && e.controlInPlace === 'conform';
}

// A "direct control" in EBS specifically targets the high-energy source and
// is effective even if a mistake is made. Used as a flag on each energy row.
export const ENERGY_ROW = () => ({
  energyId: '',
  present: true,
  dangerZone: '',
  highEnergy: false,      // serious-harm potential
  directControl: false,   // a control that targets the high-energy source
  controlType: '',        // hierarchy of controls id
  controlCondition: '',   // condition of the control found
  controlInPlace: 'conform',
  notes: '',
  photos: [],
});

// Error traps (Field Hazard Assessment) — conditions that make errors more
// likely. Used by the Job Hazard Analysis.
export const ERROR_TRAPS = [
  { group: 'Individual', items: ['Training and experience level', 'Fitness for duty', 'Communication barriers', 'Dilemmas'] },
  { group: 'Task-related', items: ['Unpredictability', 'Task complexity', 'Time pressure', 'Repetition / monotony'] },
  { group: 'Technical', items: ['Documentation quality', 'Information clarity', 'Equipment and tools', 'Environment and access'] },
  { group: 'Organizational', items: ['Clarity of roles', 'Resources and staffing', 'Communication & collaboration', 'Trade-offs'] },
];

// ---------------------------------------------------------------------------
// Reusable checklist sections
// ---------------------------------------------------------------------------
const REMARK_HINT = 'Describe the variability observed with respect to the procedure';

function items(list) {
  return list.map((text, i) => (typeof text === 'string' ? { id: `i${i}`, text } : { id: `i${i}`, ...text }));
}

const FALL_PROTECTION = {
  id: 'fall_protection',
  title: 'Fall protection',
  items: items([
    'Certified fall protection equipment available and used correctly when exposed to a fall hazard',
    'Adequate access to machine room, balustrade and appropriate guards (frame, stairs) and at hoistway openings',
    'Lifeline in proper condition and protected against sharp edges. Certified anchor point',
    'Each technician has a lifeline and works anchored to their own one',
    'The technician attaches the harness after accessing the car roof',
  ]),
};

const LOTO = {
  id: 'loto_electric',
  title: 'LOTO / electrical hazardous energy',
  items: items([
    'Technician working on de-energized, locked and/or tagged equipment (no visual contact with control)',
    'Technician verifies voltage before applying LOTO (multimeter check)',
    'Technician verifies "zero energy state" by testing each phase to earth/neutral',
    'Several technicians working, each with their own lock and tag',
    'Use of insulated tools (for electrical works)',
    'Electrical installation equipped with the corresponding electrical protection means',
  ]),
};

const MECHANICAL = {
  id: 'mechanical_energy',
  title: 'Mechanical hazardous energy',
  items: items([
    'Unexpected car/counterweight movement is not possible. Two safety measures applied (blocks, props, parking, rigging…)',
    'Adequate hoistway protection at upper levels while working in the hoistway',
    'Work within the perimeter of the car, adjacent equipment stopped, or move at the same level at all times',
    'Safe distance from traction pulleys or other unguarded rotating components',
  ]),
};

const HOISTING = {
  id: 'hoisting_rigging',
  title: 'Hoisting & rigging',
  note: 'A hoisting plan should exist before lifting loads.',
  items: items([
    'Hoisting plan prepared and reviewed before lifting loads',
    'Hoisting equipment with inspection certificate and inspection date in force',
    'Suitable hoisting equipment (within load capacity, compatible, free of defects, protected against sharp edges)',
    'Technicians work outside the vertical area of the suspended load',
    'Load weight, sling angle and load capacities of hoisting point/device checked and considered',
  ]),
};

const JUMPERS = {
  id: 'jumpers',
  title: 'Jumpers',
  note: 'Consider whether jumpers are registered to prevent one being forgotten afterwards.',
  items: items([
    'The technician has and uses the approved jumpers & plugs',
    'The technician leaves the workplace having removed all jumpers & plugs',
    'Jumpers are registered/logged while in use',
  ]),
};

const PPE = {
  id: 'ppe',
  title: 'PPE',
  items: items([
    'Required PPE available (helmet/bump cap, gloves, glasses, safety shoes, hi-vis…), in good condition and within date',
    'Correct and appropriate use of PPE',
    'Fall protection equipment is available and used when required',
  ]),
};

const ACTIONS_NOTE = {
  types: ['Training', 'Learning', 'Risk elimination', 'Perform a new SAFE'],
  statuses: ['Implemented', 'Pending'],
};

// ---------------------------------------------------------------------------
// Visit templates
// ---------------------------------------------------------------------------
export const VISIT_TEMPLATES = {
  safe_ni_trans: {
    id: 'safe_ni_trans',
    name: 'SAFE — New Installation / Transformation',
    family: 'SAFE',
    description: 'Behavioural safety visit while technicians work on a NI / TRANS site.',
    hasTechnicalData: true,
    hasEBS: true,
    hasActions: true,
    sections: [
      FALL_PROTECTION,
      {
        id: 'hoistway_provisional',
        title: 'Hoistway safe access (provisional suspension)',
        items: items([
          'Technician accesses the car roof and attaches first the fall protection to the lifeline',
          'Functioning of Tirak/DuaLift, OST/Blockstop/Safety Gear is verified',
          'Technician enters/works/leaves the hoistway with at least two tested & activated safety guards (lifeline is not a safety system)',
          'Technician checks for dangerous elements (rods, concrete girders or open holes)',
        ]),
      },
      {
        id: 'hoistway_no_doors',
        title: 'Hoistway safe access (running without doors)',
        items: items([
          'Dynamic tests carried out in case of displacement inside the hoistway (installation recall control)',
          'Technician attaches the harness after accessing the car roof',
          'Technician works with at least two safety measures tested & activated: STOP + control of recall control',
          'Counterweight screen in place during installation (car running on belts/motor)',
          'Pit buffers/pillars mounted before the cabin is pulled',
          'Technician checks for dangerous elements (rods, concrete girders or open holes)',
        ]),
      },
      {
        id: 'hoistway_with_doors',
        title: 'Hoistway safe access (running with doors)',
        items: items([
          'Operation of the brake and landing door safety contact is checked',
          'Door retainer used when reach is excessive (stepping inside the car roof)',
          'Dynamic tests carried out in case of displacement (inspection control box)',
          'Technician works with at least two safety devices tested & activated: STOP + safety contact/inspection/flywheel block/LOTO/sling',
          'Counterweight screen in place during installation',
          'Pit buffers/pillars mounted before the cabin is pulled',
          'Technician checks for dangerous elements (rods, concrete girders or open holes)',
        ]),
      },
      LOTO,
      MECHANICAL,
      HOISTING,
      JUMPERS,
      PPE,
    ],
  },

  safe_ei: {
    id: 'safe_ei',
    name: 'SAFE — Existing Installation (Maintenance)',
    family: 'SAFE',
    description: 'Behavioural safety visit while technicians work on an existing installation.',
    hasTechnicalData: true,
    hasEBS: true,
    hasActions: true,
    sections: [
      {
        id: 'quality',
        title: 'Quality',
        items: items([
          'Technician has clean and appropriate workwear',
          'Work area, equipment and tools are adequate and well organized',
          'Technician introduces themselves and reports their presence in the building/equipment in a corporate manner',
        ]),
      },
      FALL_PROTECTION,
      {
        id: 'hoistway_carroof_pit',
        title: 'Hoistway safe access (car roof and pit)',
        items: items([
          'Operation of the brake and landing door safety contact is checked',
          'Door retainer used when reach is excessive (stepping inside the car roof)',
          'Dynamic tests carried out in case of displacement (inspection control box)',
          'Technician works with at least two safety devices tested & activated',
          'Technician checks for dangerous elements (rods, concrete girders or open holes)',
        ]),
      },
      LOTO,
      { ...MECHANICAL, items: items([
        'Work within the perimeter of the car, adjacent equipment stopped, or move at the same level at all times',
        'Safe distance from traction pulleys or other unguarded rotating components',
      ]) },
      HOISTING,
      JUMPERS,
      PPE,
    ],
  },

  safety_inspection_ei: {
    id: 'safety_inspection_ei',
    name: 'Safety Inspection — Existing Installation',
    family: 'Safety Inspection',
    description: 'Condition-based inspection of an existing installation.',
    hasTechnicalData: true,
    hasEBS: false,
    hasActions: true,
    sections: [
      {
        id: 'documentation',
        title: 'Documentation / training',
        items: items([
          'The site has a Job Hazard Analysis / Risk Evaluation (mark N/A if no risk detected)',
          'The technician knows and/or has the specific procedures for their activity',
        ]),
      },
      {
        id: 'order_cleanliness',
        title: 'General order and cleanliness',
        items: items([
          'Safe access to the work area (machine room, hoistway and pit) without safety risks',
          'Work areas free of residues or debris',
          'Adequate lighting in the machine room, hoistway and pit',
          'Workers know the evacuation routes and the meeting point',
        ]),
      },
      {
        id: 'equipment_tools',
        title: 'Equipment & tools',
        items: items([
          'Approved ladders, inspected and in good condition',
          'Approved power and hand tools, in good condition and with required protections',
        ]),
      },
      PPE,
      {
        id: 'car',
        title: 'Car',
        items: items([
          'COP, indication panel, screens, signals, labels correctly located; buttons working',
          'Clean car, adequate lighting, correctly installed',
          'Automatic doors work correctly; sills undamaged, clean, smooth sliding, no unaccepted gap',
          'Door panels aligned, adjusted, without scratches',
          'Decorations correctly installed, no vibrations, damages or paint defects',
          'Leveling +-10 mm (two-speed) / +-30 mm (one speed)',
          'Light-curtain / photocell working, aligned, clean; doors move freely',
          'Appropriate ride comfort, without noise or vibrations',
        ]),
      },
      {
        id: 'hoistway_pit',
        title: 'Hoistway & pit',
        items: items([
          'Landing areas adequately protected',
          'Pit and car roof clean, free of moisture/debris, no flammable materials stored',
          'OG tension pulley in good condition; swivelling arm slightly tilted upwards',
          'Counterweight protection screen properly installed',
        ]),
      },
      {
        id: 'machine_room',
        title: 'Machine room',
        items: items([
          'Main power switch locked and marked (LOTO) when applicable',
          'Brake with no signs of malfunction: no oil contamination or unusual noises',
          'Overspeed governor fixed and clean; no unusual noises or operation',
          'Holes in machine room properly protected',
          'Pulleys, overspeed governor and moving parts protected',
          'Control and group panel correctly marked and protected (especially multiplex)',
        ]),
      },
      {
        id: 'open_questions',
        title: 'Open questions',
        kind: 'open',
        items: items([
          { text: 'What are you particularly concerned about in this installation?', open: true },
          { text: 'What could we do to improve the quality?', open: true },
        ]),
      },
    ],
  },

  safety_inspection_ni: {
    id: 'safety_inspection_ni',
    name: 'Safety Inspection — New Installation / Transformation',
    family: 'Safety Inspection',
    description: 'Condition-based inspection of a NI / TRANS site.',
    hasTechnicalData: true,
    hasEBS: false,
    hasActions: true,
    sections: [
      {
        id: 'documentation',
        title: 'Documentation / training',
        items: items([
          'Technicians have all required safety training',
          'Technicians have all required installation technical training',
          'Supervisor filled the checklist before dismantling, acc. KG rules',
          'All subcontractors approved/registered acc. KG rules',
          'Safety & Health plan properly filled in, acc. KG rules / country regulation',
          'Safety & Health plan aligned with installation method and site progress phase',
        ]),
      },
      {
        id: 'order_cleanliness',
        title: 'General order and cleanliness',
        items: items([
          'Safe access to the work area (machine room, hoistway and pit) without safety risks',
          'Work areas free of residues or debris',
          'Adequate lighting in the machine room, hoistway and pit',
          'Workers know the evacuation routes and the meeting point',
          'First aid kit and fire extinguishers available at the working area',
        ]),
      },
      {
        id: 'waste',
        title: 'Storing / collection / waste area',
        items: items([
          'Collection area properly protected and marked',
          'Proper material storage / waste area (wood, cardboard…)',
        ]),
      },
      {
        id: 'equipment_tools',
        title: 'Equipment & tools',
        items: items([
          'Approved ladders, inspected and in good condition',
          'Approved power and hand tools, in good condition and with required protections',
          'Approved working platform (UM101, T4…) in good condition and within revision date',
          'Hooks and beams tested, marked and certified; approved slings and shackles in good condition',
          'Hoist chain blocks, Tirak/DuaLift, beam-clamps/trolleys with yearly maintenance and certification in force',
        ]),
      },
      PPE,
      {
        id: 'car',
        title: 'Car (inspection phase)',
        items: items([
          'COP, indication panel, screens, signals, labels correctly located with company logo',
          'Clean car, adequate lighting, correctly installed',
          'Automatic doors work correctly; sills undamaged, clean, smooth sliding',
          'Door panels aligned, adjusted; gaps 4–6 mm (NI/TRANS)',
          'Decorations correctly installed, no vibrations, damages or paint defects',
          'Proper functioning of alarm / Servitel / 2-way communication',
          'Leveling +-10 mm (two-speed) / +-30 mm (one speed); +-5 mm for frequency converter',
          'Light-curtain / photocell working, aligned, clean; door force limiter works',
          'Appropriate balustrade and guards at hoistway openings',
        ]),
      },
      {
        id: 'hoistway_pit',
        title: 'Hoistway & pit',
        items: items([
          'Landing areas adequately protected',
          'Pit and car roof clean, free of debris, no flammable materials stored',
          'OG tension pulley in good condition; swivelling arm slightly tilted upwards',
          'Pit area without humidity',
          'Counterweight protection screen properly installed; all screws in place and tightened',
          'Inspection recall control and emergency STOP at car roof and pit, appropriate and operative',
        ]),
      },
      {
        id: 'machine_room',
        title: 'Machine room',
        items: items([
          'Main power switch locked and marked (LOTO) when applicable',
          'Brake works properly: no lining dust/scratches, no oil contamination, no unusual noises',
          'Overspeed governor sealed, fixed and clean; no unusual noises or operation',
          'Holes in machine room properly protected',
          'Safe access to machine room',
          'Pulleys, overspeed governor and moving parts protected',
          'Control and group panel correctly marked and protected (especially multiplex)',
        ]),
      },
      {
        id: 'open_questions',
        title: 'Open questions',
        kind: 'open',
        items: items([
          { text: 'What are you particularly concerned about in this installation?', open: true },
          { text: 'What could we do to improve the quality?', open: true },
        ]),
      },
    ],
  },

  mini_ole: {
    id: 'mini_ole',
    name: 'Mini OLE — Operational Learning Event',
    family: 'Learning',
    description: 'Reduced Operational Learning Event focused on how a task is really performed.',
    hasTechnicalData: false,
    hasEBS: false,
    hasActions: true,
    sections: [
      {
        id: 'learning',
        title: 'Operational learning',
        kind: 'open',
        items: items([
          { text: 'Task observed', open: true },
          { text: 'Is there a procedure / instruction available?' },
          { text: 'Does process variability exist?' },
          { text: 'How is the task actually performed? (describe)', open: true },
        ]),
      },
      {
        id: 'four_ds',
        title: "The 4 D's",
        kind: 'open',
        items: items([
          { text: 'Did the technician find anything Dangerous, Difficult, Different or Dumb? Why? How is it solved/approached?', open: true },
          { text: 'Repercussion: positive or negative? Area affected (Quality / Safety / Efficiency)?', open: true },
        ]),
      },
    ],
  },

  jha: {
    id: 'jha',
    name: 'JHA — Job Hazard Analysis (pre-task)',
    family: 'JHA',
    description: 'Pre-task analysis: break the job into steps, identify hazards and define controls before work starts.',
    hasTechnicalData: false,
    hasEBS: true,
    hasActions: false,
    isJHA: true,
    sections: [
      {
        id: 'pre_task',
        title: 'Pre-task readiness',
        items: items([
          'The job has been broken down into steps and reviewed by the crew',
          'All required permits to work are in place (hot work, confined space, electrical…)',
          'Required procedures/instructions are available at the work front',
          'The crew has the required training and certifications for this task',
          'Emergency arrangements known (rescue plan, first aid, evacuation, communication)',
          'All crew members have signed/acknowledged this JHA before starting',
        ]),
      },
    ],
  },
};

export const TEMPLATE_LIST = Object.values(VISIT_TEMPLATES);

export function getTemplate(id) {
  return VISIT_TEMPLATES[id] || null;
}

export const ACTION_DEFAULTS = ACTIONS_NOTE;
export const REMARK_PLACEHOLDER = REMARK_HINT;
