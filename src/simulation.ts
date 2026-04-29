/**
 * Discrete-time queue model: each day, new change-units enter the verification
 * queue; humans + automation process up to combined capacity; a fraction of
 * completed work returns as rework. Cycle time is estimated via Little's Law.
 *
 * T_delivery = T_write + T_verify + T_rework
 */

export type SimParams = {
  /** Number of simulated days */
  days: number;
  /** New drafts (PRs) per day that need verification */
  arrivalsPerDay: number;
  /** Verification capacity units consumed per draft (1 = small PRs, >1 = large/risky) */
  verificationLoadPerDraft: number;
  /** Human reviewer throughput in verification units per day */
  humanCapacityPerDay: number;
  /** Automation (CI, linters, tests) throughput in verification units per day */
  automationCapacityPerDay: number;
  /** Fraction of processed units that bounce back into the queue as rework */
  reworkFraction: number;
  /** Base days to write one draft unit (1.0 = baseline human pace, 0.5 = AI-assisted) */
  writeTimeBase: number;
};

export type SimDay = {
  day: number;
  queueStart: number;
  arrivals: number;        // in capacity units
  totalCapacity: number;
  processed: number;
  reworkAdded: number;
  queueEnd: number;
  // Cycle time decomposition via Little's Law (W = L / λ)
  cycleTime: number;
  tWrite: number;
  tVerify: number;
  tRework: number;
};

export function runSimulation(params: SimParams): SimDay[] {
  const totalCapacity =
    params.humanCapacityPerDay + params.automationCapacityPerDay;
  let queue = 0;
  const rows: SimDay[] = [];

  for (let day = 1; day <= params.days; day += 1) {
    const queueStart = queue;
    const arrivals = params.arrivalsPerDay * params.verificationLoadPerDraft;
    queue += arrivals;
    const processed = Math.min(queue, totalCapacity);
    queue -= processed;
    const reworkAdded = processed * params.reworkFraction;
    queue += reworkAdded;

    // Little's Law: W = L / λ
    // L = average items in queue expressed as PR-equivalents
    // λ = PR arrival rate
    const avgQueueCU = (queueStart + queue) / 2;
    const avgQueuePRs =
      params.verificationLoadPerDraft > 0
        ? avgQueueCU / params.verificationLoadPerDraft
        : 0;
    const tVerify =
      params.arrivalsPerDay > 0 ? avgQueuePRs / params.arrivalsPerDay : 0;
    const tRework = params.reworkFraction * tVerify;
    const tWrite = params.writeTimeBase;

    rows.push({
      day,
      queueStart,
      arrivals,
      totalCapacity,
      processed,
      reworkAdded,
      queueEnd: queue,
      cycleTime: tWrite + tVerify + tRework,
      tWrite,
      tVerify,
      tRework,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export type PresetId =
  | "baseline"
  | "aiFasterDrafts"
  | "aiLargePRs"
  | "smallerPRs"
  | "moreAutomation";

export const PRESET_LABELS: Record<PresetId, string> = {
  baseline: "① Baseline",
  aiFasterDrafts: "② AI: faster drafts",
  aiLargePRs: "③ AI: large PRs",
  smallerPRs: "④ Smaller PRs",
  moreAutomation: "⑤ More automation",
};

export const PRESET_DESCRIPTIONS: Record<PresetId, string> = {
  baseline:
    "Pre-AI baseline — capacity comfortably keeps pace with demand. Cycle time ≈ write time.",
  aiFasterDrafts:
    "AI doubles draft speed, inflates PR size (+70%), and raises rework rate. Reviewer capacity unchanged — watch the queue explode.",
  aiLargePRs:
    "Models Faros AI 2025 data: +98% merged PRs, +154% PR size, same reviewer headcount. The paradox at full force.",
  smallerPRs:
    "Keep AI draft speed but slice PRs smaller — each unit consumes half the verification budget. Queue stabilises.",
  moreAutomation:
    "AI-aware CI bots pre-screen 40% of review load before it reaches humans, plus expanded automation capacity. Queue drains.",
};

export function presetParams(id: PresetId): Omit<SimParams, "days"> {
  switch (id) {
    case "baseline":
      return {
        arrivalsPerDay: 8,
        verificationLoadPerDraft: 1.0,
        humanCapacityPerDay: 10,
        automationCapacityPerDay: 2,
        reworkFraction: 0.08,
        writeTimeBase: 1.0,
      };
    case "aiFasterDrafts":
      // arrivals ×2.5, load ×1.7, capacity unchanged — net +23 units/day
      return {
        arrivalsPerDay: 20,
        verificationLoadPerDraft: 1.7,
        humanCapacityPerDay: 10,
        automationCapacityPerDay: 2,
        reworkFraction: 0.12,
        writeTimeBase: 0.5,
      };
    case "aiLargePRs":
      // Faros 2025: +98% merged PRs → ×2 arrivals, +154% size → load=2.5
      return {
        arrivalsPerDay: 16,
        verificationLoadPerDraft: 2.5,
        humanCapacityPerDay: 10,
        automationCapacityPerDay: 2,
        reworkFraction: 0.15,
        writeTimeBase: 0.4,
      };
    case "smallerPRs":
      // Same AI arrivals but slice load to 0.5 — capacity > arrivals → queue drains
      return {
        arrivalsPerDay: 20,
        verificationLoadPerDraft: 0.5,
        humanCapacityPerDay: 10,
        automationCapacityPerDay: 2,
        reworkFraction: 0.12,
        writeTimeBase: 0.5,
      };
    case "moreAutomation":
      // CI pre-screening halves effective load; automation capacity +10 — net surplus
      return {
        arrivalsPerDay: 20,
        verificationLoadPerDraft: 1.0,
        humanCapacityPerDay: 10,
        automationCapacityPerDay: 12,
        reworkFraction: 0.06,
        writeTimeBase: 0.5,
      };
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export type SimSummary = {
  maxQueue: number;
  finalQueue: number;
  avgProcessed: number;
  stableRising: "falling" | "stable" | "rising";
  steadyStateCycleTime: number;
  totalCompleted: number;
};

export function summarize(rows: SimDay[]): SimSummary {
  if (rows.length === 0) {
    return {
      maxQueue: 0,
      finalQueue: 0,
      avgProcessed: 0,
      stableRising: "stable",
      steadyStateCycleTime: 0,
      totalCompleted: 0,
    };
  }

  const maxQueue = Math.max(...rows.map((r) => r.queueEnd));
  const finalQueue = rows[rows.length - 1].queueEnd;
  const avgProcessed = rows.reduce((s, r) => s + r.processed, 0) / rows.length;

  const lastWindow = rows.slice(-15);
  const first = lastWindow[0]?.queueEnd ?? 0;
  const last = lastWindow[lastWindow.length - 1]?.queueEnd ?? 0;
  let stableRising: "falling" | "stable" | "rising" = "stable";
  if (last > first * 1.08) stableRising = "rising";
  else if (last < first * 0.92) stableRising = "falling";

  const steadyStateCycleTime =
    lastWindow.reduce((s, r) => s + r.cycleTime, 0) / lastWindow.length;

  const totalCompleted = rows.reduce((s, r) => s + r.processed, 0);

  return {
    maxQueue,
    finalQueue,
    avgProcessed,
    stableRising,
    steadyStateCycleTime,
    totalCompleted,
  };
}
