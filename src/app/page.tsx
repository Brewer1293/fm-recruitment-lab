"use client";

import { useMemo, useState } from "react";
import { exportCSV, exportHTML } from "../lib/exports";
import { clubLogoUrl, nationLogoUrl, playerFaceUrl } from "../lib/assetResolver";
import { importFMFiles } from "../lib/fmParser";
import { PRESET_VERSION, ROLE_CONFIG, TACTIC_SLOTS } from "../lib/roleConfig";
import { scoreForSlot, scorePlayers } from "../lib/scoring";
import type { RoleId, RoleScore, ScoredPlayer, SlotId, ValidationReport } from "../lib/types";

type Tab = "tactic" | "rankings" | "import" | "validation" | "compare" | "settings";
type SortKey = "roleScore" | "recruitmentScore" | "confidenceScore" | "attribute" | "stats" | "hidden" | "position" | "value" | "age" | "minutes" | "averageRating";
type SuitabilityFilter = "role-position" | "conversion" | "all";
type PositionFilter = "" | "GK" | "DL" | "DC" | "DR" | "WBL" | "WBR" | "DM" | "ML" | "MC" | "MR" | "AML" | "AMC" | "AMR" | "ST";
const fmt = (value?: number, dp = 1) => value === undefined ? "-" : value.toFixed(dp);
const scoreClass = (value?: number) => value === undefined ? "" : value >= 80 ? "elite" : value >= 65 ? "good" : value >= 50 ? "okay" : "low";
const compactMoney = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return "-";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs < 1) return `${sign}£${Math.round(abs * 1000)}k`;
  const shown = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace(/\.0$/, "");
  return `${sign}£${shown}M`;
};
const compactWage = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return "-";
  if (Math.abs(value) < 1) return `£${Math.round(value * 1000)}`;
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `£${shown}k`;
};
const height = (value?: string | number) => {
  if (value === undefined || value === "") return "-";
  const raw = String(value).trim();
  const imperial = raw.match(/(\d+)\s*(?:'|ft|feet)\s*(\d+)?/i);
  if (imperial) return `${Number(imperial[1])}'${Number(imperial[2] ?? 0)}"`;
  const metric = raw.match(/(\d+(?:\.\d+)?)\s*(cm|m)?/i);
  if (!metric) return raw;
  const n = Number(metric[1]), cm = metric[2]?.toLowerCase() === "m" ? n * 100 : n;
  if (!Number.isFinite(cm) || cm < 100 || cm > 230) return raw;
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
};
const money = (player: ScoredPlayer) => player.transferValueStatus === "not_for_sale" ? "Not for sale" : compactMoney(player.valueM);
const POSITION_OPTIONS: { value: PositionFilter; label: string }[] = [
  { value: "", label: "All positions" }, { value: "GK", label: "GK" }, { value: "DL", label: "LB / D (L)" }, { value: "DC", label: "CB / D (C)" }, { value: "DR", label: "RB / D (R)" },
  { value: "WBL", label: "LWB / WB (L)" }, { value: "WBR", label: "RWB / WB (R)" }, { value: "DM", label: "DM" }, { value: "ML", label: "LM / M (L)" }, { value: "MC", label: "CM / M (C)" }, { value: "MR", label: "RM / M (R)" },
  { value: "AML", label: "LW / AM (L)" }, { value: "AMC", label: "AM / AM (C)" }, { value: "AMR", label: "RW / AM (R)" }, { value: "ST", label: "ST" },
];
const ATTRIBUTE_GROUPS = [
  { label: "Technical", keys: [["Cor", "cor"], ["Cro", "cro"], ["Dri", "dri"], ["Fin", "fin"], ["Fir", "fir"], ["Fre", "fre"], ["Hea", "hea"], ["Lon", "lon"], ["L Th", "lth"], ["Mar", "mar"], ["Pas", "pas"], ["Pen", "pen"], ["Tck", "tck"], ["Tec", "tec"]] },
  { label: "Mental", keys: [["Agg", "agg"], ["Ant", "ant"], ["Bra", "bra"], ["Cmp", "cmp"], ["Cnt", "cnt"], ["Vis", "vis"], ["Dec", "dec"], ["Det", "det"], ["Fla", "fla"], ["Ldr", "ldr"], ["OtB", "otb"], ["Pos", "pos"], ["Tea", "tea"], ["Wor", "wor"]] },
  { label: "Physical", keys: [["Acc", "acc"], ["Agi", "agi"], ["Bal", "bal"], ["Jum", "jum"], ["Nat", "nat"], ["Pac", "pac"], ["Sta", "sta"], ["Str", "str"]] },
] as const;
const GOALKEEPER_ATTRIBUTE_GROUPS = [
  { label: "Goalkeeping", keys: [["Aer", "aer"], ["Cmd", "cmd"], ["Com", "com"], ["Ecc", "ecc"], ["Han", "han"], ["Kic", "kic"], ["1v1", "oneVOne"], ["Pun", "pun"], ["Ref", "ref"], ["TRO", "tro"], ["Thr", "thr"]] },
  { label: "Mental", keys: [["Agg", "agg"], ["Ant", "ant"], ["Bra", "bra"], ["Cmp", "cmp"], ["Cnt", "cnt"], ["Vis", "vis"], ["Dec", "dec"], ["Det", "det"], ["Fla", "fla"], ["Ldr", "ldr"], ["OtB", "otb"], ["Pos", "pos"], ["Tea", "tea"], ["Wor", "wor"]] },
  { label: "Physical", keys: [["Acc", "acc"], ["Agi", "agi"], ["Bal", "bal"], ["Jum", "jum"], ["Nat", "nat"], ["Pac", "pac"], ["Sta", "sta"], ["Str", "str"]] },
] as const;
const modalTabs = ["Attributes", "Information", "FM Stag Stats", "Contract Info", "Transfer Status", "Medical Report", "History"] as const;
type ModalTab = typeof modalTabs[number];
const attrTone = (value?: number) => value === undefined ? "missing" : value >= 16 ? "elite" : value >= 13 ? "good" : value >= 10 ? "okay" : "low";
const ATTRIBUTE_LABELS: Record<string, string> = {
  Cor: "Corners", Cro: "Crossing", Dri: "Dribbling", Fin: "Finishing", Fir: "First Touch", Fre: "Free Kick Taking", Hea: "Heading", Lon: "Long Shots", "L Th": "Long Throws", Mar: "Marking", Pas: "Passing", Pen: "Penalty Taking", Tck: "Tackling", Tec: "Technique",
  Agg: "Aggression", Ant: "Anticipation", Bra: "Bravery", Cmp: "Composure", Cnt: "Concentration", Vis: "Vision", Dec: "Decisions", Det: "Determination", Fla: "Flair", Ldr: "Leadership", OtB: "Off The Ball", Pos: "Positioning", Tea: "Teamwork", Wor: "Work Rate",
  Acc: "Acceleration", Pac: "Pace", Sta: "Stamina", Str: "Strength", Agi: "Agility", Bal: "Balance", Jum: "Jumping Reach", Nat: "Natural Fitness",
  Ref: "Reflexes", "1v1": "One On Ones", Cmd: "Command Of Area", Kic: "Kicking", Thr: "Throwing", Han: "Handling", Aer: "Aerial Reach", Com: "Communication", Ecc: "Eccentricity", Pun: "Punching", TRO: "Rushing Out",
};
const STAT_TARGETS: Record<string, { field: string; target: number; label: string; suffix?: string; dp?: number }> = {
  savePct: { field: "savePercentage", target: 80, label: "Save Percentage", suffix: "%", dp: 0 },
  cleanSheets90: { field: "cleanSheets90", target: 0.35, label: "Clean Sheets per 90" },
  passCompletionPct: { field: "passCompletion", target: 90, label: "Pass Completion", suffix: "%", dp: 0 },
  longPassCompletionPct: { field: "longPassCompletion", target: 72, label: "Long Pass Completion", suffix: "%", dp: 0 },
  avgRating: { field: "averageRating", target: 7.6, label: "Average Rating", dp: 2 },
  xA90: { field: "xa90", target: 0.35, label: "Expected Assists per 90" },
  assists90: { field: "assists90", target: 0.45, label: "Assists per 90" },
  keyPasses90: { field: "keyPasses90", target: 2.7, label: "Key Passes per 90" },
  crossesCompleted90: { field: "crossesCompleted90", target: 1.8, label: "Crosses Completed per 90" },
  dribblesCompleted90: { field: "dribbles90", target: 4, label: "Dribbles Completed per 90" },
  tacklesWon90: { field: "tackles90", target: 3.2, label: "Tackles Won per 90" },
  interceptions90: { field: "interceptions90", target: 2.6, label: "Interceptions per 90" },
  progressivePasses90: { field: "progressivePasses90", target: 8, label: "Progressive Passes per 90" },
  headersWonPct: { field: "headersPct", target: 75, label: "Headers Won", suffix: "%", dp: 0 },
  xG90: { field: "xg90", target: 0.65, label: "Expected Goals per 90" },
  goals90: { field: "goals90", target: 0.75, label: "Goals per 90" },
  shots90: { field: "shots90", target: 4, label: "Shots per 90" },
  shotConversionPct: { field: "conversionPercentage", target: 22, label: "Shot Conversion", suffix: "%", dp: 0 },
  errorsLeadingToGoal90: { field: "errorsLeadingToGoal90", target: 0.25, label: "Errors Leading to Goal per 90" },
};
const isGoalkeeper = (player: ScoredPlayer) => positionCodes(player.position).has("GK");
const textValue = (value: unknown) => value === undefined || value === null || value === "" ? "-" : String(value);
const field = (player: ScoredPlayer, ...keys: string[]) => {
  for (const key of keys) {
    const value = player[key];
    if ((typeof value === "string" || typeof value === "number") && value !== "") return value;
  }
  return undefined;
};
const dobLine = (player: ScoredPlayer) => {
  const dob = field(player, "dob", "dateOfBirth");
  if (!dob) return player.age !== undefined ? `${fmt(player.age, 0)} years old` : "-";
  if (/\(\s*\d+\s*years?\s*old\s*\)/i.test(String(dob))) return String(dob);
  return `${dob}${player.age !== undefined ? ` (${fmt(player.age, 0)} years old)` : ""}`;
};
const capsLine = (player: ScoredPlayer) => {
  const caps = field(player, "internationalCaps", "caps");
  const goals = field(player, "internationalGoals", "intGoals");
  if (caps === undefined && goals === undefined) return "";
  return `${caps ?? 0} caps / ${goals ?? 0} goals`;
};
const statValue = (player: ScoredPlayer, key: string, dp = 2, suffix = "") => typeof player[key] === "number" ? `${(player[key] as number).toFixed(dp)}${suffix}` : "-";
const clampScore = (value: number) => Math.min(100, Math.max(0, value));
const minutesConfidence = (minutes = 0) => minutes <= 90 ? 0.1 : minutes <= 180 ? 0.2 : minutes <= 300 ? 0.35 : minutes <= 600 ? 0.55 : minutes <= 900 ? 0.75 : minutes <= 1500 ? 0.9 : 1;
const POSITION_CODE_CACHE = new Map<string, Set<string>>();
function positionCodes(position?: string) {
  const text = String(position ?? "").toUpperCase().replace(/\s+/g, "");
  const cached = POSITION_CODE_CACHE.get(text);
  if (cached) return cached;
  const out = new Set<string>();
  if (text.includes("GK")) out.add("GK");
  if (/(^|,|\/)DM($|,|\/)/.test(text)) out.add("DM");
  if (/(^|,|\/)ST(?:\([RLC]+\))?($|,|\/)/.test(text)) out.add("ST");
  for (const match of text.matchAll(/([A-Z/]+)\(([RLC]+)\)/g)) {
    const bases = match[1].split("/");
    const sides = match[2].split("");
    for (const base of bases) for (const side of sides) {
      if (base === "D") out.add(side === "L" ? "DL" : side === "R" ? "DR" : "DC");
      if (base === "WB") out.add(side === "L" ? "WBL" : side === "R" ? "WBR" : "DC");
      if (base === "M") out.add(side === "L" ? "ML" : side === "R" ? "MR" : "MC");
      if (base === "AM") out.add(side === "L" ? "AML" : side === "R" ? "AMR" : "AMC");
      if (base === "ST") out.add("ST");
    }
  }
  ["DL", "DR", "DC", "WBL", "WBR", "MC", "ML", "MR", "AMC", "AML", "AMR"].forEach((code) => { if (text.includes(code)) out.add(code); });
  POSITION_CODE_CACHE.set(text, out);
  return out;
}
const matchesPosition = (player: ScoredPlayer, filter: PositionFilter) => !filter || positionCodes(player.position).has(filter);

export default function Home() {
  const [tab, setTab] = useState<Tab>("import"), [players, setPlayers] = useState<ScoredPlayer[]>([]);
  const [report, setReport] = useState<ValidationReport | null>(null), [error, setError] = useState("");
  const [progress, setProgress] = useState({ message: "", percent: 0 }), [busy, setBusy] = useState(false);
  const [roleId, setRoleId] = useState<RoleId>("af-at"), [slot, setSlot] = useState<SlotId>("ST");
  const [selected, setSelected] = useState<ScoredPlayer | null>(null), [compareIds, setCompareIds] = useState<string[]>([]);
  const [search, setSearch] = useState(""), [minMinutes, setMinMinutes] = useState(0), [maxAge, setMaxAge] = useState(50);
  const [minAge, setMinAge] = useState(0), [club, setClub] = useState(""), [nation, setNation] = useState(""), [positionFilter, setPositionFilter] = useState<PositionFilter>(""), [foot, setFoot] = useState("");
  const [suitabilityFilter, setSuitabilityFilter] = useState<SuitabilityFilter>("all");
  const [maxWage, setMaxWage] = useState(1000), [maxValue, setMaxValue] = useState(500), [minScore, setMinScore] = useState(0);
  const [includeMissingStats, setIncludeMissingStats] = useState(true), [includeMissingHidden, setIncludeMissingHidden] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("roleScore"), [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const rankingScores = useMemo(() => new Map(players.map((player) => [player.id, scoreForSlot(player, roleId, slot)])), [players, roleId, slot]);
  const rankings = useMemo(() => players.filter((player) => {
    const score = rankingScores.get(player.id)!;
    const valuePass = player.transferValueStatus === "not_for_sale" || Number(player.valueM ?? 0) <= maxValue;
    const positionPass = suitabilityFilter === "all" || Number(score.position.score ?? 0) >= (suitabilityFilter === "conversion" ? 45 : 80);
    return `${player.name} ${player.club ?? ""}`.toLowerCase().includes(search.toLowerCase()) &&
      Number(player.minutes ?? 0) >= minMinutes && Number(player.age ?? 0) >= minAge && Number(player.age ?? 0) <= maxAge &&
      String(player.club ?? "").toLowerCase().includes(club.toLowerCase()) && String(player.nationality ?? "").toLowerCase().includes(nation.toLowerCase()) &&
      matchesPosition(player, positionFilter) && `${player.preferredFoot ?? ""} ${player.leftFoot ?? ""} ${player.rightFoot ?? ""}`.toLowerCase().includes(foot.toLowerCase()) &&
      Number(player.wageK ?? 0) <= maxWage && valuePass && positionPass && score.roleScore >= minScore &&
      (includeMissingStats || score.stats.available > 0) && (includeMissingHidden || score.hidden.available > 0);
  }).sort((a, b) => {
    const aScore = rankingScores.get(a.id)!, bScore = rankingScores.get(b.id)!;
    const scoreValue = (score: RoleScore) => sortKey === "roleScore" ? score.roleScore : sortKey === "recruitmentScore" ? score.recruitmentScore : sortKey === "confidenceScore" ? score.confidenceScore : ["attribute", "stats", "hidden", "position", "value"].includes(sortKey) ? Number(score[sortKey as "attribute" | "stats" | "hidden" | "position" | "value"].score ?? 0) : undefined;
    const aValue = scoreValue(aScore) ?? Number(a[sortKey] ?? 0);
    const bValue = scoreValue(bScore) ?? Number(b[sortKey] ?? 0);
    return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
  }), [players, rankingScores, search, minMinutes, minAge, maxAge, club, nation, positionFilter, foot, suitabilityFilter, maxWage, maxValue, minScore, includeMissingStats, includeMissingHidden, sortKey, sortDirection]);
  const compared = players.filter((player) => compareIds.includes(player.id));

  async function handleFiles(files: File[]) {
    setBusy(true); setError(""); setProgress({ message: "Preparing upload", percent: 0 });
    try {
      const imported = await importFMFiles(files, (message, percent) => setProgress({ message, percent }));
      const scored = scorePlayers(imported.players); setPlayers(scored); setReport(imported.report); setTab("validation");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  function selectSlot(nextSlot: SlotId, nextRole: RoleId) { setSlot(nextSlot); setRoleId(nextRole); setTab("rankings"); }
  function toggleCompare(id: string) { setCompareIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 4 ? [...current, id] : current); }
  function clearData() { setPlayers([]); setReport(null); setCompareIds([]); setSelected(null); setTab("import"); }
  function sort(next: SortKey) { if (sortKey === next) setSortDirection((value) => value === "desc" ? "asc" : "desc"); else { setSortKey(next); setSortDirection("desc"); } }

  return <main className="shell">
    <header className="hero"><div><span className="eyebrow">FM24 recruitment</span><h1>FM Recruitment Lab</h1><p>Private browser-side scouting from uploaded FM HTML exports. Your file stays on this device.</p></div><div className="hero-stat"><strong>{players.length.toLocaleString()}</strong><span>players loaded</span></div></header>
    <nav><div className="brand-title"><span>Brewerlabs</span> <b>FM</b> <span>Lab</span></div>{(["tactic", "rankings", "import", "validation", "compare", "settings"] as Tab[]).map((value) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value}{value === "compare" ? ` (${compareIds.length})` : ""}</button>)}{players.length > 0 && <button className="clear" onClick={clearData}>Clear local data</button>}</nav>
    {error && <div className="notice error">{error}</div>}

    {tab === "import" && <section className="panel import-panel"><span className="eyebrow">Step one</span><h2>Upload FM HTML exports</h2><p>Select one or more FM24 player-search HTML exports. Files are streamed and scored in browser memory only.</p>
      <label className="dropzone"><strong>{busy ? "Reading player data..." : "Choose FM HTML files"}</strong><span>Large all-player exports are supported. Missing columns are reported clearly.</span><input type="file" accept=".html,.htm,text/html" multiple disabled={busy} onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} /></label>
      {(busy || progress.percent > 0) && <div className="progress"><div style={{ width: `${progress.percent}%` }} /><span>{progress.message}: {progress.percent}%</span></div>}
    </section>}

    {tab === "validation" && <Validation report={report} onTactic={() => setTab("tactic")} />}
    {tab === "tactic" && <Tactic onSelect={selectSlot} />}
    {tab === "rankings" && <section className={filtersOpen ? "rank-layout" : "rank-layout filters-collapsed"}><section className="panel filters"><div className="filters-head"><div><span className="eyebrow">{slot}</span><h2>{ROLE_CONFIG[roleId].shortName} · {ROLE_CONFIG[roleId].label}</h2><p>Default ranking is Best Role Fit. Use Role suitability to hide players who cannot play the selected position.</p></div><button className="filter-toggle" onClick={() => setFiltersOpen((value) => !value)}>{filtersOpen ? "Hide filters" : "Show filters"}</button></div>
      {filtersOpen && <><div className="filter-grid"><label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Player or club" /></label><label>Club<input value={club} onChange={(e) => setClub(e.target.value)} placeholder="Any club" /></label><label>Nation<input value={nation} onChange={(e) => setNation(e.target.value)} placeholder="Any nation" /></label><label>Position<select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value as PositionFilter)}>{POSITION_OPTIONS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}</select></label><label>Role suitability<select value={suitabilityFilter} onChange={(e) => setSuitabilityFilter(e.target.value as SuitabilityFilter)}><option value="role-position">Role position only</option><option value="conversion">Include conversions</option><option value="all">All players</option></select></label><label>Footedness<input value={foot} onChange={(e) => setFoot(e.target.value)} placeholder="left / right / either" /></label><label>Minimum minutes<input type="number" value={minMinutes} onChange={(e) => setMinMinutes(Number(e.target.value))} /></label><label>Minimum age<input type="number" value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} /></label><label>Maximum age<input type="number" value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} /></label><label>Maximum wage £k/w<input type="number" value={maxWage} onChange={(e) => setMaxWage(Number(e.target.value))} /></label><label>Maximum value £m<input type="number" value={maxValue} onChange={(e) => setMaxValue(Number(e.target.value))} /></label><label>Minimum Role Score<input type="number" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} /></label></div>
      <div className="toggles"><label><input type="checkbox" checked={includeMissingStats} onChange={(e) => setIncludeMissingStats(e.target.checked)} /> Include missing stats</label><label><input type="checkbox" checked={includeMissingHidden} onChange={(e) => setIncludeMissingHidden(e.target.checked)} /> Include missing hidden data</label>
      <button onClick={() => exportCSV(`${slot}-${roleId}-rankings.csv`, rankings, rankingScores)}>Export CSV</button><button onClick={() => exportHTML(`${slot}-${roleId}-rankings.html`, rankings, rankingScores)}>Export HTML</button></div></>}</section>
      <RankTable players={rankings.slice(0, 500)} total={rankings.length} scores={rankingScores} compareIds={compareIds} sort={sort} onOpen={setSelected} onCompare={toggleCompare} /></section>}
    {tab === "compare" && <Comparison players={compared} onExport={() => exportCSV("fm-recruitment-comparison.csv", compared)} />}
    {tab === "settings" && <Settings onExport={() => exportCSV("fm-recruitment-full-scored-dataset.csv", players)} />}
    {selected && <PlayerModal player={selected} slot={slot} roleId={roleId} onClose={() => setSelected(null)} />}
  </main>;
}

function Validation({ report, onTactic }: { report: ValidationReport | null; onTactic: () => void }) {
  if (!report) return <section className="panel empty">Upload an FM HTML file to generate a validation report.</section>;
  return <section className="panel validation"><span className="eyebrow">Import complete</span><h2>Data validation report</h2><div className="report-grid">{report.messages.map((message) => <div key={message}><strong>{message}</strong></div>)}</div>
    <h3>Files</h3><p>{report.files.join(", ")}</p><h3>Missing useful columns</h3><p>{report.missingUseful.length ? report.missingUseful.join(", ") : "None. Excellent export coverage."}</p>
    <details><summary>Detected columns ({report.detectedColumns.length})</summary><p>{report.detectedColumns.join(", ")}</p></details><button className="primary" onClick={onTactic}>Open role board</button></section>;
}
function Tactic({ onSelect }: { onSelect: (slot: SlotId, role: RoleId) => void }) {
  return <section className="panel tactic-wrap"><div><span className="eyebrow">Role map</span><h2>Balanced FM24 roles</h2><p>Click a position to open its live rankings.</p></div><div className="pitch">{TACTIC_SLOTS.map((item) => <button key={item.id} className="position" style={{ left: `${item.x}%`, top: `${item.y}%` }} onClick={() => onSelect(item.id, item.roleId)}><strong>{item.id}</strong><span>{ROLE_CONFIG[item.roleId].shortName}</span></button>)}</div></section>;
}
function RankTable({ players, total, scores, compareIds, sort, onOpen, onCompare }: { players: ScoredPlayer[]; total: number; scores: Map<string, RoleScore>; compareIds: string[]; sort: (key: SortKey) => void; onOpen: (player: ScoredPlayer) => void; onCompare: (id: string) => void }) {
  const heads: [SortKey | "name" | "club" | "position" | "valueM" | "wageK", string][] = [["name", "Player"], ["age", "Age"], ["club", "Club"], ["position", "Position"], ["valueM", "FM Value"], ["wageK", "Wage"], ["roleScore", "Role Score"], ["recruitmentScore", "Recruitment"], ["confidenceScore", "Confidence"], ["attribute", "Attribute"], ["stats", "Adj Stats"], ["hidden", "Hidden/Profile"], ["position", "Position Score"], ["value", "Value Score"], ["minutes", "Mins"], ["averageRating", "Av Rat"]];
  return <section className="panel table-panel"><div className="panel-head"><strong>{total.toLocaleString()} ranked matches</strong><span>{total > players.length ? `Showing first ${players.length.toLocaleString()} results` : "Showing all results"}</span></div>{!players.length ? <div className="empty-state">No players match the current filters.</div> : <div className="table-scroll"><table><thead><tr><th>#</th><th>Compare</th>{heads.map(([key, label]) => <th key={key} onClick={() => sort(key as SortKey)}>{label}</th>)}<th>Caps</th><th>Warnings</th></tr></thead><tbody>{players.map((player, index) => { const score = scores.get(player.id)!; return <tr key={player.id} onClick={() => onOpen(player)}><td>{index + 1}</td><td><button className={compareIds.includes(player.id) ? "compare active" : "compare"} onClick={(e) => { e.stopPropagation(); onCompare(player.id); }}>+</button></td><td><strong>{player.name}</strong><small>{player.nationality}</small></td><td>{fmt(player.age, 0)}</td><td>{player.club}</td><td>{player.position}</td><td>{money(player)}</td><td>{compactWage(player.wageK)}</td><td className={scoreClass(score.roleScore)}>{fmt(score.roleScore)}</td><td>{fmt(score.recruitmentScore)}</td><td>{fmt(score.confidenceScore)}</td><td>{fmt(score.attribute.score)}</td><td>{fmt(score.stats.score)}</td><td>{fmt(score.hidden.score)}</td><td>{fmt(score.position.score)}</td><td>{fmt(score.value.score)}</td><td>{fmt(player.minutes, 0)}</td><td>{fmt(player.averageRating, 2)}</td><td>{score.caps.join(", ") || "-"}</td><td>{score.warnings[0] ?? "-"}</td></tr>; })}</tbody></table></div>}</section>;
}
function Comparison({ players, onExport }: { players: ScoredPlayer[]; onExport: () => void }) {
  const roles = Object.keys(ROLE_CONFIG) as RoleId[];
  return <section className="panel compare-panel"><div className="panel-head"><div><span className="eyebrow">Shortlist decision</span><h2>Player comparison</h2></div><button onClick={onExport}>Export CSV</button></div>{!players.length ? <p>Add up to four players from a role ranking table.</p> : <div className="table-scroll"><table><thead><tr><th>Metric</th>{players.map((player) => <th key={player.id}>{player.name}</th>)}</tr></thead><tbody><tr><td>Club</td>{players.map((p) => <td key={p.id}>{p.club}</td>)}</tr><tr><td>Age</td>{players.map((p) => <td key={p.id}>{p.age}</td>)}</tr>{roles.map((role) => <tr key={role}><td>{ROLE_CONFIG[role].shortName}</td>{players.map((p) => <td key={p.id} className={scoreClass(p.scores[role].roleScore)}>{fmt(p.scores[role].roleScore)}</td>)}</tr>)}</tbody></table></div>}</section>;
}
function Settings({ onExport }: { onExport: () => void }) {
  return <section className="panel settings"><span className="eyebrow">Scoring transparency</span><h2>{PRESET_VERSION}</h2><p>Role Score is pure role fit: 70% attributes, 15% position/foot, 10% hidden/profile and 5% shrunken stats. Recruitment Score adds market value, wage and age/development.</p><button onClick={onExport}>Export full scored dataset CSV</button>{Object.values(ROLE_CONFIG).map((role) => <details key={role.id}><summary><strong>{role.shortName}</strong> · {role.label}</summary><p><b>Attribute weights:</b> {Object.entries(role.attributeWeights).map(([key, weight]) => `${key} ${weight}`).join(", ")}</p><p><b>Positive stats:</b> {Object.entries(role.positiveStatWeights).map(([key, weight]) => `${key} ${weight}`).join(", ")}</p><p><b>Floor penalties:</b> {role.floorPenalties.map((p) => `${p.attribute}<${p.lt}: -${p.minus}`).join(", ") || "None"}</p></details>)}</section>;
}
function PlayerModal({ player, roleId, slot, onClose }: { player: ScoredPlayer; roleId: RoleId; slot: SlotId; onClose: () => void }) {
  const [profileTab, setProfileTab] = useState<ModalTab>("Attributes");
  const active = scoreForSlot(player, roleId, slot), role = ROLE_CONFIG[roleId];
  const roleWeights = new Set(Object.keys(role.attributeWeights).filter((key) => role.attributeWeights[key] >= 7));
  const faceUrl = playerFaceUrl(player), clubUrl = clubLogoUrl(player), nationUrl = nationLogoUrl(player);
  return <div className="backdrop" onClick={onClose}><aside className="modal fm-profile-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button>
    <section className="fm-profile-top">
      <div className="fm-player-card">
        <div className="profile-logo-stack"><div className="flag-tile"><AssetImage src={nationUrl} alt={`${player.nationality ?? "Nation"} logo`} fallback={String(player.nationality ?? "NAT").slice(0, 3).toUpperCase()} /></div><div className="club-tile"><AssetImage src={clubUrl} alt={`${player.club ?? "Club"} logo`} fallback={player.club ? player.club.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase() : "CLB"} /></div></div>
        <div className="profile-photo-slot"><AssetImage src={faceUrl} alt={`${player.name} face`} fallback={player.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()} /></div>
        <div className="profile-status-chip">Int</div>
        <div className="profile-name-strip"><strong>{player.name}</strong><span>Role {fmt(active.roleScore)} · Recruitment {fmt(active.recruitmentScore)} · Confidence {fmt(active.confidenceScore)}</span></div>
      </div>
      <TopInfoCard player={player} />
    </section>
    <div className="fm-tabs">{modalTabs.map((label) => <button className={profileTab === label ? "active" : ""} key={label} type="button" onClick={() => setProfileTab(label)}>{label}</button>)}</div>
    {profileTab === "Attributes" ? <><section className="fm-profile-body">
      <div className="fm-position-panel"><h3>Role and duty</h3><div className="fm-role-card"><strong>{role.shortName}</strong><span>{role.label}</span><b className={scoreClass(active.roleScore)}>{fmt(active.roleScore)}</b></div><div className="fm-role-list">{Object.values(ROLE_CONFIG).map((candidate) => <div className="role-bar" key={candidate.id}><span>{candidate.shortName}</span><i><b className={scoreClass(player.scores[candidate.id].roleScore)} style={{ width: `${player.scores[candidate.id].roleScore}%` }} /></i><strong className={scoreClass(player.scores[candidate.id].roleScore)}>{fmt(player.scores[candidate.id].roleScore)}</strong></div>)}</div></div>
      <section className="attribute-panel fm-attributes"><div className="attribute-groups">{(isGoalkeeper(player) ? GOALKEEPER_ATTRIBUTE_GROUPS : ATTRIBUTE_GROUPS).map((group) => {
        const visible = group.keys.filter(([, key]) => player[key] !== undefined);
        if (!visible.length) return null;
        return <div className="attribute-group" key={group.label}><h4>{group.label}</h4>{visible.map(([label, key]) => {
          const value = player[key] as number | undefined, important = roleWeights.has(label);
          return <div className={important ? "attribute-row important" : "attribute-row"} key={label}><span>{ATTRIBUTE_LABELS[label] ?? label}</span><strong className={attrTone(value)}>{value ?? "-"}</strong></div>;
        })}</div>;
      })}</div></section>
    </section>
    <section className="fm-bottom-panels"><div><h3>Strengths</h3><StrengthList items={active.strengths} /></div><div><h3>Score breakdown</h3><Breakdown score={active} /></div><div><h3>Scoring notes</h3><ScoringNotes score={active} /></div></section></> : <ProfileTabContent tab={profileTab} player={player} score={active} slot={slot} />}
  </aside></div>;
}
function AssetImage({ src, alt, fallback }: { src?: string; alt: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img src={src} alt={alt} onError={() => setFailed(true)} /> : <span>{fallback}</span>;
}
function ProfileTabContent({ tab, player, score, slot }: { tab: Exclude<ModalTab, "Attributes">; player: ScoredPlayer; score: RoleScore; slot: SlotId }) {
  if (tab === "Information") return <section className="fm-tab-panel info-tab"><div className="fm-card-block"><h3>Personal Information</h3><InfoGrid rows={[["Full Name", player.name], ["Personality", field(player, "personality")], ["Media Description", field(player, "mediaDescription")], ["Media Handling", field(player, "mediaHandling")], ["Preferred Foot", field(player, "preferredFoot")], ["Height", height(player.height)], ["Club", player.club], ["Division", player.division]]} /></div><div className="fm-card-block wide"><h3>Nationalities</h3><InfoGrid rows={[["Nationality", player.nationality], ["Second Nationality", player.secondNationality], ["Based", field(player, "basedIn", "based")], ["Position", player.position], ["UID", player.uid], ["Age", player.age]]} /></div></section>;

  if (tab === "FM Stag Stats") return <StagStats player={player} activeSlot={slot} />;

  if (tab === "Contract Info") return <section className="fm-tab-panel contract-tab"><div className="fm-card-block"><h3>{player.club ?? "Current Club"}</h3><div className="contract-hero"><strong>{compactWage(player.wageK)} per week</strong><span>{money(player)} transfer value</span></div><InfoGrid rows={[["Contract Type", field(player, "contractType") ?? "Not exported"], ["Expires", field(player, "contractExpires") ?? "Not exported"], ["Started", field(player, "contractStarted") ?? "Not exported"], ["Playing Time", field(player, "playingTime") ?? "Not exported"], ["Wage", compactWage(player.wageK)], ["Value", money(player)]]} /></div><div className="fm-card-block"><h3>Bonuses</h3><InfoGrid rows={[["Appearance Fee", field(player, "appearanceFee") ?? "Not exported"], ["Goal Bonus", field(player, "goalBonus") ?? "Not exported"], ["Unused Substitute Fee", field(player, "unusedSubFee") ?? "Not exported"], ["Loyalty Bonus", field(player, "loyaltyBonus") ?? "Not exported"]]} /></div><div className="fm-card-block"><h3>Clauses</h3><InfoGrid rows={[["Release Clause", field(player, "releaseClause") ?? "Not exported"], ["Yearly Wage Rise", field(player, "yearlyWageRise") ?? "Not exported"], ["Extension Option", field(player, "extensionOption") ?? "Not exported"], ["Sell-on Clause", field(player, "sellOnClause") ?? "Not exported"]]} /></div></section>;

  if (tab === "Transfer Status") return <section className="fm-tab-panel transfer-tab"><h3>Interested Clubs</h3><div className="interest-head"><strong>Main Interest</strong><span>Offer Date</span></div><InfoGrid rows={[["Recent Offers", field(player, "recentOffers") ?? "None"], ["Major Interest From Clubs", field(player, "majorInterest") ?? "None"], ["Minor Interest From Clubs", field(player, "minorInterest") ?? "None"], ["Transfer Status", player.transferValueStatus === "not_for_sale" ? "Not for sale" : textValue(player.transferValueStatus)], ["FM Value", money(player)]]} /></section>;

  if (tab === "Medical Report") return <section className="fm-tab-panel medical-tab"><div><h3>Match Load</h3><strong className="green">Light</strong><p>{fmt(player.minutes, 0)} exported minutes.</p><p>Detailed 14-day load is not exported in the uploaded HTML.</p></div><div><h3>Training Load</h3><strong className="green">{field(player, "trainingLoad") ?? "Not exported"}</strong><p>{field(player, "fatigue") ?? "Fatigue column not exported."}</p></div><div><h3>Injury Susceptibility</h3><strong className="yellow">{field(player, "injuryRisk") ?? "Not exported"}</strong><p>{field(player, "injury") ?? "No recurring injury column exported."}</p></div><div><h3>Fitness</h3><strong className="green">{field(player, "condition", "fitness") ?? "Not exported"}</strong><p>{field(player, "morale") ?? "Morale/condition detail not exported."}</p></div></section>;

  return <section className="fm-tab-panel history-tab"><h3>Career Stats</h3><table className="fm-history-table"><thead><tr><th>Year</th><th>Team</th><th>Apps</th><th>Goals</th></tr></thead><tbody><tr><td>Current export</td><td><strong>{player.club ?? "-"}</strong><small>{player.nationality ?? ""}</small></td><td>{fmt(player.minutes ? Math.round(Number(player.minutes) / 90) : undefined, 0)}</td><td>{statValue(player, "goals90", 2)}</td></tr></tbody><tfoot><tr><td>Overall</td><td>Uploaded dataset</td><td>{fmt(player.minutes ? Math.round(Number(player.minutes) / 90) : undefined, 0)}</td><td>{statValue(player, "goals90", 2)}</td></tr></tfoot></table><p className="muted-tab-note">Season-by-season club history needs those history columns in the FM export.</p></section>;
}
function InfoGrid({ rows }: { rows: [string, unknown][] }) {
  return <div className="fm-info-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{textValue(value)}</strong></div>)}</div>;
}
function formatStatTarget(metric: { target: number; suffix?: string; dp?: number }) {
  return `${metric.target.toFixed(metric.dp ?? 2).replace(/\.00$/, "")}${metric.suffix ?? ""}`;
}
function formatStatMetric(player: ScoredPlayer, metric: { field: string; suffix?: string; dp?: number }) {
  return statValue(player, metric.field, metric.dp ?? 2, metric.suffix ?? "");
}
function StagStats({ player, activeSlot }: { player: ScoredPlayer; activeSlot: SlotId }) {
  const [selectedSlot, setSelectedSlot] = useState<SlotId>(activeSlot);
  const tacticSlot = TACTIC_SLOTS.find((item) => item.id === selectedSlot) ?? TACTIC_SLOTS[0];
  const role = ROLE_CONFIG[tacticSlot.roleId], score = scoreForSlot(player, role.id, tacticSlot.id);
  const confidence = minutesConfidence(Number(player.minutes ?? 0));
  const positiveRows = Object.entries(role.positiveStatWeights).map(([key, weight]) => {
    const metric = STAT_TARGETS[key], value = metric && typeof player[metric.field] === "number" ? player[metric.field] as number : undefined;
    const metricScore = value === undefined || !metric ? undefined : clampScore(value / metric.target * 100);
    return { key, label: metric?.label ?? key, weight, playerValue: metric ? formatStatMetric(player, metric) : "-", target: metric ? formatStatTarget(metric) : "-", score: metricScore, type: "positive" as const };
  });
  const penaltyRows = Object.entries(role.negativeStatPenalties).map(([key, weight]) => {
    const metric = STAT_TARGETS[key], value = metric && typeof player[metric.field] === "number" ? player[metric.field] as number : undefined;
    const metricScore = value === undefined || !metric ? undefined : clampScore(value / metric.target * 100);
    return { key, label: metric?.label ?? key, weight, playerValue: metric ? formatStatMetric(player, metric) : "-", target: "Lower is better", score: metricScore, type: "penalty" as const };
  });
  const rows = [...positiveRows, ...penaltyRows];
  return <section className="fm-tab-panel stats-tab"><div className="fm-role-tabs tactic-stag-tabs">{TACTIC_SLOTS.map((item) => <button key={item.id} type="button" className={selectedSlot === item.id ? "active" : ""} onClick={() => setSelectedSlot(item.id)}><strong>{item.id}</strong><span>{ROLE_CONFIG[item.roleId].shortName}</span></button>)}</div>
    <div className="stag-summary"><ScorePill label="Raw STAG" value={score.rawStats} /><ScorePill label="Adjusted STAG" value={score.stats.score ?? 50} /><ScorePill label="Minutes confidence" value={confidence * 100} /><ScorePill label="Inputs" value={(score.stats.available / Math.max(score.stats.expected, 1)) * 100} /></div>
    <h3>{tacticSlot.id} · {role.shortName} performance model</h3>
    <table className="fm-stat-table"><thead><tr><th>Metric</th><th>Weight</th><th>Player</th><th>Benchmark</th><th>{role.shortName} score</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.type}-${row.key}`}><td><strong>{row.label}</strong><small>{row.type === "penalty" ? "Negative penalty" : "Positive role stat"}</small></td><td>{(row.weight * 100).toFixed(0)}%</td><td>{row.playerValue}</td><td>{row.target}</td><td className={row.type === "penalty" ? "low" : scoreClass(row.score)}>{row.score === undefined ? "Missing" : `${fmt(row.score, 1)}${row.type === "penalty" ? " penalty" : ""}`}</td></tr>)}</tbody></table>
    <p className="muted-tab-note">Adjusted STAG uses the same shrinkage as the ranking engine: 50 + ((raw score - 50) x minutes confidence). Missing stats are excluded from the raw score and reduce confidence.</p>
  </section>;
}
function ScorePill({ label, value }: { label: string; value: number }) {
  return <div className="score-pill"><span>{label}</span><strong className={scoreClass(value)}>{fmt(value)}</strong></div>;
}
function StrengthList({ items }: { items: string[] }) {
  if (!items.length) return <p className="empty-note">No standout exported attributes available.</p>;
  return <ul className="strength-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}
function ScoringNotes({ score }: { score: RoleScore }) {
  const concerns = [...score.caps, ...score.weaknesses, ...score.warnings];
  return <div className="scoring-notes"><div><span>Role score logic</span>{score.explanation.length ? score.explanation.map((note) => <p key={note}>{note}</p>) : <p>No extra scoring explanation available.</p>}</div><div><span>Checks and warnings</span>{concerns.length ? <ul>{concerns.map((note) => <li key={note}>{note}</li>)}</ul> : <p>No major exported-data concerns.</p>}</div></div>;
}
function TopInfoCard({ player }: { player: ScoredPlayer }) {
  const nationUrl = nationLogoUrl(player), caps = capsLine(player);
  const morale = field(player, "morale");
  return <div className="fm-info-card top-info-card">
    <div className="top-info-row full nationality-row"><span>Nationality</span><strong><span className="top-main-value">{player.nationality ?? "-"}<span className="mini-flag"><AssetImage src={nationUrl} alt={`${player.nationality ?? "Nation"} flag`} fallback="" /></span></span>{caps && <small>{caps}</small>}</strong></div>
    <div className="top-info-row full"><span>D.O.B.</span><strong>{dobLine(player)}</strong></div>
    <div className="top-info-row split"><span>Wage</span><strong>{compactWage(player.wageK)}</strong><span>Value</span><strong>{money(player)}</strong></div>
    <div className="top-info-row split"><span>Height</span><strong>{height(player.height)}</strong><span>Preferred Foot</span><strong>{field(player, "preferredFoot") ?? "-"}</strong></div>
    <div className="top-info-row split"><span>Morale</span><strong className="icon-value">{morale ?? "▲"}</strong><span>Av Rat</span><strong className="green">{fmt(player.averageRating, 2)}</strong></div>
    <div className="top-info-row split"><span>Left Foot</span><strong>{field(player, "leftFoot") ?? "-"}</strong><span>Right Foot</span><strong>{field(player, "rightFoot") ?? "-"}</strong></div>
  </div>;
}
function Breakdown({ score }: { score: RoleScore }) {
  const parts: [string, RoleScore[keyof Pick<RoleScore, "attribute" | "stats" | "hidden" | "position" | "value">], string][] = [
    ["Attributes", score.attribute, "Raw FM attributes normalised to 0-100 using this role's direct 0-10 weights. This is the main role-fit driver."],
    ["Adjusted Stats", score.stats, `Performance output after minutes shrinkage. Raw stats are ${fmt(score.rawStats)} before low-sample adjustment, so tiny samples are pulled back towards 50.`],
    ["Hidden/Profile", score.hidden, "Consistency, professionalism, important matches and similar profile data where exported. Missing hidden data is treated neutrally and lowers confidence."],
    ["Position/Foot", score.position, "Position familiarity plus the role's footedness rules. Natural role positions score highest; conversions and wrong-sided feet are capped or reduced."],
    ["Value", score.value, "Market value and wage efficiency context for recruitment. This does not inflate pure Role Score; it matters more in signing/value decisions."],
  ];
  const [selected, setSelected] = useState(parts[0][0]);
  const active = parts.find(([label]) => label === selected) ?? parts[0];
  return <div className="breakdown-wrap"><div className="breakdown">{parts.map(([label, item]) => <button type="button" className={selected === label ? "breakdown-card active" : "breakdown-card"} key={label} onClick={() => setSelected(label)}><span>{label}</span><strong>{fmt(item.score)}</strong><small>{item.available}/{item.expected} inputs</small></button>)}</div><div className="breakdown-explainer"><strong>{active[0]}</strong><p>{active[2]}</p></div></div>;
}
