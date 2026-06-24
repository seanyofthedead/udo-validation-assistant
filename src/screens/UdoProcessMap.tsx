// UDO Process Map — the end-to-end DHS HQ Undelivered Order review lifecycle.
//
// This screen exists for legibility: it lays out the ten process steps, the DHS
// role accountable at each, the evidence the decision rests on, the manual pain
// the platform removes, and a deep link to the product screen that performs the
// step. It is the spine of the demo — a stakeholder sees the whole process and
// how the product improves each step before touching any single screen.

import { useNavigation } from './navigation';
import type { ScreenId } from './registry';

interface ProcessStep {
  n: number;
  title: string;
  role: string; // primary DHS HQ role(s)
  evidence: string; // what the decision rests on
  manual: string; // the manual pain point today
  enhancement: string; // how this product improves it
  screen: ScreenId; // the screen that performs this step
  screenLabel: string;
}

// Roles, evidence, and screen mapping mirror docs/udo-process-audit.md §3–4.
const STEPS: ProcessStep[] = [
  {
    n: 1,
    title: 'UDO data intake',
    role: 'UDO Coordinator (HQ)',
    evidence: 'Source extract from the system of record; ingestion timestamp',
    manual: 'Analysts pull obligation extracts into spreadsheets by hand each cycle.',
    enhancement: 'The population is loaded and validated on entry, with an audited intake event.',
    screen: 'inventory',
    screenLabel: 'UDO Inventory',
  },
  {
    n: 2,
    title: 'Inventory & aging',
    role: 'Budget Analyst',
    evidence: 'Obligation record, GL balance, period of performance',
    manual: 'Aging and balances are recomputed manually, prone to copy errors.',
    enhancement: 'The full population is classified by age, dollars, status, and activity.',
    screen: 'inventory',
    screenLabel: 'UDO Inventory',
  },
  {
    n: 3,
    title: 'Triage & prioritization',
    role: 'HQ Analyst / Campaign Manager',
    evidence: 'Risk factors (staleness, drawdown, dollars, evidence), verdict',
    manual: 'Reviewers guess where to start, or try to validate everything.',
    enhancement:
      'An explainable risk score ranks the population so 20 lines surface out of thousands.',
    screen: 'high-risk',
    screenLabel: 'High-Risk Queue',
  },
  {
    n: 4,
    title: 'Assignment & routing',
    role: 'Campaign Manager',
    evidence: 'Assignment, due date, accountable owner/office',
    manual: 'Work is tasked over email and tracked in a side spreadsheet.',
    enhancement: 'A campaign assigns slices to components with due dates and tracked progress.',
    screen: 'campaigns',
    screenLabel: 'Review Campaigns',
  },
  {
    n: 5,
    title: 'Evidence collection & research',
    role: 'COR / Program Owner',
    evidence: 'PO, invoice, receipt, modification, GL, correspondence',
    manual: 'Supporting documents are chased and attached ad hoc.',
    enhancement:
      'Each line shows its evidence and the cited rule; missing evidence forces an abstain.',
    screen: 'detail',
    screenLabel: 'UDO Detail',
  },
  {
    n: 6,
    title: 'Validity determination',
    role: 'Reviewer / Certifier',
    evidence: 'Evidence summary + reviewer rationale',
    manual: 'Decisions live in inconsistent narrative comments.',
    enhancement:
      'The reviewer records a federal determination — keep, liquidate, de-obligate, ' +
      'closeout, research, or escalate — with a mandatory reason.',
    screen: 'review',
    screenLabel: 'Review Workspace',
  },
  {
    n: 7,
    title: 'Certification / attestation',
    role: 'Certifying Official',
    evidence: 'Reviewer, date, decision, comments',
    manual: 'Certification is a signed memo detached from the underlying lines.',
    enhancement: 'Dispositions and the audit trail capture who decided what, when, and why.',
    screen: 'review',
    screenLabel: 'Review Workspace',
  },
  {
    n: 8,
    title: 'Action execution & follow-up',
    role: 'Contracting / Finance',
    evidence: 'De-ob request, modification, invoice follow-up, closeout',
    manual: 'Follow-up actions stall silently with no owner or deadline.',
    enhancement: 'De-obligation opportunities and escalations are tracked through their lifecycle.',
    screen: 'tracker',
    screenLabel: 'Escalations & De-Ob',
  },
  {
    n: 9,
    title: 'Leadership reporting',
    role: 'OCFO Leadership',
    evidence: 'Reconciled aggregates with drill-down to the line',
    manual: 'Leadership decks are assembled by hand and go stale immediately.',
    enhancement:
      'A portfolio scorecard rolls up coverage, exceptions, and de-ob dollars, drillable to the line.',
    screen: 'portfolio',
    screenLabel: 'Portfolio Command Center',
  },
  {
    n: 10,
    title: 'Continuous monitoring & controls',
    role: 'OCFO / Auditor',
    evidence: 'Trend, audit trail, forecast basis',
    manual: 'Risk trends are noticed late, after funds have cancelled.',
    enhancement:
      'Cross-component analytics and a labeled staleness forecast anticipate what is coming.',
    screen: 'command-center',
    screenLabel: 'Enterprise Command Center',
  },
];

export function UdoProcessMap() {
  const { navigate } = useNavigation();

  return (
    <section aria-labelledby="process-title">
      <h2 id="process-title">UDO Process Map</h2>
      <p className="justification">
        The end-to-end DHS HQ Undelivered Order review lifecycle, from intake to continuous
        monitoring. Each step names the accountable role, the evidence its decision rests on, the
        manual pain the platform removes, and the screen that performs it.
      </p>

      <ol className="process-list" aria-label="UDO process steps">
        {STEPS.map((step) => (
          <li key={step.n} className="panel process-step">
            <h3>
              {step.n} · {step.title}
            </h3>
            <dl className="record">
              <dt>DHS role</dt>
              <dd>{step.role}</dd>
              <dt>Evidence</dt>
              <dd>{step.evidence}</dd>
            </dl>
            <p className="process-value">
              <span className="tag">Manual today</span> {step.manual}
            </p>
            <p className="process-value">
              <span className="tag tag-enhance">With the platform</span> {step.enhancement}
            </p>
            <button type="button" className="link-button" onClick={() => navigate(step.screen)}>
              Open {step.screenLabel} →
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
