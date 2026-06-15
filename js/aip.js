// aip.js — Accident & Incident Prevention (AIP) classification taxonomy.
// Categories, dropdowns and types from the Schindler AIP service definitions.
// These augment the existing energy-based SIF classification and RCA.

export const INCIDENT_DEFINITION = [
  'Fatality (FAT)', 'Severe injury', 'Injury', 'Near miss (NM)',
  'Unsafe act', 'Unsafe condition', 'Fire', 'Material damage',
];

export const EQUIPMENT_TYPES = ['Elevator', 'Escalator', 'Moving Walk'];

export const CLASSIFICATION_ELEVATOR = [
  'Pulled in', 'Fall from height', 'Fall of material', 'Fall with car', 'Fall from landing',
  'Fall with false car', 'Falling into pit', 'Falling on car', 'Malfunction elevator',
  'Trapped in car / hoistway', 'Entrapment', 'Crushed by car', 'Crushed by counterweight',
  'Hit by counterweight', 'Hit by door', 'Hit by car', 'Hit by object', 'Overtravel',
  'Unintended car movement (UCM)', 'Overload car', 'Electrocution', 'Burnt', 'Fire', 'Flooding',
  'Drilling', 'On ladder', 'Used bad slings', 'Textile sling', 'No lifeline', 'Material',
  'Health', 'Traffic', 'Horseplaying', 'Criminal act', 'Unhappy customer',
];

export const CLASSIFICATION_ESC = [
  'Fall from height', 'Fall in truss', 'Fall on steps', 'Squeeze toe', 'Squeeze finger',
  'Foot', 'Crushed', 'Pulled in', 'Cladding', 'Malfunction', 'Playground', 'Fall of material',
  'Balustrade', 'Handrail stopped', 'Permanent barrier', 'Comb plate', 'Comb plate switch',
  'Skirt', 'Skirt & step', 'By step', 'Inverse running', 'Synchronization', 'Clothing',
  'Overload', 'Material', 'Fire',
];

export function classificationsFor(equipmentType) {
  if (equipmentType === 'Escalator' || equipmentType === 'Moving Walk') return CLASSIFICATION_ESC;
  return CLASSIFICATION_ELEVATOR;
}

// Event risk rating
export const SEVERITY_RATING = ['None', 'Minor', 'Moderate', 'Serious', 'Fatality'];
export const HAZARD_POTENTIAL = ['A — small', 'B — medium', 'C — major risk'];

// Lifecycle / business context
export const BUSINESS = ['NI', 'EI', 'MOD', 'REP', 'Standby'];
export const PROCESS_PHASE = ['PROD', 'NI', 'EI', 'SAIS', 'Repair', 'MOD', 'Rescue', 'Cleaning', 'Normal operation', 'Inspection (CPSI/Authorities)', "Builder's lift"];

// Impacted person
export const PERSON_TYPE = ['User', 'Employee', 'Subcontractor', '3rd party', 'Competitor', 'Competitor user', 'Animal'];
export const GENDER = ['Female', 'Male', 'Other / unknown'];
export const AGE_RANGES = ['< 18', '18–25', '26–35', '36–45', '46–55', '56–65', '65+'];
export const EXPERIENCE = ['< 1 year', '1–3 years', '3–5 years', '5–10 years', '10–20 years', '20+ years'];
export const HANDICAP = ['None', 'Blind', 'Wheelchair', 'Mobility', 'Other'];

// External bodies & media
export const INVOLVED_BODIES = ['Police', 'Fire brigade', 'Ambulance', 'Authority', 'Local insurance company', 'Media', 'NOBO', 'Others'];
export const MEDIA_FLAGS = [
  ['reported', 'Already reported about the incident'],
  ['mentioned', 'Schindler mentioned in the media reports'],
  ['kgContacted', 'KG contacted by the media'],
  ['future', 'Further media coverage expected'],
];

// Product / equipment details
export const BUILDING_TYPES = ['Public transport', 'Public', 'Home', 'Residential', 'Commercial', 'Government', 'Mall', 'Marine / vessel', 'Leisure', 'Industrial', 'Hotel', 'General', 'Airport', 'Hospital', 'Car elevator'];
export const ELEVATOR_TYPES = ['Passenger', 'Passenger-freight', 'Freight', 'Vehicle', 'Home lift - platform', 'Dumbwaiter', 'Stairlift', 'Construction platform lift'];
export const MANUFACTURERS = ['Schindler', '3rd party', 'Kone', 'OTIS', 'Thyssen / TKE', 'Mitsubishi', 'Hitachi', 'Hyundai', 'Westinghouse', 'XJ', 'Excel / Atlas', 'Haushahn', 'Other'];
export const TRACTION = ['Rope', 'STM', 'Hydraulic', 'Drum lift', 'Chain', 'Inclined'];
export const CONTROL_TYPES = ['MX-GC', 'Relay', 'ACONIC', 'MIC-B', 'MIC-E', 'MIC-V', 'Other'];
export const UNITS_IN_GROUP = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13+'];

// Default AIP block for a new accident.
export function emptyAip() {
  return {
    incidentDefinition: '', equipmentType: '', accidentClass: '',
    severityRating: '', hazardPotential: '',
    business: '', process: '',
    personType: '', gender: '', ageRange: '', experience: '', handicap: '',
    involvedBodies: [], media: { reported: false, mentioned: false, kgContacted: false, future: false },
    product: {
      buildingType: '', elevatorType: '', model: '', manufacturer: '', traction: '', controlType: '',
      machineRoom: '', ratedLoad: '', ratedSpeed: '', travelHeight: '', levels: '', units: '',
      installYear: '', commissionNr: '', orderNr: '',
    },
  };
}

// An "Immediate Incident Report" (IIR) is triggered when any external body is
// involved, or the event is a fatality.
export function iirRequired(aip) {
  if (!aip) return false;
  if ((aip.involvedBodies || []).length) return true;
  if (aip.incidentDefinition === 'Fatality (FAT)' || aip.severityRating === 'Fatality') return true;
  return false;
}
