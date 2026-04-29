import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
  type PresetId,
  presetParams,
  runSimulation,
  type SimParams,
  summarize,
} from "./simulation";
import "./App.css";

const DEFAULT_DAYS = 90;

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

const EVIDENCE_CARDS = [
  { val: "+55.8%", label: "faster on lab tasks", source: "Peng et al. 2023", tone: "pos" },
  { val: "−19%", label: "slower on real OSS issues", source: "METR 2025", tone: "neg" },
  { val: "+91%", label: "longer PR review time", source: "Faros AI 2025", tone: "warn" },
  { val: "+154%", label: "larger PR size", source: "Faros AI 2025", tone: "warn" },
  { val: "+322%", label: "more privilege escalation paths", source: "Apiiro 2025", tone: "neg" },
  { val: "+26%", label: "task completion rate", source: "Cui et al. 2025", tone: "pos" },
] as const;

const TOOLTIP_STYLE = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--text)",
  fontSize: "12px",
};

export default function App() {
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [arrivalsPerDay, setArrivalsPerDay] = useState(8);
  const [verificationLoadPerDraft, setVerificationLoadPerDraft] = useState(1.0);
  const [humanCapacityPerDay, setHumanCapacityPerDay] = useState(10);
  const [automationCapacityPerDay, setAutomationCapacityPerDay] = useState(2);
  const [reworkFraction, setReworkFraction] = useState(0.08);
  const [writeTimeBase, setWriteTimeBase] = useState(1.0);
  const [activePreset, setActivePreset] = useState<PresetId | null>("baseline");

  const params: SimParams = useMemo(
    () => ({
      days,
      arrivalsPerDay,
      verificationLoadPerDraft,
      humanCapacityPerDay,
      automationCapacityPerDay,
      reworkFraction,
      writeTimeBase,
    }),
    [
      days,
      arrivalsPerDay,
      verificationLoadPerDraft,
      humanCapacityPerDay,
      automationCapacityPerDay,
      reworkFraction,
      writeTimeBase,
    ],
  );

  const rows = useMemo(() => runSimulation(params), [params]);
  const stats = useMemo(() => summarize(rows), [rows]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        day: r.day,
        backlog: Math.round(r.queueEnd * 10) / 10,
        verified: Math.round(r.processed * 10) / 10,
        rework: Math.round(r.reworkAdded * 10) / 10,
        tWrite: Math.round(r.tWrite * 100) / 100,
        tVerify: Math.round(r.tVerify * 100) / 100,
        tRework: Math.round(r.tRework * 100) / 100,
      })),
    [rows],
  );

  function applyPreset(id: PresetId) {
    const p = presetParams(id);
    setArrivalsPerDay(p.arrivalsPerDay);
    setVerificationLoadPerDraft(p.verificationLoadPerDraft);
    setHumanCapacityPerDay(p.humanCapacityPerDay);
    setAutomationCapacityPerDay(p.automationCapacityPerDay);
    setReworkFraction(p.reworkFraction);
    setWriteTimeBase(p.writeTimeBase);
    setActivePreset(id);
  }

  function markManual() {
    setActivePreset(null);
  }

  const writeLabel =
    writeTimeBase <= 0.4
      ? "AI-boosted"
      : writeTimeBase <= 0.7
        ? "AI-assisted"
        : writeTimeBase <= 0.9
          ? "Moderate"
          : "Baseline";

  const paradoxRatio =
    writeTimeBase > 0 ? stats.steadyStateCycleTime / writeTimeBase : 0;

  const totalCapacity = humanCapacityPerDay + automationCapacityPerDay;
  const effectiveArrivals = arrivalsPerDay * verificationLoadPerDraft;
  const isOverloaded = effectiveArrivals > totalCapacity * (1 - reworkFraction);

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">AI Productivity Paradox · Verification Budget Model</p>
        <h1 className="title">Verification Budget Simulator</h1>
        <p className="lede">
          AI coding assistants shrink <em>T_write</em> but leave verification capacity
          fixed. See how faster drafting can paradoxically worsen delivery via a
          simple queue model.
        </p>
      </header>

      <div className="equation-panel">
        <div className="equation-box">
          <span className="eq-main">
            T<sub>delivery</sub> = T<sub>write</sub> + T<sub>verify</sub> + T<sub>rework</sub>
          </span>
          <p className="eq-note">
            Each day: new work arrives (draft rate × load), reviewers + automation process
            up to combined capacity, a fraction returns as rework. When arrivals exceed
            capacity the queue grows — and T<sub>verify</sub> grows with it.
          </p>
        </div>
      </div>

      <section className="evidence-section" aria-label="Real-world evidence">
        <p className="section-label">Real-world evidence (from the paper)</p>
        <div className="evidence-grid">
          {EVIDENCE_CARDS.map((c) => (
            <div key={c.val} className={`evidence-card evidence-card--${c.tone}`}>
              <span className="evidence-val">{c.val}</span>
              <span className="evidence-label">{c.label}</span>
              <span className="evidence-source">{c.source}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="layout">
        {/* ── Controls sidebar ── */}
        <aside className="controls" aria-label="Simulation parameters">
          <h2 className="panel-title">Scenarios</h2>
          <div className="preset-list">
            {(Object.keys(PRESET_LABELS) as PresetId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`preset-btn${activePreset === id ? " preset-btn--active" : ""}`}
                onClick={() => applyPreset(id)}
              >
                {PRESET_LABELS[id]}
              </button>
            ))}
          </div>

          {activePreset && (
            <p className="preset-desc">{PRESET_DESCRIPTIONS[activePreset]}</p>
          )}

          <h2 className="panel-title section-gap">Parameters</h2>

          <label className="field">
            <span className="field-label">
              Simulation length: <strong>{days} days</strong>
            </span>
            <input
              type="range" min={30} max={180} step={10} value={days}
              onChange={(e) => { setDays(Number(e.target.value)); markManual(); }}
            />
          </label>

          <label className="field">
            <span className="field-label">
              Draft arrivals / day: <strong>{arrivalsPerDay}</strong>
              <span className="hint"> (PRs entering review queue)</span>
            </span>
            <input
              type="range" min={1} max={35} step={1} value={arrivalsPerDay}
              onChange={(e) => { setArrivalsPerDay(Number(e.target.value)); markManual(); }}
            />
          </label>

          <label className="field">
            <span className="field-label">
              T_write base: <strong>{writeTimeBase.toFixed(1)} day</strong>
              <span className={`badge badge--${writeTimeBase <= 0.7 ? "ai" : "human"}`}>
                {writeLabel}
              </span>
            </span>
            <input
              type="range" min={0.2} max={2.0} step={0.1} value={writeTimeBase}
              onChange={(e) => { setWriteTimeBase(Number(e.target.value)); markManual(); }}
            />
          </label>

          <label className="field">
            <span className="field-label">
              Verification load / draft: <strong>{verificationLoadPerDraft.toFixed(1)}×</strong>
              <span className="hint"> (PR size multiplier)</span>
            </span>
            <input
              type="range" min={0.3} max={3.0} step={0.1} value={verificationLoadPerDraft}
              onChange={(e) => { setVerificationLoadPerDraft(Number(e.target.value)); markManual(); }}
            />
          </label>

          <label className="field">
            <span className="field-label">
              Human review capacity / day: <strong>{humanCapacityPerDay}</strong>
            </span>
            <input
              type="range" min={2} max={25} step={1} value={humanCapacityPerDay}
              onChange={(e) => { setHumanCapacityPerDay(Number(e.target.value)); markManual(); }}
            />
          </label>

          <label className="field">
            <span className="field-label">
              Automation capacity / day: <strong>{automationCapacityPerDay}</strong>
              <span className="hint"> (CI, linters, test gates)</span>
            </span>
            <input
              type="range" min={0} max={25} step={1} value={automationCapacityPerDay}
              onChange={(e) => { setAutomationCapacityPerDay(Number(e.target.value)); markManual(); }}
            />
          </label>

          <label className="field">
            <span className="field-label">
              Rework fraction: <strong>{(reworkFraction * 100).toFixed(0)}%</strong>
              <span className="hint"> (items returned after review)</span>
            </span>
            <input
              type="range" min={0} max={0.35} step={0.01} value={reworkFraction}
              onChange={(e) => { setReworkFraction(Number(e.target.value)); markManual(); }}
            />
          </label>

          {/* ── Outcomes ── */}
          <div
            className={[
              "stats",
              stats.stableRising === "rising" ? "stats--warn" : "",
              stats.stableRising === "falling" ? "stats--ok" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <h2 className="panel-title">Outcomes</h2>

            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-val">{fmt(stats.steadyStateCycleTime)}</span>
                <span className="stat-key">cycle time (days)</span>
              </div>
              <div className="stat-item">
                <span className="stat-val">{fmt(stats.maxQueue, 0)}</span>
                <span className="stat-key">peak backlog</span>
              </div>
              <div className="stat-item">
                <span className="stat-val">{fmt(stats.finalQueue, 0)}</span>
                <span className="stat-key">final backlog</span>
              </div>
              <div className="stat-item">
                <span className="stat-val">{fmt(stats.avgProcessed)}</span>
                <span className="stat-key">avg verified/day</span>
              </div>
            </div>

            {isOverloaded && stats.stableRising === "rising" && (
              <div className="paradox-alert">
                <strong>Paradox active</strong> — writing 1 unit takes{" "}
                {writeTimeBase.toFixed(1)} day, but delivery takes{" "}
                {fmt(stats.steadyStateCycleTime)} days (
                {fmt(paradoxRatio, 1)}× slower).
                The verification queue is the bottleneck.
              </div>
            )}

            <p className="stats-trend">
              End trend:{" "}
              <strong
                className={
                  stats.stableRising === "rising"
                    ? "text-warn"
                    : stats.stableRising === "falling"
                      ? "text-ok"
                      : ""
                }
              >
                {stats.stableRising === "rising"
                  ? "Backlog still growing ↑"
                  : stats.stableRising === "falling"
                    ? "Backlog shrinking ↓"
                    : "Roughly flat →"}
              </strong>
              <span className="hint"> (last 15 days)</span>
            </p>
          </div>
        </aside>

        {/* ── Charts ── */}
        <main className="charts" aria-label="Charts">

          {/* Chart 1: Verification backlog */}
          <div className="chart-card">
            <h2 className="chart-title">Verification backlog</h2>
            <p className="chart-sub">
              Queue depth at end of each day. A rising queue means delivery speed
              cannot keep up with draft output — the verification budget is exhausted.
            </p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillBacklog" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-queue)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--chart-queue)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="day"
                    stroke="var(--text-muted)"
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    tickLine={false}
                    label={{ value: "Day", position: "insideBottomRight", offset: -4, fill: "var(--text-muted)", fontSize: 11 }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    tickLine={false}
                    width={48}
                    label={{ value: "units", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 10, dy: 28 }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number) => [fmt(v, 0) + " units", "Backlog"]}
                    labelFormatter={(l) => `Day ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="backlog"
                    name="Backlog"
                    stroke="var(--chart-queue)"
                    strokeWidth={2}
                    fill="url(#fillBacklog)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: T_delivery breakdown */}
          <div className="chart-card chart-card--featured">
            <h2 className="chart-title">T_delivery breakdown</h2>
            <p className="chart-sub">
              Estimated cycle time stacked as{" "}
              <span className="legend-dot legend-dot--write" />
              <strong>T_write</strong> +{" "}
              <span className="legend-dot legend-dot--verify" />
              <strong>T_verify</strong> +{" "}
              <span className="legend-dot legend-dot--rework" />
              <strong>T_rework</strong> (days per unit, via Little's Law).
              AI shrinks the green band but can cause the orange band to dominate.
            </p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="day"
                    stroke="var(--text-muted)"
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    tickLine={false}
                    label={{ value: "Day", position: "insideBottomRight", offset: -4, fill: "var(--text-muted)", fontSize: 11 }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    tickLine={false}
                    width={48}
                    label={{ value: "days", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 10, dy: 22 }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, name: string) => [fmt(v, 2) + "d", name]}
                    labelFormatter={(l) => `Day ${l}`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                    formatter={(value) => (
                      <span style={{ color: "var(--text-muted)" }}>{value}</span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="tWrite"
                    name="T_write"
                    stackId="td"
                    stroke="var(--chart-throughput)"
                    strokeWidth={1}
                    fill="var(--chart-throughput)"
                    fillOpacity={0.65}
                  />
                  <Area
                    type="monotone"
                    dataKey="tVerify"
                    name="T_verify"
                    stackId="td"
                    stroke="var(--warning)"
                    strokeWidth={1}
                    fill="var(--warning)"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="tRework"
                    name="T_rework"
                    stackId="td"
                    stroke="var(--chart-rework)"
                    strokeWidth={1}
                    fill="var(--chart-rework)"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Throughput vs rework */}
          <div className="chart-card">
            <h2 className="chart-title">Throughput vs rework</h2>
            <p className="chart-sub">
              Units verified per day (teal) and units re-entering the queue as
              rework (purple). As the queue grows the verified line hits a ceiling
              while rework compounds.
            </p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="day"
                    stroke="var(--text-muted)"
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    tickLine={false}
                    label={{ value: "Day", position: "insideBottomRight", offset: -4, fill: "var(--text-muted)", fontSize: 11 }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    tickLine={false}
                    width={48}
                    label={{ value: "units", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 10, dy: 28 }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, name: string) => [fmt(v, 1), name]}
                    labelFormatter={(l) => `Day ${l}`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                    formatter={(value) => (
                      <span style={{ color: "var(--text-muted)" }}>{value}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="verified"
                    name="Verified / day"
                    stroke="var(--chart-throughput)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="rework"
                    name="Rework / day"
                    stroke="var(--chart-rework)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <footer className="footnote">
            Illustrative model — Japneet Singh, B.E. (CSE) Chitkara University 2025. &nbsp;
            Data sources: Faros AI, METR, Apiiro, Peng et al., Cui et al. &nbsp;
            Click presets ①→②→③ to see the paradox, then ④⑤ for mitigations.
          </footer>
        </main>
      </div>
    </div>
  );
}
