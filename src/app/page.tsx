"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exportCSV, exportHTML } from "../lib/exports";
import { clubLogoUrl, nationLogoUrl, playerFaceUrl } from "../lib/assetResolver";
import { clearCachedDefaultDataset, loadDefaultDataset } from "../lib/defaultDataset";
import type { DefaultDatasetKind } from "../lib/defaultDataset";
import { importFMFiles } from "../lib/fmParser";
import { adjustedNegativeMetric, adjustedPositiveMetric, leagueCoefficient } from "../lib/leagueCoefficients";
import { PRESET_VERSION, ROLE_CONFIG, TACTIC_SLOTS } from "../lib/roleConfig";
import { scoreForSlot, scorePlayers } from "../lib/scoring";
import type { RoleId, RoleScore, ScoredPlayer, SlotId, ValidationReport } from "../lib/types";

type Tab = "tactic" | "rankings" | "datahub" | "shortlist" | "import" | "validation" | "compare" | "instructions" | "settings";
type SortKey = "roleScore" | "legacyRoleScore" | "valueScore" | "dataScore" | "metaScore" | "recommendationScore" | "metaRecommendationScore" | "recruitmentScore" | "confidenceScore" | "attribute" | "stats" | "hidden" | "position" | "value" | "age" | "minutes" | "apps" | "goals" | "assists" | "averageRating";
type SuitabilityFilter = "role-position" | "conversion" | "all";
type PositionFilter = "" | "GK" | "DL" | "DC" | "DR" | "WBL" | "WBR" | "DM" | "ML" | "MC" | "MR" | "AML" | "AMC" | "AMR" | "ST";
type ThemeChoice = "orange" | "blue" | "emerald";
type ScorePartLike = { score?: number; available: number; expected: number };
const APP_VERSION = "v0.2.42-role-fit-calibration-local";
const THEME_STORAGE_KEY = "fm-recruitment-lab-theme";
const SHORTLIST_STORAGE_KEY = "fm-recruitment-lab-shortlist";
const THEME_OPTIONS: { value: ThemeChoice; label: string; description: string }[] = [
  { value: "orange", label: "Classic Orange", description: "The current FM Lab orange accent." },
  { value: "blue", label: "Cool Blue", description: "A colder analyst-style blue accent." },
  { value: "emerald", label: "Emerald Green", description: "A sharper green accent with the same dark skin." },
];
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
const apps = (player: ScoredPlayer) => player.apps ?? (player.minutes ? Math.round(Number(player.minutes) / 90) : undefined);
const goals = (player: ScoredPlayer) => player.goals ?? (player.goals90 !== undefined && player.minutes ? Math.round(Number(player.goals90) * Number(player.minutes) / 90) : undefined);
const assists = (player: ScoredPlayer) => player.assists ?? (player.assists90 !== undefined && player.minutes ? Math.round(Number(player.assists90) * Number(player.minutes) / 90) : undefined);
const tabLabel = (value: Tab) => value === "rankings" ? "Scouting" : value === "datahub" ? "Data Hub" : value === "shortlist" ? "Shortlist" : value;
const POSITION_OPTIONS: { value: PositionFilter; label: string }[] = [
  { value: "", label: "All positions" }, { value: "GK", label: "GK" }, { value: "DL", label: "LB / D (L)" }, { value: "DC", label: "CB / D (C)" }, { value: "DR", label: "RB / D (R)" },
  { value: "WBL", label: "LWB / WB (L)" }, { value: "WBR", label: "RWB / WB (R)" }, { value: "DM", label: "DM" }, { value: "ML", label: "LM / M (L)" }, { value: "MC", label: "CM / M (C)" }, { value: "MR", label: "RM / M (R)" },
  { value: "AML", label: "LW / AM (L)" }, { value: "AMC", label: "AM / AM (C)" }, { value: "AMR", label: "RW / AM (R)" }, { value: "ST", label: "ST" },
];
const roleDisplayName = (role: { label: string; duty: string }) => `${role.label} - ${role.duty}`;
const roleAbbreviation = (role: { shortName: string }) => role.shortName.split("-")[0];
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
type StagBaselinePlayer = { id: string; name: string; club?: string; nationality?: string; division?: string; minutes?: number; rawValue: number; adjustedValue: number; coefficient: number; leagueLabel: string };
type StagBenchmark = { metricKey: string; roleId: RoleId; slot: SlotId; type: "positive" | "penalty"; source: "dataset" | "fixed"; sample: number; minutes: number; benchmark: number; thresholds: number[]; baselinePlayer?: StagBaselinePlayer };
type StagBenchmarkMap = Record<string, StagBenchmark>;
type DataHubCardId = "attacking" | "passing" | "defending" | "value" | "age" | "stag";
type DataHubMetric = { label: string; field: keyof ScoredPlayer | "roleScore" | "recruitmentScore" | "stagScore"; suffix?: string; dp?: number; inverse?: boolean };
type DataHubCardConfig = { id: DataHubCardId; title: string; subtitle: string; description: string; x: DataHubMetric; y: DataHubMetric; minMinutes: number };
type DataHubCandidate = { player: ScoredPlayer; score: RoleScore };
type DataHubPoint = { player: ScoredPlayer; x: number; y: number; roleScore: number; impact: number };
const DATA_HUB_CARDS: DataHubCardConfig[] = [
  { id: "attacking", title: "Attacking Efficiency", subtitle: "Output and shot quality", description: "Find forwards and creators combining regular shots with real end product.", minMinutes: 450, x: { label: "Shots per 90", field: "shots90", dp: 2 }, y: { label: "Goals per 90", field: "goals90", dp: 2 } },
  { id: "passing", title: "Passing", subtitle: "Progression and accuracy", description: "Spot reliable passers who still move the ball forward.", minMinutes: 450, x: { label: "Pass Completion", field: "passCompletion", suffix: "%", dp: 0 }, y: { label: "Progressive Passes per 90", field: "progressivePasses90", dp: 2 } },
  { id: "defending", title: "Defensive Activity", subtitle: "Duels and reading danger", description: "Compare players by defensive actions and interceptions.", minMinutes: 450, x: { label: "Tackles per 90", field: "tackles90", dp: 2 }, y: { label: "Interceptions per 90", field: "interceptions90", dp: 2 } },
  { id: "value", title: "Recruitment Value", subtitle: "Role fit against cost", description: "Highlight players whose role suitability looks strong for their price.", minMinutes: 0, x: { label: "FM Value", field: "valueM", suffix: "m", dp: 1, inverse: true }, y: { label: "Role Score", field: "roleScore", dp: 1 } },
  { id: "age", title: "Age Profile", subtitle: "Current level and development runway", description: "Separate ready-made quality from younger upside.", minMinutes: 0, x: { label: "Age", field: "age", dp: 0, inverse: true }, y: { label: "Recruitment Score", field: "recruitmentScore", dp: 1 } },
  { id: "stag", title: "STAG Output", subtitle: "Adjusted form and reliability", description: "See who combines adjusted performance output with enough minutes to trust it.", minMinutes: 300, x: { label: "Minutes", field: "minutes", dp: 0 }, y: { label: "Adjusted Stats", field: "stagScore", dp: 1 } },
];
const BASELINE_MIN_ROLE_SCORE = 65;
const BASELINE_MIN_QUALIFIED_PLAYERS = 20;
const BASELINE_TOP_ROLE_POOL = 75;
const VOLATILE_BASELINE_METRICS = new Set(["shotConversionPct", "headersWonPct"]);
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
const benchmarkKey = (slot: SlotId, roleId: RoleId, metricKey: string, type: "positive" | "penalty") => `${slot}:${roleId}:${metricKey}:${type}`;
const slotPositionCode = (slot: SlotId) => ({
  GK: "GK",
  LB: "DL",
  LCB: "DC",
  RCB: "DC",
  RB: "DR",
  LDM: "DM",
  RDM: "DM",
  LW: "AML",
  AMC: "AMC",
  RW: "AMR",
  ST: "ST",
})[slot];
const isMobileLikeDevice = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
  const narrowScreen = window.matchMedia?.("(max-width: 820px)").matches;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const lowMemory = typeof memory === "number" && memory <= 4;
  return Boolean((coarsePointer && narrowScreen) || lowMemory);
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
function primaryPositionCodes(position?: string) {
  const firstGroup = String(position ?? "").split(",")[0] ?? "";
  return positionCodes(firstGroup);
}
const matchesPosition = (player: ScoredPlayer, filter: PositionFilter) => !filter || positionCodes(player.position).has(filter);
const slotPrimaryPositionMatches = (player: ScoredPlayer, slot: SlotId) => primaryPositionCodes(player.position).has(slotPositionCode(slot));

export default function Home() {
  const [tab, setTab] = useState<Tab>("import"), [players, setPlayers] = useState<ScoredPlayer[]>([]);
  const [report, setReport] = useState<ValidationReport | null>(null), [error, setError] = useState("");
  const [progress, setProgress] = useState({ message: "", percent: 0 }), [busy, setBusy] = useState(false);
  const [roleId, setRoleId] = useState<RoleId>("af-at"), [slot, setSlot] = useState<SlotId>("ST");
  const [theme, setTheme] = useState<ThemeChoice>("orange");
  const [selected, setSelected] = useState<ScoredPlayer | null>(null), [compareIds, setCompareIds] = useState<string[]>([]), [shortlistIds, setShortlistIds] = useState<string[]>([]);
  const [profileContext, setProfileContext] = useState<{ slot: SlotId; roleId: RoleId }>({ slot: "ST", roleId: "af-at" });
  const [dataHubCard, setDataHubCard] = useState<DataHubCardId>("attacking");
  const [mobileLoadGuard, setMobileLoadGuard] = useState(false);
  const [datasetKind, setDatasetKind] = useState<DefaultDatasetKind>("default");
  const [search, setSearch] = useState(""), [minMinutes, setMinMinutes] = useState(0), [maxAge, setMaxAge] = useState(50);
  const [minAge, setMinAge] = useState(0), [club, setClub] = useState(""), [nation, setNation] = useState(""), [positionFilter, setPositionFilter] = useState<PositionFilter>(""), [foot, setFoot] = useState("");
  const [suitabilityFilter, setSuitabilityFilter] = useState<SuitabilityFilter>("role-position");
  const [maxWage, setMaxWage] = useState(1000), [maxValue, setMaxValue] = useState(500), [minScore, setMinScore] = useState(0);
  const [includeMissingStats, setIncludeMissingStats] = useState(true), [includeMissingHidden, setIncludeMissingHidden] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("recommendationScore"), [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const defaultLoadStarted = useRef(false);

  const rankingScores = useMemo(() => new Map(players.map((player) => [player.id, scoreForSlot(player, roleId, slot)])), [players, roleId, slot]);
  const rankings = useMemo(() => players.filter((player) => {
    const score = rankingScores.get(player.id)!;
    const valuePass = player.transferValueStatus === "not_for_sale" || Number(player.valueM ?? 0) <= maxValue;
      const positionScoreValue = Number(score.position.score ?? 0);
      const positionPass = suitabilityFilter === "all" || (suitabilityFilter === "conversion" ? positionScoreValue >= 45 : positionScoreValue >= 80);
    return `${player.name} ${player.club ?? ""}`.toLowerCase().includes(search.toLowerCase()) &&
      Number(player.minutes ?? 0) >= minMinutes && Number(player.age ?? 0) >= minAge && Number(player.age ?? 0) <= maxAge &&
      String(player.club ?? "").toLowerCase().includes(club.toLowerCase()) && String(player.nationality ?? "").toLowerCase().includes(nation.toLowerCase()) &&
      matchesPosition(player, positionFilter) && `${player.preferredFoot ?? ""} ${player.leftFoot ?? ""} ${player.rightFoot ?? ""}`.toLowerCase().includes(foot.toLowerCase()) &&
      Number(player.wageK ?? 0) <= maxWage && valuePass && positionPass && score.roleScore >= minScore &&
      (includeMissingStats || score.stats.available > 0) && (includeMissingHidden || score.hidden.available > 0);
  }).sort((a, b) => {
    const aScore = rankingScores.get(a.id)!, bScore = rankingScores.get(b.id)!;
    const scoreValue = (score: RoleScore) => ["roleScore", "legacyRoleScore", "valueScore", "dataScore", "metaScore", "recommendationScore", "metaRecommendationScore", "recruitmentScore", "confidenceScore"].includes(sortKey) ? Number(score[sortKey as "roleScore" | "legacyRoleScore" | "valueScore" | "dataScore" | "metaScore" | "recommendationScore" | "metaRecommendationScore" | "recruitmentScore" | "confidenceScore"] ?? 0) : ["attribute", "stats", "hidden", "position", "value"].includes(sortKey) ? Number(score[sortKey as "attribute" | "stats" | "hidden" | "position" | "value"].score ?? 0) : undefined;
    const tableValue = (player: ScoredPlayer) => sortKey === "apps" ? apps(player) : sortKey === "goals" ? goals(player) : sortKey === "assists" ? assists(player) : Number(player[sortKey] ?? 0);
    const aValue = scoreValue(aScore) ?? Number(tableValue(a) ?? 0);
    const bValue = scoreValue(bScore) ?? Number(tableValue(b) ?? 0);
    return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
  }), [players, rankingScores, search, minMinutes, minAge, maxAge, club, nation, positionFilter, foot, suitabilityFilter, maxWage, maxValue, minScore, includeMissingStats, includeMissingHidden, sortKey, sortDirection]);
  const compared = players.filter((player) => compareIds.includes(player.id));
  const shortlisted = shortlistIds.map((id) => players.find((player) => player.id === id)).filter((player): player is ScoredPlayer => Boolean(player));
  const stagBenchmarks = useMemo(() => buildStagBenchmarks(players), [players]);
  const modalPlayers = tab === "shortlist" ? shortlisted : tab === "rankings" ? rankings : [];
  const selectedRankIndex = selected ? modalPlayers.findIndex((player) => player.id === selected.id) : -1;

  useEffect(() => {
    const guarded = isMobileLikeDevice();
    const initialKind: DefaultDatasetKind = guarded ? "mobile" : "default";
    setMobileLoadGuard(guarded);
    setDatasetKind(initialKind);
    if (defaultLoadStarted.current || players.length) return;
    defaultLoadStarted.current = true;
    void loadDefaultPlayers(false, initialKind);
  }, [players.length]);
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "orange" || stored === "blue" || stored === "emerald") setTheme(stored);
    try {
      const storedShortlist = JSON.parse(window.localStorage.getItem(SHORTLIST_STORAGE_KEY) ?? "[]");
      if (Array.isArray(storedShortlist)) setShortlistIds(storedShortlist.filter((value): value is string => typeof value === "string"));
    } catch {
      window.localStorage.removeItem(SHORTLIST_STORAGE_KEY);
    }
  }, []);
  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);
  useEffect(() => {
    window.localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(shortlistIds));
  }, [shortlistIds]);
  useEffect(() => {
    if (!rankings.length || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
    console.table(rankings.slice(0, 20).map((player, index) => {
      const score = rankingScores.get(player.id)!;
      return {
        rank: index + 1,
        player: player.name,
        club: player.club,
        roleScore: score.roleScore,
        valueScore: score.valueScore,
        dataScore: score.dataScore,
        metaScore: score.metaScore,
        recommendationScore: score.recommendationScore,
        metaRecommendationScore: score.metaRecommendationScore,
        legacyRoleScore: score.legacyRoleScore,
        positives: [...score.strengths, ...score.valuePositives].slice(0, 4).join(", "),
        concerns: [...score.weaknesses, ...score.valueConcerns].slice(0, 4).join(", "),
        warnings: score.warnings.slice(0, 3).join(", "),
      };
    }));
  }, [rankings, rankingScores]);

  async function handleFiles(files: File[]) {
    setBusy(true); setError(""); setProgress({ message: "Preparing upload", percent: 0 });
    try {
      const imported = await importFMFiles(files, (message, percent) => setProgress({ message, percent }));
      const scored = scorePlayers(imported.players); setPlayers(scored); setReport(imported.report); setTab("settings");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  async function loadDefaultPlayers(forceRefresh: boolean, kind: DefaultDatasetKind = datasetKind) {
    setDatasetKind(kind);
    setBusy(true); setError(""); setProgress({ message: `Loading ${kind === "mobile" ? "mobile" : "full"} database`, percent: 0 });
    try {
      if (forceRefresh) await clearCachedDefaultDataset(kind);
      const loaded = await loadDefaultDataset((message, percent) => setProgress({ message, percent }), kind);
      const scored = scorePlayers(loaded.players);
      setPlayers(scored); setReport(loaded.report); setTab("rankings");
    } catch (reason) {
      setTab("import");
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setBusy(false); }
  }
  function selectSlot(nextSlot: SlotId, nextRole: RoleId) {
    setSlot(nextSlot);
    setRoleId(nextRole);
    setProfileContext({ slot: nextSlot, roleId: nextRole });
    setSortKey("recommendationScore");
    setSortDirection("desc");
    setSuitabilityFilter("role-position");
    setSelected(null);
    setTab("rankings");
  }
  function openPlayer(player: ScoredPlayer, context = { slot, roleId }) { setProfileContext(context); setSelected(player); }
  function toggleCompare(id: string) { setCompareIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 4 ? [...current, id] : current); }
  function toggleShortlist(id: string) { setShortlistIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function clearData() { setPlayers([]); setReport(null); setCompareIds([]); setShortlistIds([]); setSelected(null); setTab("import"); }
  function sort(next: SortKey) { if (sortKey === next) setSortDirection((value) => value === "desc" ? "asc" : "desc"); else { setSortKey(next); setSortDirection("desc"); } }
  function selectAdjacentPlayer(direction: -1 | 1) {
    if (selectedRankIndex < 0) return;
    const nextPlayer = modalPlayers[selectedRankIndex + direction];
    if (nextPlayer) setSelected(nextPlayer);
  }

  return <main className="shell">
    <header className="hero"><div><span className="eyebrow">FM24 recruitment</span><h1>FM Recruitment Lab</h1><p>Private browser-side scouting from uploaded FM HTML exports. Your file stays on this device.</p></div><div className="hero-stat"><strong>{players.length.toLocaleString()}</strong><span>players loaded</span></div></header>
    <nav><div className="brand-title"><span>Brewerlabs</span> <b>FM</b> <span>Lab</span></div>{(["tactic", "rankings", "datahub", "shortlist", "compare", "instructions", "import", "settings"] as Tab[]).map((value) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{tabLabel(value)}{value === "compare" ? ` (${compareIds.length})` : value === "shortlist" ? ` (${shortlistIds.length})` : ""}</button>)}{players.length > 0 && <button className="clear" onClick={clearData}>Clear local data</button>}</nav>
    {error && <div className="notice error">{error}</div>}

    {tab === "import" && <section className="panel import-panel"><div className="import-hero"><div><span className="eyebrow">Data centre</span><h2>Load recruitment database</h2><p>Use the saved player pool or upload fresh FM24 HTML exports. Everything is parsed and scored in this browser.</p></div><div className="import-loaded"><strong>{players.length.toLocaleString()}</strong><span>players ready</span></div></div>
      {mobileLoadGuard && <div className="notice mobile-guard"><strong>Mobile database</strong><span>Mobile browsers now auto-load the smaller 7,571-player database. Use desktop for the full saved pool, or upload any HTML export here.</span></div>}
      <div className="import-grid"><label className={busy ? "dropzone busy" : "dropzone"}><span className="drop-kicker">HTML export</span><strong>{busy ? "Reading player data..." : "Choose FM HTML files"}</strong><small>Supports large all-player exports and multiple files. Missing columns are reported after import.</small><input type="file" accept=".html,.htm,text/html" multiple disabled={busy} onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} /></label>
        <div className="default-db-actions"><button className="primary import-action" disabled={busy || mobileLoadGuard} onClick={() => loadDefaultPlayers(false, "default")}><span>Full database</span><strong>{mobileLoadGuard ? "Desktop only" : "Load full player pool"}</strong><small>{mobileLoadGuard ? "Use the mobile database on phones to avoid reload loops." : "Full saved scouting dataset from Cloudflare R2."}</small></button><button className="import-action" disabled={busy} onClick={() => loadDefaultPlayers(false, "mobile")}><span>Mobile database</span><strong>Load mobile player pool</strong><small>7,571 players from a trimmed export for phones and quick checks.</small></button><button className="import-action" disabled={busy} onClick={() => loadDefaultPlayers(true, mobileLoadGuard ? "mobile" : datasetKind)}><span>Cloudflare R2</span><strong>Refresh active database</strong><small>Downloads the newest {mobileLoadGuard || datasetKind === "mobile" ? "mobile" : "full"} file and replaces that local cache.</small></button><button className="import-action" disabled={busy} onClick={async () => { await clearCachedDefaultDataset(); setProgress({ message: "Default database caches cleared", percent: 0 }); }}><span>Browser cache</span><strong>Clear cached databases</strong><small>Use this if you want the next load to start clean.</small></button></div></div>
      <div className="import-foot"><div><span>01</span><strong>Export from FM</strong><small>Player search as Web Page / HTML.</small></div><div><span>02</span><strong>Import here</strong><small>Files stay local unless using the default R2 database.</small></div><div><span>03</span><strong>Validate columns</strong><small>The app shows what was detected or missing.</small></div></div>
      {busy && <div className="progress import-progress"><div style={{ width: `${progress.percent}%` }} /><span>{progress.message}: {progress.percent}%</span></div>}
    </section>}

    {tab === "validation" && <Validation report={report} onTactic={() => setTab("tactic")} />}
    {tab === "tactic" && <Tactic onSelect={selectSlot} />}
    {tab === "rankings" && <section className={filtersOpen ? "rank-layout" : "rank-layout filters-collapsed"}><section className="panel filters"><div className="filters-head"><div><span className="eyebrow">{slot}</span><h2>{roleDisplayName(ROLE_CONFIG[roleId])}</h2><p>Default ranking is Recommendation Score. Role Score blends attributes, position/foot, hidden profile and adjusted stats; use Role suitability to hide players who cannot play the selected position.</p></div><button className="filter-toggle" onClick={() => setFiltersOpen((value) => !value)}>{filtersOpen ? "Hide filters" : "Show filters"}</button></div>
      {filtersOpen && <><div className="filter-grid"><label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Player or club" /></label><label>Club<input value={club} onChange={(e) => setClub(e.target.value)} placeholder="Any club" /></label><label>Nation<input value={nation} onChange={(e) => setNation(e.target.value)} placeholder="Any nation" /></label><label>Position<select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value as PositionFilter)}>{POSITION_OPTIONS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}</select></label><label>Role suitability<select value={suitabilityFilter} onChange={(e) => setSuitabilityFilter(e.target.value as SuitabilityFilter)}><option value="role-position">Role position only</option><option value="conversion">Include conversions</option><option value="all">All players</option></select></label><label>Footedness<input value={foot} onChange={(e) => setFoot(e.target.value)} placeholder="left / right / either" /></label><label>Minimum minutes<input type="number" value={minMinutes} onChange={(e) => setMinMinutes(Number(e.target.value))} /></label><label>Minimum age<input type="number" value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} /></label><label>Maximum age<input type="number" value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} /></label><label>Maximum wage £k/w<input type="number" value={maxWage} onChange={(e) => setMaxWage(Number(e.target.value))} /></label><label>Maximum value £m<input type="number" value={maxValue} onChange={(e) => setMaxValue(Number(e.target.value))} /></label><label>Minimum Role Score<input type="number" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} /></label></div>
      <div className="toggles"><label><input type="checkbox" checked={includeMissingStats} onChange={(e) => setIncludeMissingStats(e.target.checked)} /> Include missing stats</label><label><input type="checkbox" checked={includeMissingHidden} onChange={(e) => setIncludeMissingHidden(e.target.checked)} /> Include missing hidden data</label>
      <button onClick={() => exportCSV(`${slot}-${roleId}-rankings.csv`, rankings, rankingScores)}>Export CSV</button><button onClick={() => exportHTML(`${slot}-${roleId}-rankings.html`, rankings, rankingScores)}>Export HTML</button></div></>}</section>
      <RankTable players={rankings.slice(0, 500)} total={rankings.length} scores={rankingScores} compareIds={compareIds} shortlistIds={shortlistIds} sort={sort} onOpen={(player) => openPlayer(player)} onCompare={toggleCompare} onShortlist={toggleShortlist} /></section>}
    {tab === "datahub" && <DataHub players={players} roleId={roleId} slot={slot} activeCardId={dataHubCard} onCardChange={setDataHubCard} onOpen={openPlayer} />}
    {tab === "shortlist" && <Shortlist players={shortlisted} scores={rankingScores} compareIds={compareIds} shortlistIds={shortlistIds} onOpen={(player) => openPlayer(player)} onCompare={toggleCompare} onShortlist={toggleShortlist} onClear={() => setShortlistIds([])} onExport={() => exportCSV("fm-recruitment-shortlist.csv", shortlisted, rankingScores)} />}
    {tab === "compare" && <Comparison players={compared} roleId={roleId} slot={slot} onExport={() => exportCSV("fm-recruitment-comparison.csv", compared, rankingScores)} />}
    {tab === "instructions" && <Instructions />}
    {tab === "settings" && <Settings report={report} theme={theme} benchmarks={stagBenchmarks} onThemeChange={setTheme} onTactic={() => setTab("tactic")} onExport={() => exportCSV("fm-recruitment-full-scored-dataset.csv", players)} />}
    {selected && <PlayerModal player={selected} slot={profileContext.slot} roleId={profileContext.roleId} benchmarks={stagBenchmarks} rankIndex={selectedRankIndex} rankTotal={modalPlayers.length} onPrevious={selectedRankIndex > 0 ? () => selectAdjacentPlayer(-1) : undefined} onNext={selectedRankIndex >= 0 && selectedRankIndex < modalPlayers.length - 1 ? () => selectAdjacentPlayer(1) : undefined} onClose={() => setSelected(null)} />}
    <div className="app-version">{APP_VERSION}</div>
  </main>;
}

function Validation({ report, onTactic }: { report: ValidationReport | null; onTactic: () => void }) {
  if (!report) return <section className="panel empty">Upload an FM HTML file to generate a validation report.</section>;
  return <section className="panel validation"><ValidationSummary report={report} onTactic={onTactic} /></section>;
}
function ValidationSummary({ report, onTactic }: { report: ValidationReport; onTactic: () => void }) {
  return <><span className="eyebrow">Import complete</span><h2>Data validation report</h2><div className="report-grid">{report.messages.map((message) => <div key={message}><strong>{message}</strong></div>)}</div>
    <h3>Files</h3><p>{report.files.join(", ")}</p><h3>Missing useful columns</h3><p>{report.missingUseful.length ? report.missingUseful.join(", ") : "None. Excellent export coverage."}</p>
    <details><summary>Detected columns ({report.detectedColumns.length})</summary><p>{report.detectedColumns.join(", ")}</p></details><button className="primary" onClick={onTactic}>Open role board</button></>;
}
function Tactic({ onSelect }: { onSelect: (slot: SlotId, role: RoleId) => void }) {
  return <section className="panel tactic-wrap"><div className="tactic-head"><div><span className="eyebrow">Role map</span><h2>Balanced FM24 roles</h2></div><p>Click any slot to open scouting.</p></div><div className="tactic-board"><div className="pitch">{TACTIC_SLOTS.map((item) => {
    const role = ROLE_CONFIG[item.roleId];
    return <button key={item.id} className="position" style={{ left: `${item.x}%`, top: `${item.y}%` }} onClick={() => onSelect(item.id, item.roleId)}><strong>{item.id}</strong><span>{roleAbbreviation(role)}</span></button>;
  })}</div><div className="tactic-role-list">{TACTIC_SLOTS.map((item) => {
    const role = ROLE_CONFIG[item.roleId];
    return <button key={item.id} className="tactic-role-card" onClick={() => onSelect(item.id, item.roleId)}><span>{item.id}</span><strong>{roleDisplayName(role)}</strong><small>{role.shortName}</small></button>;
  })}</div></div></section>;
}
function RankTable({ players, total, scores, compareIds, shortlistIds, sort, onOpen, onCompare, onShortlist }: { players: ScoredPlayer[]; total: number; scores: Map<string, RoleScore>; compareIds: string[]; shortlistIds: string[]; sort: (key: SortKey) => void; onOpen: (player: ScoredPlayer) => void; onCompare: (id: string) => void; onShortlist: (id: string) => void }) {
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const heads: [SortKey | "name" | "club" | "position" | "valueM" | "wageK", string][] = [["name", "Player"], ["age", "Age"], ["club", "Club"], ["position", "Position"], ["valueM", "Value"], ["wageK", "Wage"], ["roleScore", "Role Score"], ["valueScore", "Value Score"], ["dataScore", "Data Score"], ["metaScore", "Meta Score"], ["recommendationScore", "Recommendation"], ["metaRecommendationScore", "Meta Rec"], ["position", "Position Score"], ["attribute", "Attribute Score"], ["minutes", "Minutes"], ["apps", "Apps"], ["goals", "Goals"], ["assists", "Assists"], ["averageRating", "Av Rating"]];
  const columnClass = (column: number, key: string) => `${hoveredColumn === column ? "column-hovered" : ""} ${activeCell === key ? "cell-hovered" : ""}`.trim();
  const cellEvents = (column: number, key: string) => ({ className: columnClass(column, key), onMouseEnter: () => { setHoveredColumn(column); setActiveCell(key); } });
  return <section className="panel table-panel"><div className="panel-head"><strong>{total.toLocaleString()} scouting matches</strong><span>{total > players.length ? `Showing first ${players.length.toLocaleString()} results` : "Showing all results"}</span></div>{!players.length ? <div className="empty-state">No players match the current filters.</div> : <div className="table-scroll" onMouseLeave={() => { setHoveredColumn(null); setActiveCell(null); }}><table className="scouting-table"><thead><tr><th className={hoveredColumn === 0 ? "column-hovered" : ""}>#</th><th className={hoveredColumn === 1 ? "column-hovered" : ""}>Compare</th><th className={hoveredColumn === 2 ? "column-hovered" : ""}>Shortlist</th>{heads.map(([key, label], index) => <th key={`${key}-${label}`} className={hoveredColumn === index + 3 ? "column-hovered" : ""} onMouseEnter={() => setHoveredColumn(index + 3)} onClick={() => sort(key as SortKey)}>{label}</th>)}<th className={hoveredColumn === heads.length + 3 ? "column-hovered" : ""}>Warnings</th></tr></thead><tbody>{players.map((player, index) => { const score = scores.get(player.id)!; return <tr key={player.id} onClick={() => onOpen(player)}><td {...cellEvents(0, `${player.id}-rank`)}>{index + 1}</td><td {...cellEvents(1, `${player.id}-compare`)}><button title="Compare player" className={compareIds.includes(player.id) ? "table-action active" : "table-action"} onClick={(e) => { e.stopPropagation(); onCompare(player.id); }}>+</button></td><td {...cellEvents(2, `${player.id}-shortlist`)}><button title="Toggle shortlist" className={shortlistIds.includes(player.id) ? "table-action shortlist active" : "table-action shortlist"} onClick={(e) => { e.stopPropagation(); onShortlist(player.id); }}>★</button></td><td {...cellEvents(3, `${player.id}-name`)}><strong>{player.name}</strong><small>{player.nationality}</small></td><td {...cellEvents(4, `${player.id}-age`)}>{fmt(player.age, 0)}</td><td {...cellEvents(5, `${player.id}-club`)}>{player.club}</td><td {...cellEvents(6, `${player.id}-position`)}>{player.position}</td><td {...cellEvents(7, `${player.id}-value`)}>{money(player)}</td><td {...cellEvents(8, `${player.id}-wage`)}>{compactWage(player.wageK)}</td><td {...cellEvents(9, `${player.id}-role`)} className={`${cellEvents(9, `${player.id}-role`).className} ${scoreClass(score.roleScore)}`}>{fmt(score.roleScore)}</td><td {...cellEvents(10, `${player.id}-value-score`)}>{fmt(score.valueScore)}</td><td {...cellEvents(11, `${player.id}-data-score`)}>{fmt(score.dataScore)}</td><td {...cellEvents(12, `${player.id}-meta-score`)}>{fmt(score.metaScore)}</td><td {...cellEvents(13, `${player.id}-recommendation`)} className={`${cellEvents(13, `${player.id}-recommendation`).className} ${scoreClass(score.recommendationScore)}`}>{fmt(score.recommendationScore)}</td><td {...cellEvents(14, `${player.id}-meta-recommendation`)} className={`${cellEvents(14, `${player.id}-meta-recommendation`).className} ${scoreClass(score.metaRecommendationScore)}`}>{fmt(score.metaRecommendationScore)}</td><td {...cellEvents(15, `${player.id}-position-score`)}>{fmt(score.position.score)}</td><td {...cellEvents(16, `${player.id}-attribute`)}>{fmt(score.attribute.score)}</td><td {...cellEvents(17, `${player.id}-minutes`)}>{fmt(player.minutes, 0)}</td><td {...cellEvents(18, `${player.id}-apps`)}>{fmt(apps(player), 0)}</td><td {...cellEvents(19, `${player.id}-goals`)}>{fmt(goals(player), 0)}</td><td {...cellEvents(20, `${player.id}-assists`)}>{fmt(assists(player), 0)}</td><td {...cellEvents(21, `${player.id}-rating`)}>{fmt(player.averageRating, 2)}</td><td {...cellEvents(22, `${player.id}-warnings`)}>{score.warnings[0] ?? "-"}</td></tr>; })}</tbody></table></div>}</section>;
}
function DataHub({ players, roleId, slot, activeCardId, onCardChange, onOpen }: { players: ScoredPlayer[]; roleId: RoleId; slot: SlotId; activeCardId: DataHubCardId; onCardChange: (id: DataHubCardId) => void; onOpen: (player: ScoredPlayer, context?: { slot: SlotId; roleId: RoleId }) => void }) {
  const [hubSlot, setHubSlot] = useState<SlotId>(slot);
  const [hubRoleId, setHubRoleId] = useState<RoleId>(roleId);
  const [hubMinMinutes, setHubMinMinutes] = useState(450);
  const activeCard = DATA_HUB_CARDS.find((card) => card.id === activeCardId) ?? DATA_HUB_CARDS[0];
  const context = `${hubSlot} · ${roleDisplayName(ROLE_CONFIG[hubRoleId])}`;
  const openInHubContext = (player: ScoredPlayer) => onOpen(player, { slot: hubSlot, roleId: hubRoleId });
  const suitableCandidates = useMemo(() => players.map((player) => {
    const score = scoreForSlot(player, hubRoleId, hubSlot);
    return Number(score.position.score ?? 0) >= 80 ? { player, score } : undefined;
  }).filter((entry): entry is DataHubCandidate => Boolean(entry)), [players, hubRoleId, hubSlot]);
  const cardPoints = useMemo(() => Object.fromEntries(DATA_HUB_CARDS.map((card) => [card.id, buildDataHubPoints(suitableCandidates, card, hubMinMinutes)])) as Record<DataHubCardId, DataHubPoint[]>, [suitableCandidates, hubMinMinutes]);
  const points = cardPoints[activeCard.id] ?? [];
  const leaders = [...points].sort((a, b) => b.impact - a.impact).slice(0, 6);

  return <section className="datahub">
    <section className="datahub-header"><div><span className="eyebrow">Performance</span><h2>Data Hub</h2><p>Interactive analytics from the loaded FM export. Charts use role-suitable players for the current tactic slot.</p></div><div className="datahub-context"><span>Current view</span><strong>{context}</strong><small>{suitableCandidates.length.toLocaleString()} qualified players</small></div></section>
    <section className="panel datahub-controls"><label>Role / slot<select value={hubSlot} onChange={(event) => { const next = TACTIC_SLOTS.find((item) => item.id === event.target.value) ?? TACTIC_SLOTS[0]; setHubSlot(next.id); setHubRoleId(next.roleId); }}>{TACTIC_SLOTS.map((item) => <option key={item.id} value={item.id}>{item.id} · {roleDisplayName(ROLE_CONFIG[item.roleId])}</option>)}</select></label><label>Minimum minutes<input type="number" min="0" step="90" value={hubMinMinutes} onChange={(event) => setHubMinMinutes(Math.max(0, Number(event.target.value) || 0))} /></label><button type="button" onClick={() => setHubMinMinutes(0)}>All minutes</button><button type="button" onClick={() => setHubMinMinutes(900)}>900+ mins</button></section>
    <section className="datahub-grid">{DATA_HUB_CARDS.map((card) => {
      const previewPoints = cardPoints[card.id] ?? [];
      const preview = [...previewPoints].sort((a, b) => b.impact - a.impact)[0];
      return <button key={card.id} className={activeCard.id === card.id ? "data-card active" : "data-card"} onClick={() => onCardChange(card.id)}><span>{card.title}</span><strong>{preview ? preview.player.name : "-"}</strong><small>{card.subtitle}</small><DataMiniPlot points={previewPoints} /></button>;
    })}</section>
    <section className="datahub-detail">
      <article className="panel data-chart-panel"><div className="data-chart-head"><div><span className="eyebrow">{activeCard.subtitle}</span><h3>{activeCard.title}</h3><p>{activeCard.description}</p></div><div><strong>{points.length.toLocaleString()}</strong><span>{hubMinMinutes.toLocaleString()}+ mins</span></div></div><DataScatterPlot card={activeCard} points={points} onOpen={openInHubContext} /></article>
      <article className="panel data-leaders"><span className="eyebrow">Metric leaders</span><h3>{activeCard.title}</h3>{leaders.length ? leaders.map((point, index) => <button key={point.player.id} onClick={() => openInHubContext(point.player)}><span>{index + 1}</span><strong>{point.player.name}<small>{point.player.club ?? "-"} · {fmt(point.player.minutes, 0)} mins</small></strong><em>{formatDataMetric(point.y, activeCard.y)}</em></button>) : <p className="empty-note">No players have enough exported data for this chart.</p>}</article>
    </section>
  </section>;
}
function buildDataHubPoints(candidates: DataHubCandidate[], card: DataHubCardConfig, minMinutes: number): DataHubPoint[] {
  return candidates.filter(({ player }) => Number(player.minutes ?? 0) >= minMinutes).map(({ player, score }) => {
    const x = dataMetricValue(player, card.x, score), y = dataMetricValue(player, card.y, score);
    if (x === undefined || y === undefined) return undefined;
    const roleScore = score.roleScore;
    const impact = (card.y.inverse ? -y : y) + roleScore / 100;
    return { player, x, y, roleScore, impact };
  }).filter((point): point is DataHubPoint => Boolean(point));
}
function dataMetricValue(player: ScoredPlayer, metric: DataHubMetric, score: RoleScore) {
  if (metric.field === "roleScore") return score.roleScore;
  if (metric.field === "recruitmentScore") return score.recruitmentScore;
  if (metric.field === "stagScore") return score.stats.score;
  const value = player[metric.field];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function formatDataMetric(value: number, metric: DataHubMetric) {
  const shown = value.toFixed(metric.dp ?? 1).replace(/\.0$/, "");
  return metric.suffix === "m" ? `£${shown}M` : `${shown}${metric.suffix ?? ""}`;
}
function chartExtent(values: number[]) {
  if (!values.length) return { min: 0, max: 1 };
  const min = Math.min(...values), max = Math.max(...values);
  if (min === max) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}
function DataScatterPlot({ card, points, onOpen }: { card: DataHubCardConfig; points: DataHubPoint[]; onOpen: (player: ScoredPlayer) => void }) {
  const visiblePoints = points.slice().sort((a, b) => a.roleScore - b.roleScore).slice(-900);
  const leaderId = [...points].sort((a, b) => b.impact - a.impact)[0]?.player.id;
  const xExtent = chartExtent(visiblePoints.map((point) => point.x)), yExtent = chartExtent(visiblePoints.map((point) => point.y));
  const xScale = (value: number) => 48 + ((value - xExtent.min) / (xExtent.max - xExtent.min)) * 604;
  const yScale = (value: number) => 318 - ((value - yExtent.min) / (yExtent.max - yExtent.min)) * 260;
  const avgX = visiblePoints.reduce((sum, point) => sum + point.x, 0) / Math.max(visiblePoints.length, 1), avgY = visiblePoints.reduce((sum, point) => sum + point.y, 0) / Math.max(visiblePoints.length, 1);
  return <div className="scatter-wrap"><svg viewBox="0 0 700 360" role="img" aria-label={`${card.title} scatter chart`}>
    <rect x="0" y="0" width="700" height="360" rx="10" />
    {[0, 1, 2, 3].map((tick) => <g key={tick}><line x1={48 + tick * 151} x2={48 + tick * 151} y1="38" y2="318" /><line x1="48" x2="652" y1={58 + tick * 86} y2={58 + tick * 86} /></g>)}
    <line className="avg-line" x1={xScale(avgX)} x2={xScale(avgX)} y1="38" y2="318" /><line className="avg-line" x1="48" x2="652" y1={yScale(avgY)} y2={yScale(avgY)} />
    <text x="50" y="30">{card.y.label}</text><text x="652" y="342" textAnchor="end">{card.x.label}</text>
    {visiblePoints.map((point) => {
      const isLeader = point.player.id === leaderId;
      return <circle key={point.player.id} className={isLeader ? "leader-dot" : point.roleScore >= 80 ? "elite-dot" : point.roleScore >= 65 ? "good-dot" : ""} cx={xScale(point.x)} cy={yScale(point.y)} r={isLeader ? 7 : point.roleScore >= 80 ? 5 : 4} onClick={() => onOpen(point.player)}>
      <title>{`${point.player.name} · ${point.player.club ?? "-"}\n${card.x.label}: ${formatDataMetric(point.x, card.x)}\n${card.y.label}: ${formatDataMetric(point.y, card.y)}\nRole Score: ${fmt(point.roleScore)}`}</title>
    </circle>;
    })}
  </svg><div className="scatter-meta"><span>{card.x.inverse ? "Lower/right depends on context" : "Further right is stronger"}</span><span>{card.y.inverse ? "Lower is stronger" : "Higher is stronger"}</span><span>Hover dots for player details, click to open profile.</span></div></div>;
}
function DataMiniPlot({ points }: { points: DataHubPoint[] }) {
  const sample = points.slice().sort((a, b) => b.impact - a.impact).slice(0, 18);
  const leaderId = sample[0]?.player.id;
  const xExtent = chartExtent(sample.map((point) => point.x)), yExtent = chartExtent(sample.map((point) => point.y));
  const xScale = (value: number) => 8 + ((value - xExtent.min) / (xExtent.max - xExtent.min)) * 78;
  const yScale = (value: number) => 48 - ((value - yExtent.min) / (yExtent.max - yExtent.min)) * 38;
  return <svg className="mini-plot" viewBox="0 0 94 58" aria-hidden="true"><line x1="8" x2="86" y1="48" y2="48" /><line x1="8" x2="8" y1="10" y2="48" />{sample.map((point) => <circle key={point.player.id} className={point.player.id === leaderId ? "leader-dot" : ""} cx={xScale(point.x)} cy={yScale(point.y)} r={point.player.id === leaderId ? "3.8" : "2.5"} />)}</svg>;
}
function Shortlist({ players, scores, compareIds, shortlistIds, onOpen, onCompare, onShortlist, onClear, onExport }: { players: ScoredPlayer[]; scores: Map<string, RoleScore>; compareIds: string[]; shortlistIds: string[]; onOpen: (player: ScoredPlayer) => void; onCompare: (id: string) => void; onShortlist: (id: string) => void; onClear: () => void; onExport: () => void }) {
  return <section className="shortlist-layout"><section className="panel shortlist-hero"><div><span className="eyebrow">Transfer desk</span><h2>Shortlist</h2><p>Track targets by cost, contract, club context and current role fit before moving the best options into Compare.</p></div><div className="shortlist-actions"><button disabled={!players.length} onClick={onExport}>Export CSV</button><button disabled={!players.length} onClick={onClear}>Clear shortlist</button></div></section>
    {players.length ? <ShortlistTable players={players} scores={scores} compareIds={compareIds} shortlistIds={shortlistIds} onOpen={onOpen} onCompare={onCompare} onShortlist={onShortlist} /> : <section className="panel empty-state">No shortlisted players yet. Add players with the star button on Scouting.</section>}
  </section>;
}
function ShortlistTable({ players, scores, compareIds, shortlistIds, onOpen, onCompare, onShortlist }: { players: ScoredPlayer[]; scores: Map<string, RoleScore>; compareIds: string[]; shortlistIds: string[]; onOpen: (player: ScoredPlayer) => void; onCompare: (id: string) => void; onShortlist: (id: string) => void }) {
  return <section className="panel table-panel shortlist-table-panel"><div className="panel-head"><strong>{players.length.toLocaleString()} transfer targets</strong><span>Contract, value and league context</span></div><div className="table-scroll shortlist-scroll"><table className="shortlist-table"><thead><tr><th>#</th><th>Compare</th><th>Remove</th><th>Player</th><th>Age</th><th>Position</th><th>Club</th><th>Division</th><th>Based</th><th>Value</th><th>Wage</th><th>Contract</th><th>Expires</th><th>Playing Time</th><th>Role Score</th><th>Recruitment</th><th>Confidence</th><th>Mins</th><th>Av Rat</th><th>Notes</th></tr></thead><tbody>{players.map((player, index) => {
    const score = scores.get(player.id) ?? player.scores["af-at"];
    const notes = [...score.warnings, ...(player.transferValueStatus === "not_for_sale" ? ["Not for sale"] : [])].slice(0, 2);
    return <tr key={player.id} onClick={() => onOpen(player)}><td>{index + 1}</td><td><button title="Compare player" className={compareIds.includes(player.id) ? "table-action active" : "table-action"} onClick={(e) => { e.stopPropagation(); onCompare(player.id); }}>+</button></td><td><button title="Remove from shortlist" className={shortlistIds.includes(player.id) ? "table-action shortlist active" : "table-action shortlist"} onClick={(e) => { e.stopPropagation(); onShortlist(player.id); }}>★</button></td><td><strong>{player.name}</strong><small>{player.nationality}</small></td><td>{fmt(player.age, 0)}</td><td>{player.position}</td><td>{player.club ?? "-"}</td><td>{textValue(player.division)}</td><td>{textValue(player.basedIn ?? player.based)}</td><td>{money(player)}</td><td>{compactWage(player.wageK)}</td><td>{textValue(player.contractType)}</td><td>{textValue(player.contractExpires)}</td><td>{textValue(player.playingTime)}</td><td className={scoreClass(score.roleScore)}>{fmt(score.roleScore)}</td><td>{fmt(score.recruitmentScore)}</td><td>{fmt(score.confidenceScore)}</td><td>{fmt(player.minutes, 0)}</td><td>{fmt(player.averageRating, 2)}</td><td>{notes.join(", ") || "-"}</td></tr>;
  })}</tbody></table></div></section>;
}
function Comparison({ players, roleId, slot, onExport }: { players: ScoredPlayer[]; roleId: RoleId; slot: SlotId; onExport: () => void }) {
  const roles = Object.keys(ROLE_CONFIG) as RoleId[];
  const activeScores = new Map(players.map((player) => [player.id, scoreForSlot(player, roleId, slot)]));
  const activeScore = (player: ScoredPlayer) => activeScores.get(player.id) ?? scoreForSlot(player, roleId, slot);
  const ranked = [...players].sort((a, b) => activeScore(b).roleScore - activeScore(a).roleScore);
  const bestRole = ranked[0], bestValue = [...players].sort((a, b) => activeScore(b).recruitmentScore - activeScore(a).recruitmentScore)[0];
  const metricRows = [
    ["Role Score", (player: ScoredPlayer) => activeScore(player).roleScore],
    ["Recruitment", (player: ScoredPlayer) => activeScore(player).recruitmentScore],
    ["Confidence", (player: ScoredPlayer) => activeScore(player).confidenceScore],
    ["Attribute", (player: ScoredPlayer) => activeScore(player).attribute.score ?? 0],
    ["Adjusted Stats", (player: ScoredPlayer) => activeScore(player).stats.score ?? 0],
  ] as const;
  return <section className="panel compare-panel"><div className="compare-hero"><div><span className="eyebrow">Shortlist decision</span><h2>Player comparison</h2><p>Compare up to four shortlisted players across role fit, signing value, reliability, cost and tactical flexibility.</p></div><button onClick={onExport} disabled={!players.length}>Export CSV</button></div>
    {!players.length ? <div className="compare-empty"><strong>No players selected</strong><span>Add players using the + button in a ranking table. The comparison view works best with two to four players.</span></div> : <>
      <div className="compare-summary"><div><span>Active role</span><strong>{slot} · {roleDisplayName(ROLE_CONFIG[roleId])}</strong><small>Current ranking context</small></div><div><span>Best role fit</span><strong>{bestRole?.name ?? "-"}</strong><small>{bestRole ? `${fmt(activeScore(bestRole).roleScore)} Role Score` : "-"}</small></div><div><span>Best signing/value</span><strong>{bestValue?.name ?? "-"}</strong><small>{bestValue ? `${fmt(activeScore(bestValue).recruitmentScore)} Recruitment` : "-"}</small></div><div><span>Shortlist size</span><strong>{players.length}/4</strong><small>{players.length === 1 ? "Add another player for a real head-to-head." : "Ready for a decision check."}</small></div></div>
      <div className="compare-card-grid">{players.map((player, index) => { const score = activeScore(player), faceUrl = playerFaceUrl(player), clubUrl = clubLogoUrl(player), nationUrl = nationLogoUrl(player); return <article className="compare-player-card" key={player.id}><div className="compare-card-rank">#{index + 1}</div><div className="compare-player-top"><div className="compare-face"><AssetImage src={faceUrl} alt={`${player.name} face`} fallback="" /></div><div><h3>{player.name}</h3><p>{player.position}</p><span>{player.club ?? "-"} · {player.nationality ?? "-"}</span></div><div className="compare-logos"><AssetImage src={clubUrl} alt={`${player.club ?? "Club"} logo`} fallback="" /><AssetImage src={nationUrl} alt={`${player.nationality ?? "Nation"} logo`} fallback="" /></div></div><div className="compare-primary-score"><strong className={scoreClass(score.roleScore)}>{fmt(score.roleScore)}</strong><span>Role Score</span></div><div className="compare-facts"><div><span>Age</span><strong>{fmt(player.age, 0)}</strong></div><div><span>Value</span><strong>{money(player)}</strong></div><div><span>Wage</span><strong>{compactWage(player.wageK)}</strong></div><div><span>Mins</span><strong>{fmt(player.minutes, 0)}</strong></div></div><div className="compare-notes">{score.warnings.slice(0, 2).map((warning) => <span key={warning}>{warning}</span>)}{!score.warnings.length && <span className="clear-note">No major warnings</span>}</div></article>; })}</div>
      <div className="compare-section"><h3>Decision scores</h3><div className="compare-bars">{metricRows.map(([label, getValue]) => <div className="compare-metric-row" key={label}><span>{label}</span>{players.map((player) => { const value = getValue(player); return <div className="compare-bar-cell" key={`${player.id}-${label}`}><i><b className={scoreClass(value)} style={{ width: `${clampScore(value)}%` }} /></i><strong className={scoreClass(value)}>{fmt(value)}</strong></div>; })}</div>)}</div></div>
      <div className="compare-section"><h3>Role flexibility</h3><div className="table-scroll"><table className="compare-role-table"><thead><tr><th>Role</th>{players.map((player) => <th key={player.id}>{player.name}</th>)}</tr></thead><tbody>{roles.map((role) => <tr key={role}><td>{roleDisplayName(ROLE_CONFIG[role])}</td>{players.map((player) => { const value = player.scores[role].roleScore; return <td key={player.id} className={scoreClass(value)}><span className="role-chip-score">{fmt(value)}</span></td>; })}</tr>)}</tbody></table></div></div>
    </>}</section>;
}
function Settings({ report, theme, benchmarks, onThemeChange, onTactic, onExport }: { report: ValidationReport | null; theme: ThemeChoice; benchmarks: StagBenchmarkMap; onThemeChange: (theme: ThemeChoice) => void; onTactic: () => void; onExport: () => void }) {
  return <section className="panel settings"><span className="eyebrow">Scoring transparency</span><h2>{PRESET_VERSION}</h2><p>Role Score is pure role fit: 70% attributes, 15% position/foot, 10% hidden/profile and 5% shrunken stats. Recruitment Score adds market value, wage and age/development.</p>
    <section className="settings-block"><div><h3>Theme</h3><p>Choose the accent colour used across tabs, highlights, buttons and score details.</p></div><div className="theme-picker">{THEME_OPTIONS.map((option) => <button key={option.value} type="button" className={theme === option.value ? `theme-option ${option.value} active` : `theme-option ${option.value}`} onClick={() => onThemeChange(option.value)}><span /><strong>{option.label}</strong><small>{option.description}</small></button>)}</div></section>
    <BaselineSettings benchmarks={benchmarks} />
    <button onClick={onExport}>Export full scored dataset CSV</button>{report && <details open><summary><strong>Data validation report</strong></summary><ValidationSummary report={report} onTactic={onTactic} /></details>}{Object.values(ROLE_CONFIG).map((role) => <details key={role.id}><summary><strong>{roleDisplayName(role)}</strong></summary><p><b>Attribute weights:</b> {Object.entries(role.attributeWeights).map(([key, weight]) => `${key} ${weight}`).join(", ")}</p><p><b>Positive stats:</b> {Object.entries(role.positiveStatWeights).map(([key, weight]) => `${key} ${weight}`).join(", ")}</p><p><b>Floor penalties:</b> {role.floorPenalties.map((p) => `${p.attribute}<${p.lt}: -${p.minus}`).join(", ") || "None"}</p></details>)}</section>;
}
function BaselineSettings({ benchmarks }: { benchmarks: StagBenchmarkMap }) {
  const hasDatasetBenchmarks = Object.values(benchmarks).some((benchmark) => benchmark.source === "dataset");
  return <section className="settings-block baseline-settings"><div><h3>STAG baselines</h3><p>See which top primary-position role-fit players are setting the league-adjusted STAG benchmark for each tactic position and metric. Positive metrics are multiplied by league coefficient; negative/error metrics are divided by it.</p></div><div>{!hasDatasetBenchmarks ? <p className="empty-note">Load a player database to calculate dataset baselines. Until then, STAG tiers use fixed fallback targets.</p> : <div className="baseline-role-list">{TACTIC_SLOTS.map((item) => {
    const role = ROLE_CONFIG[item.roleId];
    const metricEntries = [...Object.keys(role.positiveStatWeights).map((metricKey) => [metricKey, "positive"] as const), ...Object.keys(role.negativeStatPenalties).map((metricKey) => [metricKey, "penalty"] as const)];
    const rows = metricEntries.map(([metricKey, type]) => ({ metricKey, type, metric: STAT_TARGETS[metricKey], benchmark: benchmarks[benchmarkKey(item.id, role.id, metricKey, type)] })).filter((row) => row.metric && row.benchmark);
    return <details key={item.id} className="baseline-role"><summary><strong>{item.id} · {roleDisplayName(role)}</strong></summary><div className="table-scroll"><table className="baseline-table"><thead><tr><th>Metric</th><th>Baseline player</th><th>Club</th><th>League</th><th>Coeff</th><th>Raw</th><th>Adjusted</th><th>Elite</th><th>Sample</th><th>Mins</th></tr></thead><tbody>{rows.map((row) => {
      const player = row.benchmark?.baselinePlayer;
      return <tr key={`${item.id}-${row.type}-${row.metricKey}`}><td><strong>{row.metric?.label ?? row.metricKey}</strong><small>{row.type === "penalty" ? "Lower is better" : "Higher is better"}</small></td><td>{player?.name ?? (row.benchmark?.source === "fixed" ? "Fixed fallback" : "-")}<small>{player?.nationality ?? ""}</small></td><td>{player?.club ?? "-"}</td><td>{player?.leagueLabel ?? "-"}</td><td>{player ? player.coefficient.toFixed(2) : "-"}</td><td>{row.metric && player ? formatStatNumber(player.rawValue, row.metric) : "-"}</td><td>{row.metric ? formatStatNumber(player?.adjustedValue ?? row.benchmark?.benchmark ?? 0, row.metric) : "-"}</td><td>{row.metric && row.benchmark ? formatStatNumber(row.benchmark.thresholds[3], row.metric) : "-"}</td><td>{row.benchmark?.source === "dataset" ? row.benchmark.sample.toLocaleString() : "Fallback"}</td><td>{row.benchmark?.source === "dataset" ? `${row.benchmark.minutes}+` : "-"}</td></tr>;
    })}</tbody></table></div></details>;
  })}</div>}</div></section>;
}
function Instructions() {
  const exportColumns = ["Name", "Age", "DOB", "UID", "Club", "Nation", "Position", "Preferred Foot", "Left Foot", "Right Foot", "Height", "Transfer Value", "Wage", "Minutes", "Av Rat", "all visible attributes", "relevant per-90 stats"];
  return <section className="panel instructions-panel"><div className="instructions-hero"><span className="eyebrow">How to use</span><h2>FM Recruitment Lab instructions</h2><p>Use the default database for quick scouting, or export an HTML player search from Football Manager and analyse it privately in your browser.</p></div>
    <div className="instruction-grid">
      <article><span className="step-number">01</span><h3>Use the default database</h3><p>The app will try to load the default R2 database automatically. If it does not, open Import and press Load Default Database. Refresh Default Database downloads the newest R2 version and replaces the browser cache.</p></article>
      <article><span className="step-number">02</span><h3>Build an FM player search</h3><p>In Football Manager, open Scouting or Player Search, expand the search scope as needed, and add the columns you want exported. The app works best when attributes, positions, value, wage, minutes and performance stats are visible.</p></article>
      <article><span className="step-number">03</span><h3>Export HTML from FM</h3><p>With the player list visible, use the FM menu to print/export the current view as a Web Page or HTML file. Save it somewhere easy to find, then upload that .html file in the Import tab.</p></article>
      <article><span className="step-number">04</span><h3>Open scouting</h3><p>Choose a tactic position, then use Best Role Fit for pure football suitability. Best Signing / Value brings cost, wage and age into the decision, but cheap players should not beat elite fits unless their role score is strong.</p></article>
    </div>
    <div className="instruction-section"><h3>Recommended export columns</h3><div className="column-chip-list">{exportColumns.map((item) => <span key={item}>{item}</span>)}</div><p>Missing columns are allowed. Missing attributes are excluded from weighted attribute scoring and shown as warnings rather than treated as zero.</p></div>
    <div className="instruction-split">
      <div><h3>Understanding the scores</h3><ul><li><strong>Role Score</strong> is pure role fit from attributes, position/foot, hidden profile and shrunken stats.</li><li><strong>Recruitment Score</strong> adds market value, wage and age/development for signing decisions.</li><li><strong>Confidence Score</strong> reflects minutes, missing data, hidden/profile availability and position certainty.</li><li><strong>Adjusted Stats</strong> pulls tiny samples back toward 50 so low-minute players do not jump unfairly.</li></ul></div>
      <div><h3>Common workflow</h3><ol><li>Load the default database or upload your latest FM HTML export.</li><li>Open Tactic and choose a role/slot.</li><li>Use Position and Role suitability filters to remove unsuitable players.</li><li>Open a player profile to inspect attributes, score breakdown, STAG stats and warnings.</li><li>Export CSV/HTML when you want to shortlist or compare outside the app.</li></ol></div>
    </div>
    <div className="instruction-section"><h3>Useful notes</h3><p>Not for sale means the club does not want to sell; it is not treated as a missing or zero value. Value ranges use the midpoint for display and scoring. Player faces, club logos and nation logos are loaded from the Cloudflare R2 asset bucket when a UID/path match exists.</p></div>
  </section>;
}
function PlayerModal({ player, roleId, slot, benchmarks, rankIndex, rankTotal, onPrevious, onNext, onClose }: { player: ScoredPlayer; roleId: RoleId; slot: SlotId; benchmarks: StagBenchmarkMap; rankIndex: number; rankTotal: number; onPrevious?: () => void; onNext?: () => void; onClose: () => void }) {
  const [profileTab, setProfileTab] = useState<ModalTab>("Attributes");
  const active = scoreForSlot(player, roleId, slot), role = ROLE_CONFIG[roleId];
  const roleWeights = new Set(Object.keys(role.attributeWeights).filter((key) => role.attributeWeights[key] >= 7));
  const faceUrl = playerFaceUrl(player), clubUrl = clubLogoUrl(player), nationUrl = nationLogoUrl(player);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if ((event.key === "ArrowUp" || event.key === "ArrowLeft") && onPrevious) {
        event.preventDefault();
        onPrevious();
      }
      if ((event.key === "ArrowDown" || event.key === "ArrowRight") && onNext) {
        event.preventDefault();
        onNext();
      }
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPrevious, onNext, onClose]);
  const rankLabel = rankIndex >= 0 ? `${rankIndex + 1} / ${rankTotal.toLocaleString()}` : "-";
  return <div className="backdrop" onClick={onClose}><aside className="modal fm-profile-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button>
    <div className="profile-rank-nav" aria-label="Player ranking navigation"><button type="button" onClick={onPrevious} disabled={!onPrevious} title="Previous ranked player">↑</button><span>{rankLabel}</span><button type="button" onClick={onNext} disabled={!onNext} title="Next ranked player">↓</button></div>
    <section className="fm-profile-top">
      <div className="fm-player-card">
        <div className="profile-logo-stack"><div className="flag-tile"><AssetImage src={nationUrl} alt={`${player.nationality ?? "Nation"} logo`} fallback="" /></div><div className="club-tile"><AssetImage src={clubUrl} alt={`${player.club ?? "Club"} logo`} fallback="" /></div></div>
        <div className="profile-photo-slot"><AssetImage src={faceUrl} alt={`${player.name} face`} fallback="" /></div>
        <div className="profile-status-chip">Int</div>
        <div className="profile-name-strip"><strong>{player.name}</strong></div>
      </div>
      <TopInfoCard player={player} />
    </section>
    <div className="fm-tabs">{modalTabs.map((label) => <button className={profileTab === label ? "active" : ""} key={label} type="button" onClick={() => setProfileTab(label)}>{label}</button>)}</div>
    {profileTab === "Attributes" ? <><section className="fm-profile-body">
      <div className="fm-position-panel"><h3>Role and duty</h3><div className="fm-role-card"><strong>{roleDisplayName(role)}</strong><b className={scoreClass(active.roleScore)}>{fmt(active.roleScore)}</b></div><div className="fm-role-list">{Object.values(ROLE_CONFIG).map((candidate) => <div className="role-bar" key={candidate.id}><span>{roleDisplayName(candidate)}</span><i><b className={scoreClass(player.scores[candidate.id].roleScore)} style={{ width: `${player.scores[candidate.id].roleScore}%` }} /></i><strong className={scoreClass(player.scores[candidate.id].roleScore)}>{fmt(player.scores[candidate.id].roleScore)}</strong></div>)}</div></div>
      <section className="attribute-panel fm-attributes"><div className="attribute-groups">{(isGoalkeeper(player) ? GOALKEEPER_ATTRIBUTE_GROUPS : ATTRIBUTE_GROUPS).map((group) => {
        const visible = group.keys.filter(([, key]) => player[key] !== undefined);
        if (!visible.length) return null;
        return <div className="attribute-group" key={group.label}><h4>{group.label}</h4>{visible.map(([label, key]) => {
          const value = player[key] as number | undefined, important = roleWeights.has(label);
          return <div className={important ? "attribute-row important" : "attribute-row"} key={label}><span>{ATTRIBUTE_LABELS[label] ?? label}</span><strong className={attrTone(value)}>{value ?? "-"}</strong></div>;
        })}</div>;
      })}</div></section>
    </section>
    <section className="fm-bottom-panels"><div><h3>Strengths</h3><StrengthList items={active.strengths} /></div><div><h3>Score breakdown</h3><Breakdown score={active} /></div><div><h3>Weaknesses</h3><WeaknessList score={active} /></div></section></> : <ProfileTabContent tab={profileTab} player={player} score={active} slot={slot} benchmarks={benchmarks} />}
  </aside></div>;
}
function AssetImage({ src, alt, fallback }: { src?: string; alt: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img src={src} alt={alt} onError={() => setFailed(true)} />;
  return fallback ? <span>{fallback}</span> : null;
}
function ProfileTabContent({ tab, player, score, slot, benchmarks }: { tab: Exclude<ModalTab, "Attributes">; player: ScoredPlayer; score: RoleScore; slot: SlotId; benchmarks: StagBenchmarkMap }) {
  if (tab === "Information") return <section className="fm-tab-panel info-tab"><div className="fm-card-block"><h3>Personal Information</h3><InfoGrid rows={[["Full Name", player.name], ["Personality", field(player, "personality")], ["Media Description", field(player, "mediaDescription")], ["Media Handling", field(player, "mediaHandling")], ["Preferred Foot", field(player, "preferredFoot")], ["Height", height(player.height)], ["Club", player.club], ["Division", player.division]]} /></div><div className="fm-card-block wide"><h3>Nationalities</h3><InfoGrid rows={[["Nationality", player.nationality], ["Second Nationality", player.secondNationality], ["Based", field(player, "basedIn", "based")], ["Position", player.position], ["UID", player.uid], ["Age", player.age]]} /></div></section>;

  if (tab === "FM Stag Stats") return <StagStats player={player} activeSlot={slot} benchmarks={benchmarks} />;

  if (tab === "Contract Info") return <section className="fm-tab-panel contract-tab"><div className="fm-card-block"><h3>{player.club ?? "Current Club"}</h3><div className="contract-hero"><strong>{compactWage(player.wageK)} per week</strong><span>{money(player)} transfer value</span></div><InfoGrid rows={[["Contract Type", field(player, "contractType") ?? "Not exported"], ["Expires", field(player, "contractExpires") ?? "Not exported"], ["Started", field(player, "contractStarted") ?? "Not exported"], ["Playing Time", field(player, "playingTime") ?? "Not exported"], ["Wage", compactWage(player.wageK)], ["Value", money(player)]]} /></div><div className="fm-card-block"><h3>Bonuses</h3><InfoGrid rows={[["Appearance Fee", field(player, "appearanceFee") ?? "Not exported"], ["Goal Bonus", field(player, "goalBonus") ?? "Not exported"], ["Unused Substitute Fee", field(player, "unusedSubFee") ?? "Not exported"], ["Loyalty Bonus", field(player, "loyaltyBonus") ?? "Not exported"]]} /></div><div className="fm-card-block"><h3>Clauses</h3><InfoGrid rows={[["Release Clause", field(player, "releaseClause") ?? "Not exported"], ["Yearly Wage Rise", field(player, "yearlyWageRise") ?? "Not exported"], ["Extension Option", field(player, "extensionOption") ?? "Not exported"], ["Sell-on Clause", field(player, "sellOnClause") ?? "Not exported"]]} /></div></section>;

  if (tab === "Transfer Status") return <section className="fm-tab-panel transfer-tab"><h3>Interested Clubs</h3><div className="interest-head"><strong>Main Interest</strong><span>Offer Date</span></div><InfoGrid rows={[["Recent Offers", field(player, "recentOffers") ?? "None"], ["Major Interest From Clubs", field(player, "majorInterest") ?? "None"], ["Minor Interest From Clubs", field(player, "minorInterest") ?? "None"], ["Transfer Status", player.transferValueStatus === "not_for_sale" ? "Not for sale" : textValue(player.transferValueStatus)], ["FM Value", money(player)]]} /></section>;

  if (tab === "Medical Report") return <section className="fm-tab-panel medical-tab"><div><h3>Match Load</h3><strong className="green">Light</strong><p>{fmt(player.minutes, 0)} exported minutes.</p><p>Detailed 14-day load is not exported in the uploaded HTML.</p></div><div><h3>Training Load</h3><strong className="green">{field(player, "trainingLoad") ?? "Not exported"}</strong><p>{field(player, "fatigue") ?? "Fatigue column not exported."}</p></div><div><h3>Injury Susceptibility</h3><strong className="yellow">{field(player, "injuryRisk") ?? "Not exported"}</strong><p>{field(player, "injury") ?? "No recurring injury column exported."}</p></div><div><h3>Fitness</h3><strong className="green">{field(player, "condition", "fitness") ?? "Not exported"}</strong><p>{field(player, "morale") ?? "Morale/condition detail not exported."}</p></div></section>;

  return <section className="fm-tab-panel history-tab"><h3>Career Stats</h3><table className="fm-history-table"><thead><tr><th>Year</th><th>Team</th><th>Apps</th><th>Goals</th></tr></thead><tbody><tr><td>Current export</td><td><strong>{player.club ?? "-"}</strong><small>{player.nationality ?? ""}</small></td><td>{fmt(player.minutes ? Math.round(Number(player.minutes) / 90) : undefined, 0)}</td><td>{statValue(player, "goals90", 2)}</td></tr></tbody><tfoot><tr><td>Overall</td><td>Uploaded dataset</td><td>{fmt(player.minutes ? Math.round(Number(player.minutes) / 90) : undefined, 0)}</td><td>{statValue(player, "goals90", 2)}</td></tr></tfoot></table><p className="muted-tab-note">Season-by-season club history needs those history columns in the FM export.</p></section>;
}
function InfoGrid({ rows }: { rows: [string, unknown][] }) {
  return <div className="fm-info-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{textValue(value)}</strong></div>)}</div>;
}
function formatStatMetric(player: ScoredPlayer, metric: { field: string; suffix?: string; dp?: number }) {
  return statValue(player, metric.field, metric.dp ?? 2, metric.suffix ?? "");
}
function formatStatNumber(value: number, metric: { suffix?: string; dp?: number }) {
  return `${value.toFixed(metric.dp ?? 2).replace(/\.00$/, "")}${metric.suffix ?? ""}`;
}
function adjustedMetricValue(value: number | undefined, type: "positive" | "penalty", coefficient: number) {
  if (value === undefined) return undefined;
  return type === "penalty" ? adjustedNegativeMetric(value, coefficient) : adjustedPositiveMetric(value, coefficient);
}
function formatSignedStat(value: number, metric: { suffix?: string; dp?: number }) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatStatNumber(value, metric)}`;
}
function percentile(values: number[], ratio: number) {
  if (!values.length) return undefined;
  const index = Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * ratio)));
  return values[index];
}
function fixedBenchmark(slot: SlotId, roleId: RoleId, metricKey: string, type: "positive" | "penalty", metric: { target: number }): StagBenchmark {
  const ratios = type === "penalty" ? [2.5, 1.75, 1.2, 1] : [0.55, 0.75, 0.9, 1];
  return { metricKey, roleId, slot, type, source: "fixed", sample: 0, minutes: 0, benchmark: metric.target, thresholds: ratios.map((ratio) => metric.target * ratio) };
}
function baselinePercentile(metricKey: string, type: "positive" | "penalty") {
  if (type === "penalty") return 0.1;
  return VOLATILE_BASELINE_METRICS.has(metricKey) ? 0.98 : 0.995;
}
function representativeBaselineEntry<T extends { adjustedValue: number }>(entries: T[], benchmark: number, type: "positive" | "penalty") {
  if (type === "penalty") return entries.find((entry) => entry.adjustedValue >= benchmark) ?? entries[0];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].adjustedValue <= benchmark) return entries[index];
  }
  return entries[entries.length - 1];
}
function buildStagBenchmarks(players: ScoredPlayer[]): StagBenchmarkMap {
  const out: StagBenchmarkMap = {};
  for (const item of TACTIC_SLOTS) {
    const role = ROLE_CONFIG[item.roleId];
    const allSuitableCandidates = players
      .map((candidate) => {
        const roleScore = scoreForSlot(candidate, item.roleId, item.id);
        const nativeSlot = primaryPositionCodes(candidate.position).has(slotPositionCode(item.id));
        return { player: candidate, minutes: Number(candidate.minutes ?? 0), roleScore: roleScore.roleScore, suitable: nativeSlot && Number(roleScore.position.score ?? 0) >= 80 };
      })
      .filter((candidate) => candidate.suitable);
    const qualityCandidates = allSuitableCandidates
      .filter((candidate) => candidate.roleScore >= BASELINE_MIN_ROLE_SCORE)
      .sort((a, b) => b.roleScore - a.roleScore);
    const candidates = qualityCandidates.length >= BASELINE_MIN_QUALIFIED_PLAYERS ? qualityCandidates.slice(0, BASELINE_TOP_ROLE_POOL) : allSuitableCandidates;
    const metricEntries = [...Object.keys(role.positiveStatWeights).map((metricKey) => [metricKey, "positive"] as const), ...Object.keys(role.negativeStatPenalties).map((metricKey) => [metricKey, "penalty"] as const)];
    for (const [metricKey, type] of metricEntries) {
      const metric = STAT_TARGETS[metricKey];
      if (!metric) continue;
      let picked: { entries: { player: ScoredPlayer; rawValue: number; adjustedValue: number; coefficient: number; leagueLabel: string }[]; minutes: number } | undefined;
      for (const minutes of [900, 600, 300, 0]) {
        const entries = candidates
          .filter((candidate) => candidate.minutes >= minutes)
          .map((candidate) => {
            const rawValue = candidate.player[metric.field], league = leagueCoefficient(candidate.player);
            if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) return undefined;
            return {
              player: candidate.player,
              rawValue,
              adjustedValue: type === "penalty" ? adjustedNegativeMetric(rawValue, league.coefficient) : adjustedPositiveMetric(rawValue, league.coefficient),
              coefficient: league.coefficient,
              leagueLabel: league.label,
            };
          })
          .filter((entry): entry is { player: ScoredPlayer; rawValue: number; adjustedValue: number; coefficient: number; leagueLabel: string } => Boolean(entry));
        if (entries.length >= 5 || (minutes === 0 && entries.length)) {
          picked = { entries, minutes };
          break;
        }
      }
      if (!picked) {
        out[benchmarkKey(item.id, item.roleId, metricKey, type)] = fixedBenchmark(item.id, item.roleId, metricKey, type, metric);
        continue;
      }
      const sortedEntries = picked.entries.sort((a, b) => a.adjustedValue - b.adjustedValue);
      const sorted = sortedEntries.map((entry) => entry.adjustedValue);
      const benchmark = type === "penalty" ? (percentile(sorted, baselinePercentile(metricKey, type)) ?? metric.target) : (percentile(sorted, baselinePercentile(metricKey, type)) ?? sorted[sorted.length - 1] ?? metric.target);
      const baselineEntry = representativeBaselineEntry(sortedEntries, benchmark, type);
      const baselinePlayer = baselineEntry ? {
        id: baselineEntry.player.id,
        name: baselineEntry.player.name,
        club: baselineEntry.player.club,
        nationality: baselineEntry.player.nationality,
        division: baselineEntry.player.division,
        minutes: baselineEntry.player.minutes,
        rawValue: baselineEntry.rawValue,
        adjustedValue: baselineEntry.adjustedValue,
        coefficient: baselineEntry.coefficient,
        leagueLabel: baselineEntry.leagueLabel,
      } : undefined;
      if (type === "penalty") {
        const thresholds = [percentile(sorted, 0.75), percentile(sorted, 0.5), percentile(sorted, 0.25), benchmark].map((value) => value ?? metric.target);
        out[benchmarkKey(item.id, item.roleId, metricKey, type)] = { metricKey, roleId: item.roleId, slot: item.id, type, source: "dataset", sample: sorted.length, minutes: picked.minutes, benchmark: thresholds[3], thresholds, baselinePlayer };
      } else {
        out[benchmarkKey(item.id, item.roleId, metricKey, type)] = { metricKey, roleId: item.roleId, slot: item.id, type, source: "dataset", sample: sorted.length, minutes: picked.minutes, benchmark, thresholds: [0.55, 0.75, 0.9, 1].map((ratio) => benchmark * ratio), baselinePlayer };
      }
    }
  }
  return out;
}
function statTierFromThresholds(value: number | undefined, thresholds: number[], type: "positive" | "penalty") {
  if (value === undefined) return { label: "Missing", className: "missing", next: undefined as number | undefined };
  const [low, medium, high, elite] = thresholds;
  if (type === "penalty") {
    if (value <= elite) return { label: "Elite", className: "elite", next: undefined };
    if (value <= high) return { label: "High", className: "good", next: elite };
    if (value <= medium) return { label: "Medium", className: "okay", next: high };
    return { label: "Low", className: "low", next: medium };
  }
  if (value >= elite) return { label: "Elite", className: "elite", next: undefined };
  if (value >= high) return { label: "High", className: "good", next: elite };
  if (value >= medium) return { label: "Medium", className: "okay", next: high };
  return { label: "Low", className: "low", next: medium };
}
function benchmarkNote(benchmark: StagBenchmark | undefined) {
  if (!benchmark || benchmark.source === "fixed") return "Fixed fallback benchmark. Load more role-suitable players with minutes for dataset calibration.";
  return `Dataset benchmark from ${benchmark.sample.toLocaleString()} top primary-position role-fit players, ${benchmark.minutes}+ mins${benchmark.baselinePlayer ? `; baseline player: ${benchmark.baselinePlayer.name} (${benchmark.baselinePlayer.leagueLabel} x${benchmark.baselinePlayer.coefficient.toFixed(2)})` : ""}.`;
}
function StagStats({ player, activeSlot, benchmarks }: { player: ScoredPlayer; activeSlot: SlotId; benchmarks: StagBenchmarkMap }) {
  const [selectedSlot, setSelectedSlot] = useState<SlotId>(activeSlot);
  const tacticSlot = TACTIC_SLOTS.find((item) => item.id === selectedSlot) ?? TACTIC_SLOTS[0];
  const role = ROLE_CONFIG[tacticSlot.roleId], score = scoreForSlot(player, role.id, tacticSlot.id);
  const confidence = minutesConfidence(Number(player.minutes ?? 0));
  const league = leagueCoefficient(player);
  const positiveRows = Object.entries(role.positiveStatWeights).map(([key, weight]) => {
    const metric = STAT_TARGETS[key], rawValue = metric && typeof player[metric.field] === "number" ? player[metric.field] as number : undefined;
    const value = adjustedMetricValue(rawValue, "positive", league.coefficient);
    const benchmark = metric ? benchmarks[benchmarkKey(tacticSlot.id, role.id, key, "positive")] ?? fixedBenchmark(tacticSlot.id, role.id, key, "positive", metric) : undefined;
    const metricScore = value === undefined || !benchmark ? undefined : clampScore(value / benchmark.benchmark * 100);
    const tier = benchmark ? statTierFromThresholds(value, benchmark.thresholds, "positive") : { label: "Missing", className: "missing", next: undefined };
    return { key, label: metric?.label ?? key, metric, weight, value, rawValue, playerValue: metric && value !== undefined ? formatStatNumber(value, metric) : "-", rawPlayerValue: metric && rawValue !== undefined ? `raw ${formatStatNumber(rawValue, metric)} · ${league.label} x${league.coefficient.toFixed(2)}` : "", benchmark, thresholds: benchmark?.thresholds ?? [], score: metricScore, tier, type: "positive" as const };
  });
  const penaltyRows = Object.entries(role.negativeStatPenalties).map(([key, weight]) => {
    const metric = STAT_TARGETS[key], rawValue = metric && typeof player[metric.field] === "number" ? player[metric.field] as number : undefined;
    const value = adjustedMetricValue(rawValue, "penalty", league.coefficient);
    const benchmark = metric ? benchmarks[benchmarkKey(tacticSlot.id, role.id, key, "penalty")] ?? fixedBenchmark(tacticSlot.id, role.id, key, "penalty", metric) : undefined;
    const worst = benchmark?.thresholds[0] ?? metric?.target ?? 1;
    const metricScore = value === undefined || !benchmark ? undefined : clampScore(100 - (value / Math.max(worst, 0.01) * 100));
    const tier = benchmark ? statTierFromThresholds(value, benchmark.thresholds, "penalty") : { label: "Missing", className: "missing", next: undefined };
    return { key, label: metric?.label ?? key, metric, weight, value, rawValue, playerValue: metric && value !== undefined ? formatStatNumber(value, metric) : "-", rawPlayerValue: metric && rawValue !== undefined ? `raw ${formatStatNumber(rawValue, metric)} · ${league.label} x${league.coefficient.toFixed(2)}` : "", benchmark, thresholds: benchmark?.thresholds ?? [], score: metricScore, tier, type: "penalty" as const };
  });
  const rows = [...positiveRows, ...penaltyRows];
  const rowWeights = rows.reduce((sum, row) => row.score === undefined ? sum : sum + row.weight, 0);
  const dynamicRawStag = rowWeights ? rows.reduce((sum, row) => sum + (row.score === undefined ? 0 : row.score * row.weight), 0) / rowWeights : 50;
  const dynamicAdjustedStag = clampScore(50 + ((dynamicRawStag - 50) * confidence));
  return <section className="fm-tab-panel stats-tab"><div className="fm-role-tabs tactic-stag-tabs">{TACTIC_SLOTS.map((item) => <button key={item.id} type="button" className={selectedSlot === item.id ? "active" : ""} onClick={() => setSelectedSlot(item.id)} title={roleDisplayName(ROLE_CONFIG[item.roleId])}><strong>{item.id}</strong><span>{roleAbbreviation(ROLE_CONFIG[item.roleId])}</span></button>)}</div>
    <div className="stag-summary"><ScorePill label="Minutes" value={Number(player.minutes ?? 0)} dp={0} tone={false} /><ScorePill label="Raw STAG" value={dynamicRawStag} /><ScorePill label="Adjusted STAG" value={dynamicAdjustedStag} /><ScorePill label="Minutes confidence" value={confidence * 100} /><ScorePill label="Inputs" value={(score.stats.available / Math.max(score.stats.expected, 1)) * 100} /></div>
    <h3>{tacticSlot.id} · {roleDisplayName(role)} performance model</h3>
    <div className="stag-table-scroll"><table className="fm-stat-table stag-compare-table"><thead><tr><th>Metric</th><th>Weight</th><th>Player</th><th>Low</th><th>Medium</th><th>High</th><th>Elite</th><th>Tier</th><th>Next step</th><th>Score impact</th></tr></thead><tbody>{rows.map((row) => {
      const thresholds = row.thresholds, favourableLabel = row.type === "penalty" ? "Lower is better" : "Higher is better";
      const nextGap = row.metric && row.tier.next !== undefined && row.value !== undefined ? row.type === "penalty" ? row.value - row.tier.next : row.tier.next - row.value : undefined;
      return <tr key={`${row.type}-${row.key}`}><td><strong>{row.label}</strong><small>{favourableLabel}</small></td><td>{(row.weight * 100).toFixed(0)}%</td><td><strong>{row.playerValue}</strong><small>{row.rawPlayerValue}</small></td>{thresholds.map((threshold, index) => <td key={index}>{row.metric ? formatStatNumber(threshold, row.metric) : "-"}</td>)}<td><span className={`stag-tier ${row.tier.className}`}>{row.tier.label}</span></td><td className={nextGap === undefined ? "baseline-delta missing" : "baseline-delta under"}>{nextGap === undefined || !row.metric ? "-" : formatStatNumber(Math.max(0, nextGap), row.metric)}</td><td className={row.type === "penalty" ? "low" : scoreClass(row.score)}>{row.score === undefined ? "Missing" : `${fmt(row.score, 1)}${row.type === "penalty" ? " penalty" : ""}`}</td></tr>;
    })}</tbody></table></div>
    <p className="muted-tab-note">Tiers are calibrated from top primary-position role-fit players in this loaded dataset and league-adjusted before comparison. Positive metrics are multiplied by the league coefficient; negative/error metrics are divided by it. {benchmarkNote(rows[0]?.benchmark)}</p>
  </section>;
}
function ScorePill({ label, value, dp = 1, tone = true }: { label: string; value: number; dp?: number; tone?: boolean }) {
  return <div className="score-pill"><span>{label}</span><strong className={tone ? scoreClass(value) : ""}>{fmt(value, dp)}</strong></div>;
}
function StrengthList({ items }: { items: string[] }) {
  if (!items.length) return <p className="empty-note">No standout exported attributes available.</p>;
  return <ul className="strength-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}
function WeaknessList({ score }: { score: RoleScore }) {
  const items = [...score.weaknesses, ...score.caps, ...score.warnings].filter(Boolean);
  if (!items.length) return <p className="empty-note">No major weaknesses flagged for this role.</p>;
  return <ul className="weakness-list">{items.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul>;
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
  const parts: [string, ScorePartLike, string][] = [
    ["Role Score", { score: score.roleScore, available: score.attribute.available + score.position.available + score.hidden.available + score.stats.available, expected: score.attribute.expected + score.position.expected + score.hidden.expected + score.stats.expected }, "Pure football suitability for the selected role/duty. It blends attributes, position/foot, hidden/profile and adjusted performance stats; age, value and wage are excluded."],
    ["Value Score", { score: score.valueScore, available: score.value.available, expected: score.value.expected }, `Signing context: ${[...score.valuePositives, ...score.valueConcerns].slice(0, 4).join(", ") || "neutral value profile"}.`],
    ["Data Score", score.data, `Evidence confidence from minutes, apps, rating and role stats. ${score.dataNotes.join(" ")}`],
    ["Meta Score", score.meta, score.metaNotes.join(" ")],
    ["Recommendation", { score: score.recommendationScore, available: 3, expected: 3 }, "Priority score for scouting order: 45% Role Score, 35% Value Score and 20% Data Score."],
    ["Meta Rec", { score: score.metaRecommendationScore, available: 4, expected: 4 }, "Experimental FM-match-engine priority: 35% Role Score, 25% Value Score, 15% Data Score and 25% Meta Score."],
    ["Attributes", score.attribute, "Raw FM attributes normalised to 0-100 using this role's direct 0-10 weights. This is the main role-fit driver."],
    ["Adjusted Stats", score.stats, `Performance output after minutes shrinkage. Raw stats are ${fmt(score.rawStats)} before low-sample adjustment, so tiny samples are pulled back towards 50.`],
    ["Hidden/Profile", score.hidden, "Consistency, professionalism, important matches and similar profile data where exported. Missing hidden data is treated neutrally and lowers confidence."],
    ["Position/Foot", score.position, "Position familiarity plus the role's footedness rules. Natural role positions score highest; conversions and wrong-sided feet are capped or reduced."],
    ["Attribute Only", { score: score.legacyRoleScore, available: score.attribute.available, expected: score.attribute.expected }, "Attribute-only role fit before position/foot, hidden/profile and adjusted stats are blended into Role Score."],
  ];
  const [selected, setSelected] = useState(parts[0][0]);
  const active = parts.find(([label]) => label === selected) ?? parts[0];
  return <div className="breakdown-wrap"><div className="breakdown">{parts.map(([label, item]) => <button type="button" className={selected === label ? "breakdown-card active" : "breakdown-card"} key={label} onClick={() => setSelected(label)}><span>{label}</span><strong>{fmt(item.score)}</strong><small>{item.available}/{item.expected} inputs</small></button>)}</div><div className="breakdown-explainer"><strong>{active[0]}</strong><p>{active[2]}</p></div></div>;
}
