// Assignment generation — SPEC §5.3 (Phase 3, Wave 6). Splits a campaign's
// selected population into one assignment per owning component, each with a due
// date, so responsibility is explicit. Pure and React-free; no clock/random —
// due dates are supplied by the caller (the create wizard).

import type { Assignment, Component, UdoRecord } from './types';

// Canonical component order so generated assignments are deterministic
// regardless of the input id ordering.
const COMPONENT_ORDER: Component[] = ['USCG', 'TSA', 'FEMA', 'CBP', 'CISA'];

/**
 * Group `udoIds` by their owning component (looked up in `population`) and emit
 * one NOT_STARTED assignment per component that owns at least one selected line.
 * The line order within each assignment is preserved from `udoIds` (which the
 * selectors return in risk order), so the highest-risk line leads each slice.
 *
 * Due date per component: `dueDates[component]` if set, else `defaultDueDate`.
 * Unknown ids (not in `population`) are skipped. Assignment id is
 * `${campaignId}-${component}` — stable and traceable back to the campaign.
 */
export function generateAssignments(
  campaignId: string,
  udoIds: string[],
  population: UdoRecord[],
  dueDates: Partial<Record<Component, string>>,
  defaultDueDate: string,
): Assignment[] {
  const componentById = new Map(population.map((u) => [u.id, u.component]));

  // Preserve input order within each component's slice.
  const idsByComponent = new Map<Component, string[]>();
  for (const id of udoIds) {
    const component = componentById.get(id);
    if (component === undefined) continue; // unknown id — skip
    const bucket = idsByComponent.get(component);
    if (bucket) bucket.push(id);
    else idsByComponent.set(component, [id]);
  }

  return COMPONENT_ORDER.filter((c) => idsByComponent.has(c)).map((component) => ({
    id: `${campaignId}-${component}`,
    campaignId,
    component,
    udoIds: idsByComponent.get(component)!,
    dueDate: dueDates[component] ?? defaultDueDate,
    state: 'NOT_STARTED' as const,
  }));
}
