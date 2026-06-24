// Seed population — IMPLEMENTATION_PLAN.md 1.3. Mock fixture only (SPEC §2).
//
// The fixture is deliberately engineered against the deterministic rules in
// SPEC §6 so that, once the engine lands (1.4) and runs as-of AS_OF_DATE, it
// produces the SPEC §8 mix:
//   - several VALID
//   - >=3 QUESTIONABLE, each triggering a DIFFERENT SPEC §6 contradiction
//   - exactly ONE INSUFFICIENT_EVIDENCE (a thin-evidence line)
//   - >=3 de-obligation candidates with non-zero recoverable $
//
// AS_OF_DATE is fixed (no clock reads anywhere) so the whole pipeline is
// reproducible. Date thresholds that matter to SPEC §6:
//   asOf - 90 days  = 2026-03-23   (period-of-performance "expired > 90d")
//   asOf - 180 days = 2025-12-23   ("inactive > 180d")
//
// SEED_DESIGN below records the INTENDED engine output per record. The 1.3 test
// pins the fixture's structure and that this design satisfies SPEC §8; the 1.8
// integration test re-derives verdicts with the real engine and asserts they
// match SEED_DESIGN — so the fixture and engine can never silently drift apart.

import type {
  Component,
  EvidenceItem,
  EvidenceType,
  OwnerRole,
  PriorYearStat,
  UdoRecord,
  Verdict,
} from '../domain/types';

/** Fixed valuation date for the entire deterministic pipeline. */
export const AS_OF_DATE = '2026-06-21';

const rawSeedPopulation: UdoRecord[] = [
  // ---- USCG -------------------------------------------------------------
  {
    id: 'UDO-USCG-0001',
    component: 'USCG',
    obligationNumber: 'N00024-24-C-0001',
    vendor: 'Acme Marine Systems',
    description: 'Cutter propulsion maintenance',
    fundingType: 'O&M',
    amountObligated: 500_000,
    amountDisbursed: 200_000, // drawdown 0.40
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-02-01',
    lastActivityDate: '2026-05-15',
    periodOfPerformanceEnd: '2026-12-31', // not expired
  },
  {
    id: 'UDO-USCG-0002',
    component: 'USCG',
    obligationNumber: 'N00024-24-C-0002',
    vendor: 'Beacon Avionics',
    description: 'Navigation radar overhaul',
    fundingType: 'Procurement',
    amountObligated: 1_500_000,
    amountDisbursed: 1_485_000, // drawdown 0.99 -> FULLY_DRAWN contradiction
    reportedStatus: 'OPEN_ACTIVE',
    // Large, fully-drawn, yet long-expired and dormant: still reported active.
    // Verdict stays QUESTIONABLE (FULLY_DRAWN trigger, drawdown 0.99 so NOT a
    // de-ob candidate); the staleness + magnitude lift its Wave 5 risk score
    // into the CRITICAL band, giving the seed a populated top band.
    obligationDate: '2023-03-10',
    lastActivityDate: '2025-05-01', // > 365d inactive
    periodOfPerformanceEnd: '2025-05-31', // expired > 365d
  },
  {
    id: 'UDO-USCG-0003',
    component: 'USCG',
    obligationNumber: 'N00024-23-C-0007',
    vendor: 'Tidewater Drydock',
    description: 'Hull inspection services',
    fundingType: 'O&M',
    amountObligated: 400_000,
    amountDisbursed: 150_000, // drawdown 0.375 (>0.25 -> not de-ob)
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2023-06-15',
    lastActivityDate: '2025-06-15', // > 180d -> EXPIRED_INACTIVE
    periodOfPerformanceEnd: '2025-09-30', // expired > 90d
  },
  {
    id: 'UDO-USCG-0004',
    component: 'USCG',
    obligationNumber: 'N00024-24-C-0011',
    vendor: 'Harbor Logistics',
    description: 'Port equipment lease',
    fundingType: 'O&M',
    amountObligated: 250_000,
    amountDisbursed: 100_000, // drawdown 0.40
    reportedStatus: 'OPEN_INACTIVE',
    obligationDate: '2024-04-01',
    lastActivityDate: '2026-04-01',
    periodOfPerformanceEnd: '2026-10-31', // not expired
  },
  {
    id: 'UDO-USCG-0005',
    component: 'USCG',
    obligationNumber: 'N00024-23-C-0021',
    vendor: 'Coastal Fabrication',
    description: 'Spare parts depot stock',
    fundingType: 'Procurement',
    amountObligated: 600_000,
    amountDisbursed: 60_000, // drawdown 0.10 -> de-ob candidate
    reportedStatus: 'OPEN_INACTIVE',
    obligationDate: '2023-03-01',
    lastActivityDate: '2025-05-01', // > 180d
    periodOfPerformanceEnd: '2025-08-31', // expired
  },

  // ---- TSA --------------------------------------------------------------
  {
    id: 'UDO-TSA-0001',
    component: 'TSA',
    obligationNumber: 'HSTS04-24-C-0003',
    vendor: 'Checkpoint Technologies',
    description: 'Scanner calibration contract',
    fundingType: 'O&M',
    amountObligated: 150_000,
    amountDisbursed: 75_000, // drawdown 0.50
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-05-01',
    lastActivityDate: '2026-05-20',
    periodOfPerformanceEnd: '2026-12-15',
  },
  {
    id: 'UDO-TSA-0002',
    component: 'TSA',
    obligationNumber: 'HSTS04-24-C-0009',
    vendor: 'SecureLane Integrators',
    description: 'Lane integration services',
    fundingType: 'Procurement',
    amountObligated: 200_000,
    amountDisbursed: 50_000, // drawdown 0.25 (<0.50) -> UNDERDRAWN_PENDING_CLOSE
    reportedStatus: 'PENDING_CLOSE',
    obligationDate: '2024-01-15',
    lastActivityDate: '2026-03-01',
    periodOfPerformanceEnd: '2026-05-01', // expired but within 90d
  },
  {
    id: 'UDO-TSA-0003',
    component: 'TSA',
    obligationNumber: 'HSTS04-25-C-0014',
    vendor: 'Frontier Staffing',
    description: 'Temporary screening staff',
    fundingType: 'O&M',
    amountObligated: 100_000,
    amountDisbursed: 0,
    reportedStatus: 'OPEN_ACTIVE', // requires PO + INVOICE; invoice absent -> ABSTAIN
    obligationDate: '2025-02-01',
    lastActivityDate: '2026-04-10',
    periodOfPerformanceEnd: '2026-12-31',
  },
  {
    id: 'UDO-TSA-0004',
    component: 'TSA',
    obligationNumber: 'HSTS04-23-C-0030',
    vendor: 'Checkpoint Technologies',
    description: 'Closed maintenance order',
    fundingType: 'O&M',
    amountObligated: 120_000,
    amountDisbursed: 120_000, // drawdown 1.00
    reportedStatus: 'CLOSED',
    obligationDate: '2023-08-01',
    lastActivityDate: '2025-12-15',
    periodOfPerformanceEnd: '2025-12-01',
  },

  // ---- FEMA -------------------------------------------------------------
  {
    id: 'UDO-FEMA-0001',
    component: 'FEMA',
    obligationNumber: 'HSFE05-24-C-0002',
    vendor: 'Relief Logistics Group',
    description: 'Disaster supply prepositioning',
    fundingType: 'Procurement',
    amountObligated: 800_000,
    amountDisbursed: 400_000, // drawdown 0.50
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-02-20',
    lastActivityDate: '2026-05-30',
    periodOfPerformanceEnd: '2027-01-31',
  },
  {
    id: 'UDO-FEMA-0002',
    component: 'FEMA',
    obligationNumber: 'HSFE05-23-C-0040',
    vendor: 'Gulf Construction Partners',
    description: 'Mitigation project balance',
    fundingType: 'Procurement',
    amountObligated: 1_000_000,
    amountDisbursed: 100_000, // drawdown 0.10 -> de-ob candidate
    reportedStatus: 'OPEN_INACTIVE',
    obligationDate: '2023-01-10',
    lastActivityDate: '2025-04-01', // > 180d
    periodOfPerformanceEnd: '2025-07-31', // expired
  },
  {
    id: 'UDO-FEMA-0003',
    component: 'FEMA',
    obligationNumber: 'HSFE05-24-C-0055',
    vendor: 'Rapid Shelter Co.',
    description: 'Temporary housing units',
    fundingType: 'Procurement',
    amountObligated: 300_000,
    amountDisbursed: 200_000, // drawdown 0.667; invoice evidence only 50k -> INVOICE_MISMATCH
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-06-01',
    lastActivityDate: '2026-05-10',
    periodOfPerformanceEnd: '2026-12-31',
  },
  {
    id: 'UDO-FEMA-0004',
    component: 'FEMA',
    obligationNumber: 'HSFE05-24-C-0061',
    vendor: 'Beacon Avionics',
    description: 'Emergency comms equipment',
    fundingType: 'Procurement',
    amountObligated: 450_000,
    amountDisbursed: 225_000, // drawdown 0.50
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-07-15',
    lastActivityDate: '2026-04-25',
    periodOfPerformanceEnd: '2026-12-31',
  },

  // ---- CBP --------------------------------------------------------------
  {
    id: 'UDO-CBP-0001',
    component: 'CBP',
    obligationNumber: 'HSBP10-24-C-0004',
    vendor: 'Border Sensor Solutions',
    description: 'Sensor tower maintenance',
    fundingType: 'O&M',
    amountObligated: 350_000,
    amountDisbursed: 140_000, // drawdown 0.40
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-03-05',
    lastActivityDate: '2026-05-18',
    periodOfPerformanceEnd: '2026-11-30',
  },
  {
    id: 'UDO-CBP-0002',
    component: 'CBP',
    obligationNumber: 'HSBP10-23-C-0019',
    vendor: 'Southwest Fleet Services',
    description: 'Vehicle fleet support balance',
    fundingType: 'O&M',
    amountObligated: 700_000,
    amountDisbursed: 70_000, // drawdown 0.10 -> de-ob candidate
    reportedStatus: 'OPEN_INACTIVE',
    obligationDate: '2023-02-01',
    lastActivityDate: '2025-03-15', // > 180d
    periodOfPerformanceEnd: '2025-06-30', // expired
  },
  {
    id: 'UDO-CBP-0003',
    component: 'CBP',
    obligationNumber: 'HSBP10-24-C-0027',
    vendor: 'Checkpoint Technologies',
    description: 'Inspection booth refit',
    fundingType: 'Procurement',
    amountObligated: 200_000,
    amountDisbursed: 180_000, // drawdown 0.90 (>=0.50 -> valid pending close)
    reportedStatus: 'PENDING_CLOSE',
    obligationDate: '2024-04-12',
    lastActivityDate: '2026-04-01',
    periodOfPerformanceEnd: '2026-05-01',
  },
  {
    id: 'UDO-CBP-0004',
    component: 'CBP',
    obligationNumber: 'HSBP10-23-C-0033',
    vendor: 'Border Sensor Solutions',
    description: 'Closed sensor procurement',
    fundingType: 'Procurement',
    amountObligated: 90_000,
    amountDisbursed: 90_000, // drawdown 1.00
    reportedStatus: 'CLOSED',
    obligationDate: '2023-09-01',
    lastActivityDate: '2025-11-10',
    periodOfPerformanceEnd: '2025-11-01',
  },

  // ---- CISA -------------------------------------------------------------
  {
    id: 'UDO-CISA-0001',
    component: 'CISA',
    obligationNumber: 'HSHQDC-24-C-0006',
    vendor: 'Cyber Shield Labs',
    description: 'Threat intel platform subscription',
    fundingType: 'O&M',
    amountObligated: 260_000,
    amountDisbursed: 130_000, // drawdown 0.50
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-05-20',
    lastActivityDate: '2026-05-22',
    periodOfPerformanceEnd: '2026-12-31',
  },
  {
    id: 'UDO-CISA-0002',
    component: 'CISA',
    obligationNumber: 'HSHQDC-24-C-0012',
    vendor: 'Resilient Networks Inc.',
    description: 'Network resilience assessment',
    fundingType: 'O&M',
    amountObligated: 180_000,
    amountDisbursed: 90_000, // drawdown 0.50
    reportedStatus: 'OPEN_INACTIVE',
    obligationDate: '2024-06-01',
    lastActivityDate: '2026-02-01',
    periodOfPerformanceEnd: '2026-09-30', // not expired
  },
  {
    id: 'UDO-CISA-0003',
    component: 'CISA',
    obligationNumber: 'HSHQDC-22-C-0099',
    vendor: 'National Grid Defense',
    description: 'Critical infrastructure study (large award)',
    fundingType: 'Procurement',
    amountObligated: 5_000_000, // outlier: >3x CISA median -> prior-year outlier
    amountDisbursed: 200_000, // drawdown 0.04 -> de-ob candidate
    reportedStatus: 'OPEN_INACTIVE',
    obligationDate: '2022-10-01',
    lastActivityDate: '2025-02-01', // > 180d
    periodOfPerformanceEnd: '2025-05-31', // expired
  },
];

// --- Federal descriptors (MOCK; SPEC §9 — TAS / object class / owner specifics
// are unconfirmed). Derived deterministically from each record so every line
// reads like a real DHS HQ obligation without hand-editing 20 rows. These fields
// are PURELY DESCRIPTIVE: the deterministic engines (validation, risk, de-ob,
// forecast) never read them, so enriching the seed cannot change any verdict,
// score, or de-ob flag — the Phase 1 golden path is unaffected. Edit freely when
// real definitions land.

interface ComponentProfile {
  tasStem: string; // Treasury Account Symbol; "{AVAIL}" gets the fund-availability span
  appropriation: string; // plain-language appropriation name
  office: string; // contracting office that can execute a mod / de-ob
  owners: string[]; // mock named owners (COR / program owner), picked by line suffix
}

const COMPONENT_PROFILE: Record<Component, ComponentProfile> = {
  USCG: {
    tasStem: '070-{AVAIL}-0530',
    appropriation: 'Operations & Support, U.S. Coast Guard',
    office: 'USCG Surface Forces Logistics Center (Contracting)',
    owners: ['M. Alvarez', 'R. Chen', 'T. Okafor', 'L. Petersen'],
  },
  TSA: {
    tasStem: '070-{AVAIL}-0540',
    appropriation: 'Operations & Support, Transportation Security Admin.',
    office: 'TSA Acquisition Program Management Division',
    owners: ['D. Romano', 'S. Bhatt', 'K. Willis', 'J. Frye'],
  },
  FEMA: {
    tasStem: '070-{AVAIL}-0560',
    appropriation: 'Federal Assistance, FEMA',
    office: 'FEMA Office of the Chief Procurement Officer',
    owners: ['A. Delgado', 'P. Nyström', 'C. Boateng', 'H. Mills'],
  },
  CBP: {
    tasStem: '070-{AVAIL}-0530',
    appropriation: 'Operations & Support, Customs & Border Protection',
    office: 'CBP Procurement Directorate (Border Enforcement)',
    owners: ['V. Ortiz', 'B. Sandoval', 'E. Kovac', 'N. Reyes'],
  },
  CISA: {
    tasStem: '070-{AVAIL}-0430',
    appropriation: 'Procurement, Construction & Improvements, CISA',
    office: 'CISA Acquisition Division',
    owners: ['G. Haddad', 'Q. Lindqvist', 'F. Osei', 'W. Tran'],
  },
};

const ROLE_CYCLE: OwnerRole[] = ['COR', 'PROGRAM_MANAGER', 'BUDGET_ANALYST', 'CONTRACTING_OFFICER'];

/** Two-digit year from an ISO date (no clock read; parses the literal). */
function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

/** OMB object class by funding type (A-11): procurement → equipment; else services. */
function objectClassFor(fundingType: string): string {
  return fundingType === 'Procurement'
    ? '31.0 Equipment'
    : '25.2 Other services from non-Federal sources';
}

/** Liquidation signal from how far the obligation has drawn down. */
function invoiceStatusFor(udo: UdoRecord): UdoRecord['invoiceStatus'] {
  const drawdown = udo.amountObligated > 0 ? udo.amountDisbursed / udo.amountObligated : 0;
  if (drawdown >= 0.98) return 'FINAL';
  if (drawdown >= 0.5) return 'CURRENT';
  if (drawdown > 0) return 'PARTIAL';
  return 'NONE';
}

/** Receiving/acceptance signal from status + drawdown. */
function acceptanceStatusFor(udo: UdoRecord): UdoRecord['acceptanceStatus'] {
  if (udo.reportedStatus === 'CLOSED') return 'COMPLETE';
  const drawdown = udo.amountObligated > 0 ? udo.amountDisbursed / udo.amountObligated : 0;
  if (udo.reportedStatus === 'PENDING_CLOSE') return drawdown >= 0.5 ? 'COMPLETE' : 'PARTIAL';
  if (drawdown >= 0.5) return 'PARTIAL';
  return 'NONE';
}

/** Attach the (mock, descriptive) federal fields to a base record. */
function withFederalDescriptors(udo: UdoRecord): UdoRecord {
  const profile = COMPONENT_PROFILE[udo.component];
  const suffix = Number(udo.id.slice(-2)); // trailing line index, e.g. ...0003 -> 3
  const ownerIdx = (suffix - 1 + 4) % 4;
  const fy = yearOf(udo.obligationDate);
  const fy2 = String(fy).slice(-2);
  // O&M is a 1-year fund (single FY); Procurement is multi-year (FY/FY+1 span).
  const avail = udo.fundingType === 'Procurement' ? `${fy2}/${String(fy + 1).slice(-2)}` : fy2;
  return {
    ...udo,
    lineNumber: `${String(suffix).padStart(4, '0')}AA`,
    treasuryAccountSymbol: profile.tasStem.replace('{AVAIL}', avail),
    fiscalYear: fy,
    appropriation: profile.appropriation,
    objectClass: objectClassFor(udo.fundingType),
    contractingOffice: profile.office,
    programOwner: profile.owners[ownerIdx],
    ownerRole: ROLE_CYCLE[ownerIdx],
    invoiceStatus: invoiceStatusFor(udo),
    acceptanceStatus: acceptanceStatusFor(udo),
  };
}

/**
 * The seed population, enriched with federal descriptors. The raw records above
 * carry the financially-significant fields the engines read; this map layers on
 * the descriptive federal metadata (TAS, appropriation, object class, owner, etc.)
 * that makes each line legible to a DHS HQ reviewer.
 */
export const seedPopulation: UdoRecord[] = rawSeedPopulation.map(withFederalDescriptors);

// Evidence builder — keeps the 60+ rows readable. `invoiced` sets an INVOICE
// item whose amount matches amountDisbursed (so the SPEC §6 invoice-amount
// contradiction does NOT fire). Pass an explicit list for the special cases.
function ev(udoId: string, type: EvidenceType, amount?: number, ref?: string): EvidenceItem {
  return amount === undefined
    ? { udoId, type, present: true }
    : { udoId, type, present: true, ref, amount };
}

export const seedEvidence: EvidenceItem[] = [
  // USCG
  ev('UDO-USCG-0001', 'PO'),
  ev('UDO-USCG-0001', 'INVOICE', 200_000, 'INV-U1'),
  ev('UDO-USCG-0001', 'GL'),
  ev('UDO-USCG-0002', 'PO'),
  ev('UDO-USCG-0002', 'INVOICE', 1_485_000, 'INV-U2'),
  ev('UDO-USCG-0002', 'GL'),
  ev('UDO-USCG-0003', 'PO'),
  ev('UDO-USCG-0003', 'INVOICE', 150_000, 'INV-U3'),
  ev('UDO-USCG-0003', 'GL'),
  ev('UDO-USCG-0004', 'PO'),
  ev('UDO-USCG-0004', 'GL'),
  ev('UDO-USCG-0004', 'INVOICE', 100_000, 'INV-U4'),
  ev('UDO-USCG-0005', 'PO'),
  ev('UDO-USCG-0005', 'GL'),
  ev('UDO-USCG-0005', 'INVOICE', 60_000, 'INV-U5'),

  // TSA
  ev('UDO-TSA-0001', 'PO'),
  ev('UDO-TSA-0001', 'INVOICE', 75_000, 'INV-T1'),
  ev('UDO-TSA-0001', 'GL'),
  ev('UDO-TSA-0002', 'PO'),
  ev('UDO-TSA-0002', 'INVOICE', 50_000, 'INV-T2'),
  ev('UDO-TSA-0002', 'RECEIPT'),
  // TSA-0003 — thin evidence: only a PO is present; the required INVOICE is
  // recorded as NOT present. Fewer than 2 present items -> engine must abstain.
  ev('UDO-TSA-0003', 'PO'),
  { udoId: 'UDO-TSA-0003', type: 'INVOICE', present: false },
  ev('UDO-TSA-0004', 'PO'),
  ev('UDO-TSA-0004', 'INVOICE', 120_000, 'INV-T4'),
  ev('UDO-TSA-0004', 'RECEIPT'),

  // FEMA
  ev('UDO-FEMA-0001', 'PO'),
  ev('UDO-FEMA-0001', 'INVOICE', 400_000, 'INV-F1'),
  ev('UDO-FEMA-0001', 'GL'),
  ev('UDO-FEMA-0002', 'PO'),
  ev('UDO-FEMA-0002', 'GL'),
  ev('UDO-FEMA-0002', 'INVOICE', 100_000, 'INV-F2'),
  // FEMA-0003 — invoice evidence (50k) does NOT match disbursed (200k):
  // SPEC §6 invoice-amount contradiction fires.
  ev('UDO-FEMA-0003', 'PO'),
  ev('UDO-FEMA-0003', 'INVOICE', 50_000, 'INV-F3'),
  ev('UDO-FEMA-0003', 'GL'),
  ev('UDO-FEMA-0004', 'PO'),
  ev('UDO-FEMA-0004', 'INVOICE', 225_000, 'INV-F4'),
  ev('UDO-FEMA-0004', 'GL'),

  // CBP
  ev('UDO-CBP-0001', 'PO'),
  ev('UDO-CBP-0001', 'INVOICE', 140_000, 'INV-C1'),
  ev('UDO-CBP-0001', 'GL'),
  ev('UDO-CBP-0002', 'PO'),
  ev('UDO-CBP-0002', 'GL'),
  ev('UDO-CBP-0002', 'INVOICE', 70_000, 'INV-C2'),
  ev('UDO-CBP-0003', 'PO'),
  ev('UDO-CBP-0003', 'INVOICE', 180_000, 'INV-C3'),
  ev('UDO-CBP-0003', 'RECEIPT'),
  ev('UDO-CBP-0004', 'PO'),
  ev('UDO-CBP-0004', 'INVOICE', 90_000, 'INV-C4'),
  ev('UDO-CBP-0004', 'RECEIPT'),

  // CISA
  ev('UDO-CISA-0001', 'PO'),
  ev('UDO-CISA-0001', 'INVOICE', 130_000, 'INV-I1'),
  ev('UDO-CISA-0001', 'GL'),
  ev('UDO-CISA-0002', 'PO'),
  ev('UDO-CISA-0002', 'GL'),
  ev('UDO-CISA-0002', 'INVOICE', 90_000, 'INV-I2'),
  ev('UDO-CISA-0003', 'PO'),
  ev('UDO-CISA-0003', 'GL'),
  ev('UDO-CISA-0003', 'INVOICE', 200_000, 'INV-I3'),
];

// Prior-year population stats (SPEC §6 anomaly inputs). FEMA is engineered to
// trip the >=50% population-shift flag: prior 10 lines vs current 4 (-60%).
export const priorYearStats: PriorYearStat[] = [
  { component: 'USCG', lineCount: 5, totalAmount: 2_100_000 },
  { component: 'TSA', lineCount: 4, totalAmount: 600_000 },
  { component: 'FEMA', lineCount: 10, totalAmount: 6_000_000 },
  { component: 'CBP', lineCount: 4, totalAmount: 1_400_000 },
  { component: 'CISA', lineCount: 3, totalAmount: 5_500_000 },
];

/** Which SPEC §6 contradiction a QUESTIONABLE line is engineered to trip. */
export type SeedTrigger =
  | 'EXPIRED_INACTIVE' // OPEN_ACTIVE, PoP expired >90d AND inactive >180d
  | 'FULLY_DRAWN' // OPEN_ACTIVE/OPEN_INACTIVE, drawdown >= 0.98
  | 'UNDERDRAWN_PENDING_CLOSE' // PENDING_CLOSE, drawdown < 0.50
  | 'INVOICE_MISMATCH'; // invoice evidence sum != amountDisbursed

export interface SeedDesignEntry {
  verdict: Verdict;
  citedRuleId: string | null;
  trigger?: SeedTrigger;
  deobCandidate: boolean;
  estimatedRecoverable: number; // 0 unless a de-ob candidate
}

/**
 * Intended engine output per record (the design contract). The 1.8 integration
 * test re-derives these with the real engine and asserts a match.
 */
export const SEED_DESIGN: Record<string, SeedDesignEntry> = {
  'UDO-USCG-0001': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-ACTIVE-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-USCG-0002': {
    verdict: 'QUESTIONABLE',
    citedRuleId: 'CRG-OPEN-ACTIVE-01',
    trigger: 'FULLY_DRAWN',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-USCG-0003': {
    verdict: 'QUESTIONABLE',
    citedRuleId: 'CRG-OPEN-ACTIVE-01',
    trigger: 'EXPIRED_INACTIVE',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-USCG-0004': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-INACTIVE-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-USCG-0005': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-INACTIVE-01',
    deobCandidate: true,
    estimatedRecoverable: 540_000,
  },

  'UDO-TSA-0001': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-ACTIVE-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-TSA-0002': {
    verdict: 'QUESTIONABLE',
    citedRuleId: 'CRG-PENDING-CLOSE-01',
    trigger: 'UNDERDRAWN_PENDING_CLOSE',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-TSA-0003': {
    verdict: 'INSUFFICIENT_EVIDENCE',
    citedRuleId: null,
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-TSA-0004': {
    verdict: 'VALID',
    citedRuleId: 'CRG-CLOSED-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },

  'UDO-FEMA-0001': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-ACTIVE-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-FEMA-0002': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-INACTIVE-01',
    deobCandidate: true,
    estimatedRecoverable: 900_000,
  },
  'UDO-FEMA-0003': {
    verdict: 'QUESTIONABLE',
    citedRuleId: 'CRG-OPEN-ACTIVE-01',
    trigger: 'INVOICE_MISMATCH',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-FEMA-0004': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-ACTIVE-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },

  'UDO-CBP-0001': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-ACTIVE-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-CBP-0002': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-INACTIVE-01',
    deobCandidate: true,
    estimatedRecoverable: 630_000,
  },
  'UDO-CBP-0003': {
    verdict: 'VALID',
    citedRuleId: 'CRG-PENDING-CLOSE-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-CBP-0004': {
    verdict: 'VALID',
    citedRuleId: 'CRG-CLOSED-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },

  'UDO-CISA-0001': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-ACTIVE-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-CISA-0002': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-INACTIVE-01',
    deobCandidate: false,
    estimatedRecoverable: 0,
  },
  'UDO-CISA-0003': {
    verdict: 'VALID',
    citedRuleId: 'CRG-OPEN-INACTIVE-01',
    deobCandidate: true,
    estimatedRecoverable: 4_800_000,
  },
};
