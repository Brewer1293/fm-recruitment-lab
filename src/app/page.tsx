"use client";

import { useMemo, useState } from "react";
import { exportCSV, exportHTML } from "../lib/exports";
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
const money = (player: ScoredPlayer) => player.transferValueStatus === "not_for_sale" ? "Not for sale" : player.valueM === undefined ? "-" : `£${fmt(player.valueM)}m`;
const POSITION_OPTIONS: { value: PositionFilter; label: string }[] = [
  { value: "", label: "All positions" }, { value: "GK", label: "GK" }, { value: "DL", label: "LB / D (L)" }, { value: "DC", label: "CB / D (C)" }, { value: "DR", label: "RB / D (R)" },
  { value: "WBL", label: "LWB / WB (L)" }, { value: "WBR", label: "RWB / WB (R)" }, { value: "DM", label: "DM" }, { value: "ML", label: "LM / M (L)" }, { value: "MC", label: "CM / M (C)" }, { value: "MR", label: "RM / M (R)" },
  { value: "AML", label: "LW / AM (L)" }, { value: "AMC", label: "AM / AM (C)" }, { value: "AMR", label: "RW / AM (R)" }, { value: "ST", label: "ST" },
];
const ATTRIBUTE_GROUPS = [
  { label: "Technical", keys: [["Fir", "fir"], ["Fin", "fin"], ["Pas", "pas"], ["Tec", "tec"], ["Dri", "dri"], ["Cro", "cro"], ["Hea", "hea"], ["Tck", "tck"], ["Lon", "lon"]] },
  { label: "Mental", keys: [["OtB", "otb"], ["Tea", "tea"], ["Vis", "vis"], ["Dec", "dec"], ["Ant", "ant"], ["Cmp", "cmp"], ["Cnt", "cnt"], ["Pos", "pos"], ["Fla", "fla"], ["Bra", "bra"], ["Det", "det"], ["Wor", "wor"]] },
  { label: "Physical", keys: [["Acc", "acc"], ["Pac", "pac"], ["Sta", "sta"], ["Str", "str"], ["Agi", "agi"], ["Bal", "bal"], ["Jum", "jum"], ["Nat", "nat"]] },
  { label: "Goalkeeping", keys: [["Ref", "ref"], ["1v1", "oneVOne"], ["Cmd", "cmd"], ["Kic", "kic"], ["Thr", "thr"], ["Han", "han"], ["Aer", "aer"]] },
] as const;
const modalTabs = ["Attributes", "Information", "FM Stag Stats", "Contract Info", "Transfer Status", "Medical Report", "History"];
const attrTone = (value?: number) => value === undefined ? "missing" : value >= 16 ? "elite" : value >= 13 ? "good" : value >= 10 ? "okay" : "low";
const ATTRIBUTE_LABELS: Record<string, string> = {
  Fir: "First Touch", Fin: "Finishing", Pas: "Passing", Tec: "Technique", Dri: "Dribbling", Cro: "Crossing", Hea: "Heading", Tck: "Tackling", Lon: "Long Shots",
  OtB: "Off The Ball", Tea: "Teamwork", Vis: "Vision", Dec: "Decisions", Ant: "Anticipation", Cmp: "Composure", Cnt: "Concentration", Pos: "Positioning", Fla: "Flair", Bra: "Bravery", Det: "Determination", Wor: "Work Rate",
  Acc: "Acceleration", Pac: "Pace", Sta: "Stamina", Str: "Strength", Agi: "Agility", Bal: "Balance", Jum: "Jumping Reach", Nat: "Natural Fitness",
  Ref: "Reflexes", "1v1": "One On Ones", Cmd: "Command Of Area", Kic: "Kicking", Thr: "Throwing", Han: "Handling", Aer: "Aerial Reach",
};
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
    <nav>{(["tactic", "rankings", "import", "validation", "compare", "settings"] as Tab[]).map((value) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value}{value === "compare" ? ` (${compareIds.length})` : ""}</button>)}{players.length > 0 && <button className="clear" onClick={clearData}>Clear local data</button>}</nav>
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
  return <section className="panel table-panel"><div className="panel-head"><strong>{total.toLocaleString()} ranked matches</strong><span>{total > players.length ? `Showing first ${players.length.toLocaleString()} results` : "Showing all results"}</span></div>{!players.length ? <div className="empty-state">No players match the current filters.</div> : <div className="table-scroll"><table><thead><tr><th>#</th><th>Compare</th>{heads.map(([key, label]) => <th key={key} onClick={() => sort(key as SortKey)}>{label}</th>)}<th>Caps</th><th>Warnings</th></tr></thead><tbody>{players.map((player, index) => { const score = scores.get(player.id)!; return <tr key={player.id} onClick={() => onOpen(player)}><td>{index + 1}</td><td><button className={compareIds.includes(player.id) ? "compare active" : "compare"} onClick={(e) => { e.stopPropagation(); onCompare(player.id); }}>+</button></td><td><strong>{player.name}</strong><small>{player.nationality}</small></td><td>{fmt(player.age, 0)}</td><td>{player.club}</td><td>{player.position}</td><td>{money(player)}</td><td>£{fmt(player.wageK)}k</td><td className={scoreClass(score.roleScore)}>{fmt(score.roleScore)}</td><td>{fmt(score.recruitmentScore)}</td><td>{fmt(score.confidenceScore)}</td><td>{fmt(score.attribute.score)}</td><td>{fmt(score.stats.score)}</td><td>{fmt(score.hidden.score)}</td><td>{fmt(score.position.score)}</td><td>{fmt(score.value.score)}</td><td>{fmt(player.minutes, 0)}</td><td>{fmt(player.averageRating, 2)}</td><td>{score.caps.join(", ") || "-"}</td><td>{score.warnings[0] ?? "-"}</td></tr>; })}</tbody></table></div>}</section>;
}
function Comparison({ players, onExport }: { players: ScoredPlayer[]; onExport: () => void }) {
  const roles = Object.keys(ROLE_CONFIG) as RoleId[];
  return <section className="panel compare-panel"><div className="panel-head"><div><span className="eyebrow">Shortlist decision</span><h2>Player comparison</h2></div><button onClick={onExport}>Export CSV</button></div>{!players.length ? <p>Add up to four players from a role ranking table.</p> : <div className="table-scroll"><table><thead><tr><th>Metric</th>{players.map((player) => <th key={player.id}>{player.name}</th>)}</tr></thead><tbody><tr><td>Club</td>{players.map((p) => <td key={p.id}>{p.club}</td>)}</tr><tr><td>Age</td>{players.map((p) => <td key={p.id}>{p.age}</td>)}</tr>{roles.map((role) => <tr key={role}><td>{ROLE_CONFIG[role].shortName}</td>{players.map((p) => <td key={p.id} className={scoreClass(p.scores[role].roleScore)}>{fmt(p.scores[role].roleScore)}</td>)}</tr>)}</tbody></table></div>}</section>;
}
function Settings({ onExport }: { onExport: () => void }) {
  return <section className="panel settings"><span className="eyebrow">Scoring transparency</span><h2>{PRESET_VERSION}</h2><p>Role Score is pure role fit: 70% attributes, 15% position/foot, 10% hidden/profile and 5% shrunken stats. Recruitment Score adds market value, wage and age/development.</p><button onClick={onExport}>Export full scored dataset CSV</button>{Object.values(ROLE_CONFIG).map((role) => <details key={role.id}><summary><strong>{role.shortName}</strong> · {role.label}</summary><p><b>Attribute weights:</b> {Object.entries(role.attributeWeights).map(([key, weight]) => `${key} ${weight}`).join(", ")}</p><p><b>Positive stats:</b> {Object.entries(role.positiveStatWeights).map(([key, weight]) => `${key} ${weight}`).join(", ")}</p><p><b>Floor penalties:</b> {role.floorPenalties.map((p) => `${p.attribute}<${p.lt}: -${p.minus}`).join(", ") || "None"}</p></details>)}</section>;
}
function PlayerModal({ player, roleId, slot, onClose }: { player: ScoredPlayer; roleId: RoleId; slot: SlotId; onClose: () => void }) {
  const active = scoreForSlot(player, roleId, slot), role = ROLE_CONFIG[roleId];
  const roleWeights = new Set(Object.keys(role.attributeWeights).filter((key) => role.attributeWeights[key] >= 7));
  const bestRole = Object.values(ROLE_CONFIG).map((candidate) => ({ role: candidate, score: player.scores[candidate.id].roleScore })).sort((a, b) => b.score - a.score)[0];
  return <div className="backdrop" onClick={onClose}><aside className="modal fm-profile-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button>
    <section className="fm-profile-top">
      <div className="fm-player-card">
        <div className="profile-logo-stack"><div className="flag-tile">{String(player.nationality ?? "NAT").slice(0, 3).toUpperCase()}</div><div className="club-tile">{player.club ? player.club.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase() : "CLB"}</div></div>
        <div className="profile-photo-slot"><span>{player.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span></div>
        <div className="profile-status-chip">Int</div>
        <div className="profile-name-strip"><strong>{player.name}</strong><span>Role {fmt(active.roleScore)} · Recruitment {fmt(active.recruitmentScore)} · Confidence {fmt(active.confidenceScore)}</span></div>
      </div>
      <div className="fm-info-card"><ProfileLine label="Nationality" value={player.nationality ?? "-"} /><ProfileLine label="Position" value={player.position ?? "-"} /><ProfileLine label="Age" value={player.age ?? "-"} /><ProfileLine label="Wage" value={`£${fmt(player.wageK)}k/w`} splitLabel="Value" splitValue={money(player)} /><ProfileLine label="Role" value={`${slot} · ${role.shortName}`} splitLabel="Best role" splitValue={`${bestRole.role.shortName} ${fmt(bestRole.score)}`} /><ProfileLine label="Minutes" value={fmt(player.minutes)} splitLabel="Status" splitValue={active.warnings.length ? `${active.warnings.length} warning${active.warnings.length === 1 ? "" : "s"}` : "Clear"} /></div>
    </section>
    <div className="fm-tabs">{modalTabs.map((label, index) => <span className={index === 0 ? "active" : ""} key={label}>{label}</span>)}</div>
    <section className="fm-profile-body">
      <div className="fm-position-panel"><h3>Positions</h3><div className="skin-pitch"><span className="pitch-dot dot-st" /><span className="pitch-dot dot-lw" /><span className="pitch-dot dot-rw" /><span className="pitch-dot dot-cm" /></div><h3>Role and duty</h3><div className="fm-role-card"><strong>{role.shortName}</strong><span>{role.label}</span><b className={scoreClass(active.roleScore)}>{fmt(active.roleScore)}</b></div><div className="fm-role-list">{Object.values(ROLE_CONFIG).map((candidate) => <div className="role-bar" key={candidate.id}><span>{candidate.shortName}</span><i><b className={scoreClass(player.scores[candidate.id].roleScore)} style={{ width: `${player.scores[candidate.id].roleScore}%` }} /></i><strong className={scoreClass(player.scores[candidate.id].roleScore)}>{fmt(player.scores[candidate.id].roleScore)}</strong></div>)}</div></div>
      <section className="attribute-panel fm-attributes"><div className="attribute-groups">{ATTRIBUTE_GROUPS.map((group) => {
        const visible = group.keys.filter(([, key]) => player[key] !== undefined);
        if (!visible.length) return null;
        return <div className="attribute-group" key={group.label}><h4>{group.label}</h4>{visible.map(([label, key]) => {
          const value = player[key] as number | undefined, important = roleWeights.has(label);
          return <div className={important ? "attribute-row important" : "attribute-row"} key={label}><span>{ATTRIBUTE_LABELS[label] ?? label}</span><strong className={attrTone(value)}>{value ?? "-"}</strong></div>;
        })}</div>;
      })}</div></section>
    </section>
    <section className="fm-bottom-panels"><div><h3>Strengths</h3><strong>{active.strengths.join(", ") || "No standout exported attributes available."}</strong></div><div><h3>Score breakdown</h3><Breakdown score={active} /></div><div><h3>Scoring notes</h3><p>{active.explanation.join(" ")}</p><p>{[...active.caps, ...active.weaknesses, ...active.warnings].join(", ") || "No major exported-data concerns."}</p></div></section>
  </aside></div>;
}
function ScorePill({ label, value }: { label: string; value: number }) {
  return <div className="score-pill"><span>{label}</span><strong className={scoreClass(value)}>{fmt(value)}</strong></div>;
}
function ProfileLine({ label, value, splitLabel, splitValue }: { label: string; value: string | number; splitLabel?: string; splitValue?: string | number }) {
  return <div className="profile-line"><span>{label}</span><strong>{value}</strong>{splitLabel && <><span>{splitLabel}</span><strong>{splitValue}</strong></>}</div>;
}
function Breakdown({ score }: { score: RoleScore }) { const parts: [string, RoleScore[keyof Pick<RoleScore, "attribute" | "stats" | "hidden" | "position" | "value">]][] = [["Attributes", score.attribute], ["Adjusted Stats", score.stats], ["Hidden/Profile", score.hidden], ["Position/Foot", score.position], ["Value", score.value]]; return <div className="breakdown">{parts.map(([label, item]) => <div key={label}><span>{label}</span><strong>{fmt(item.score)}</strong><small>{item.available}/{item.expected} inputs</small></div>)}</div>; }
