import { adjustedNegativeMetric, adjustedPositiveMetric, leagueCoefficient } from "./leagueCoefficients";
import { RECRUITMENT_SCORE_WEIGHTS, ROLE_CONFIG, ROLE_SCORE_WEIGHTS } from "./roleConfig";
import type { NormalizedPlayer, PositionFamiliarity, RoleConfig, RoleId, RoleScore, ScorePart, ScoredPlayer, SlotId } from "./types";

const clamp = (value: number, low = 0, high = 100) => Math.min(high, Math.max(low, value));
export const RECOMMENDATION_SCORE_WEIGHTS = { role: 0.45, value: 0.35, data: 0.20 } as const;
export const META_RECOMMENDATION_SCORE_WEIGHTS = { role: 0.35, value: 0.25, data: 0.15, meta: 0.25 } as const;
export const ATTRIBUTE_SCORE_TUNING = {
  missingAttributeDefault: 9,
  coveragePenaltyStrength: 0.35,
  keyAttributeMinWeight: 8,
  keyAttributeExponent: 1.3,
  keyAttributeFloor: 12,
  weakestLinkPenaltyPerPoint: 1.4,
  maxWeakestLinkPenalty: 14,
} as const;
const DATA_SCORE_THRESHOLDS = { veryLowMinutes: 300, lowMinutes: 900, mediumMinutes: 1800 } as const;
const attrMap: Record<string, string> = { Acc: "acc", Pac: "pac", Sta: "sta", Str: "str", Agi: "agi", Bal: "bal", Jum: "jum", Nat: "nat", Wor: "wor", Fin: "fin", Fir: "fir", Pas: "pas", Tec: "tec", Dri: "dri", Cro: "cro", Hea: "hea", Mar: "mar", Tck: "tck", Lon: "lon", OtB: "otb", Tea: "tea", Vis: "vis", Dec: "dec", Ant: "ant", Cmp: "cmp", Cnt: "cnt", Pos: "pos", Fla: "fla", Bra: "bra", Det: "det", Ref: "ref", "1v1": "oneVOne", Cmd: "cmd", Kic: "kic", Thr: "thr", Han: "han", Aer: "aer" };
const statTargets: Record<string, [string, number]> = { savePct: ["savePercentage", 80], cleanSheets90: ["cleanSheets90", 0.35], passCompletionPct: ["passCompletion", 90], longPassCompletionPct: ["longPassCompletion", 72], avgRating: ["averageRating", 7.6], xA90: ["xa90", 0.35], assists90: ["assists90", 0.45], keyPasses90: ["keyPasses90", 2.7], crossesCompleted90: ["crossesCompleted90", 1.8], dribblesCompleted90: ["dribbles90", 4], tacklesWon90: ["tackles90", 3.2], interceptions90: ["interceptions90", 2.6], progressivePasses90: ["progressivePasses90", 8], headersWonPct: ["headersPct", 75], xG90: ["xg90", 0.65], goals90: ["goals90", 0.75], shots90: ["shots90", 4], shotConversionPct: ["conversionPercentage", 22], errorsLeadingToGoal90: ["errorsLeadingToGoal90", 0.25] };

const valueOf = (player: NormalizedPlayer, key: string) => typeof player[key] === "number" ? player[key] as number : undefined;
const attr = (player: NormalizedPlayer, key: string) => valueOf(player, attrMap[key] ?? key);
const part = (score: number | undefined, available: number, expected: number): ScorePart => ({ score, available, expected });

function minutesConfidence(minutes = 0) {
  if (minutes <= 90) return 0.1;
  if (minutes <= 180) return 0.2;
  if (minutes <= 300) return 0.35;
  if (minutes <= 600) return 0.55;
  if (minutes <= 900) return 0.75;
  if (minutes <= 1500) return 0.9;
  return 1;
}

function attributeScore(player: NormalizedPlayer, config: RoleConfig) {
  let total = 0, weight = 0, available = 0, expected = 0, weakestLinkPenalty = 0;
  for (const [key, rawWeight] of Object.entries(config.attributeWeights)) {
    if (rawWeight <= 0) continue;
    expected += 1;
    const exportedValue = attr(player, key);
    const value = exportedValue ?? ATTRIBUTE_SCORE_TUNING.missingAttributeDefault;
    if (exportedValue !== undefined) available += 1;
    const normalized = clamp(value / 20 * 100);
    const shaped = rawWeight >= ATTRIBUTE_SCORE_TUNING.keyAttributeMinWeight
      ? clamp(100 * ((normalized / 100) ** ATTRIBUTE_SCORE_TUNING.keyAttributeExponent))
      : normalized;
    if (rawWeight >= ATTRIBUTE_SCORE_TUNING.keyAttributeMinWeight && value < ATTRIBUTE_SCORE_TUNING.keyAttributeFloor) {
      weakestLinkPenalty += (ATTRIBUTE_SCORE_TUNING.keyAttributeFloor - value) * ATTRIBUTE_SCORE_TUNING.weakestLinkPenaltyPerPoint;
    }
    total += shaped * rawWeight;
    weight += rawWeight;
  }
  const floorPenalty = Math.min(15, config.floorPenalties.reduce((sum, penalty) => {
    const value = attr(player, penalty.attribute) ?? ATTRIBUTE_SCORE_TUNING.missingAttributeDefault;
    return value < penalty.lt ? sum + penalty.minus : sum;
  }, 0));
  if (!available || !weight) return part(undefined, available, expected);
  const coverage = available / Math.max(expected, 1);
  const coverageFactor = 1 - ((1 - coverage) * ATTRIBUTE_SCORE_TUNING.coveragePenaltyStrength);
  const cappedWeakestPenalty = Math.min(ATTRIBUTE_SCORE_TUNING.maxWeakestLinkPenalty, weakestLinkPenalty);
  return part(clamp((total / weight) * coverageFactor - floorPenalty - cappedWeakestPenalty), available, expected);
}

function weightedAttributeScore(player: NormalizedPlayer, weights: Record<string, number>) {
  let total = 0, weight = 0, available = 0;
  for (const [key, rawWeight] of Object.entries(weights)) {
    if (rawWeight <= 0) continue;
    const value = attr(player, key);
    if (value === undefined) continue;
    total += clamp(value / 20 * 100) * rawWeight;
    weight += rawWeight;
    available += 1;
  }
  return part(weight ? clamp(total / weight) : undefined, available, Object.keys(weights).length);
}

function metaWeights(config: RoleConfig) {
  const outfield: Record<string, number> = {
    Pac: 12, Acc: 11, Jum: 8, pressure: 7, professionalism: 7, Dri: config.id === "af-at" ? 2 : 6, Ant: 5, Det: 5, consistency: 5, Nat: 4, importantMatches: 3, Wor: 3, Cmp: 2,
  };
  const goalkeeper: Record<string, number> = {
    Agi: 10, Aer: 10, Ref: 10, pressure: 7, professionalism: 7, Acc: 5, Pac: 5, consistency: 5, "1v1": 4, Cmd: 3, Han: 3,
  };
  const weights = { ...(config.id === "sk-su" ? goalkeeper : outfield) };
  if (config.id === "fb-at") Object.assign(weights, { Pac: 12, Acc: 11, Jum: 7, Dri: 6, Nat: 5, Wor: 4 });
  if (config.id === "bpd-de") Object.assign(weights, { Pac: 12, Acc: 10, Jum: 10, Cnt: 6, Str: 4, Tck: 2, Mar: 1 });
  if (config.id === "dm-su") Object.assign(weights, { Pac: 12, Acc: 10, Jum: 8, Ant: 6, Cnt: 5, Wor: 4, Tck: 2 });
  if (config.id === "if-su") Object.assign(weights, { Pac: 12, Acc: 11, Dri: 8, Jum: 5, Nat: 5, OtB: 2 });
  if (config.id === "am-at") Object.assign(weights, { Pac: 11, Acc: 10, Dri: 7, Jum: 5, Vis: 2, Tec: 1 });
  if (config.id === "af-at") Object.assign(weights, { Pac: 12, Acc: 11, Jum: 8, Dri: 2, Fin: 2, OtB: 2, Cmp: 2 });
  return weights;
}

function metaScore(player: NormalizedPlayer, config: RoleConfig) {
  const weights = metaWeights(config);
  const base = weightedAttributeScore(player, weights);
  const acc = attr(player, "Acc"), pac = attr(player, "Pac");
  const paceThreshold = config.id === "sk-su" ? 13 : 17;
  const paceGap = Math.min(acc ?? paceThreshold, pac ?? paceThreshold) - paceThreshold;
  const thresholdAdjustment = config.id === "sk-su" ? clamp(paceGap * 2.5, -8, 8) : clamp(paceGap * 6, -28, 12);
  const workRate = attr(player, "Wor");
  const workRateAdjustment = workRate === undefined ? 0 : workRate < 6 ? -5 : workRate <= 8 ? 2 : 0;
  const dirtiness = valueOf(player, "dirtiness");
  const dirtinessAdjustment = dirtiness === undefined ? 0 : dirtiness >= 15 ? -8 : dirtiness >= 11 ? -4 : 0;
  const score = part(base.score === undefined ? undefined : Number(clamp(base.score + thresholdAdjustment + workRateAdjustment + dirtinessAdjustment).toFixed(1)), base.available, base.expected);
  const sorted = Object.entries(weights)
    .map(([key, weight]) => ({ key, weight, value: attr(player, key) }))
    .filter((item): item is { key: string; weight: number; value: number } => item.value !== undefined)
    .sort((a, b) => (b.value * b.weight) - (a.value * a.weight));
  const notes = [
    "FM meta test: applies forum-style match-engine bias, with Pace/Acceleration treated as threshold attributes.",
    `Main drivers: ${sorted.slice(0, 4).map((item) => `${item.key} ${item.value}`).join(", ") || "missing exported meta attributes"}.`,
  ];
  if (config.id !== "sk-su" && ((acc ?? 0) < 17 || (pac ?? 0) < 17)) notes.push("Below 17 pace/acceleration EPL-dominance threshold.");
  if (config.id !== "sk-su" && (acc ?? 0) >= 17 && (pac ?? 0) >= 17) notes.push("Meets 17+ pace/acceleration FM-meta threshold.");
  if ((attr(player, "Jum") ?? 0) >= 16) notes.push("High Jumping Reach adds a major meta boost.");
  if (dirtinessAdjustment < 0) notes.push("High dirtiness risk reduces meta score.");
  if (workRateAdjustment < 0) notes.push("Work Rate below 6 minimum reduces meta score.");
  return { part: score, notes };
}

function statsScore(player: NormalizedPlayer, config: RoleConfig) {
  let total = 0, weight = 0, available = 0;
  const league = leagueCoefficient(player);
  for (const [key, rawWeight] of Object.entries(config.positiveStatWeights)) {
    const target = statTargets[key], value = target ? valueOf(player, target[0]) : undefined;
    if (value === undefined) continue;
    total += clamp(adjustedPositiveMetric(value, league.coefficient) / target[1] * 100) * rawWeight;
    weight += rawWeight;
    available += 1;
  }
  let raw = weight ? total / weight : 50;
  for (const [key, rawWeight] of Object.entries(config.negativeStatPenalties)) {
    const target = statTargets[key], value = target ? valueOf(player, target[0]) : undefined;
    if (value !== undefined) raw -= clamp(adjustedNegativeMetric(value, league.coefficient) / target[1] * 100) * rawWeight;
  }
  raw = clamp(raw);
  const confidence = minutesConfidence(Number(player.minutes ?? 0));
  return { raw, adjusted: part(clamp(50 + ((raw - 50) * confidence)), available, Object.keys(config.positiveStatWeights).length) };
}

function hiddenScore(player: NormalizedPlayer) {
  const hiddenKeys = ["consistency", "professionalism", "importantMatches", "pressure"];
  const values = hiddenKeys.map((key) => valueOf(player, key)).filter((value): value is number => value !== undefined);
  if (!values.length) return part(50, 0, hiddenKeys.length);
  const positive = values.reduce((sum, value) => sum + value / 20 * 100, 0) / values.length;
  const dirtiness = valueOf(player, "dirtiness");
  return part(clamp(positive - (dirtiness ? dirtiness * 1.25 : 0)), values.length, hiddenKeys.length);
}

function parsedPositions(player: NormalizedPlayer) {
  const text = String(player.position ?? "").toUpperCase().replace(/\s+/g, "");
  const out = new Set<string>();
  [["D(L)", "DL"], ["D(R)", "DR"], ["D(C)", "DC"], ["WB(L)", "WBL"], ["WB(R)", "WBR"], ["M(C)", "MC"], ["AM(C)", "AMC"], ["AM(L)", "AML"], ["AM(R)", "AMR"], ["ST(C)", "ST"]].forEach(([needle, value]) => { if (text.includes(needle)) out.add(value); });
  for (const match of text.matchAll(/([A-Z/]+)\(([LRC]+)\)/g)) {
    const groups = match[1].split("/");
    const sides = match[2];
    for (const group of groups) {
      if (group === "D") {
        if (sides.includes("L")) out.add("DL");
        if (sides.includes("R")) out.add("DR");
        if (sides.includes("C")) out.add("DC");
      } else if (group === "WB") {
        if (sides.includes("L")) out.add("WBL");
        if (sides.includes("R")) out.add("WBR");
      } else if (group === "M") {
        if (sides.includes("L")) out.add("ML");
        if (sides.includes("R")) out.add("MR");
        if (sides.includes("C")) out.add("MC");
      } else if (group === "AM") {
        if (sides.includes("L")) out.add("AML");
        if (sides.includes("R")) out.add("AMR");
        if (sides.includes("C")) out.add("AMC");
      } else if (group === "ST" && sides.includes("C")) {
        out.add("ST");
      }
    }
  }
  ["GK", "DL", "DR", "DC", "WBL", "WBR", "DM", "MC", "AMC", "AML", "AMR", "ST"].forEach((value) => { if (text.includes(value)) out.add(value); });
  return out;
}

function primaryParsedPositions(player: NormalizedPlayer) {
  const raw = String(player.position ?? "").split(",")[0] ?? "";
  return parsedPositions({ ...player, position: raw });
}

function footStrength(value: unknown) {
  const text = String(value ?? "").toLowerCase();
  if (/very strong|strong|fairly strong|right only|left only/.test(text)) return 3;
  if (/reasonable|fairly|good|ok/.test(text)) return 2;
  if (/weak/.test(text)) return 1;
  return 0;
}

function positionScore(player: NormalizedPlayer, config: RoleConfig, slot?: SlotId) {
  const positions = parsedPositions(player);
  const primaryPositions = primaryParsedPositions(player);
  const wantedPositions = config.id === "fb-at"
    ? (slot === "RB" ? ["DR"] : ["DL"])
    : config.id === "if-su"
      ? (slot === "RW" ? ["AMR"] : ["AML"])
      : config.positions;
  const wingBackPositions = config.id === "fb-at" ? (slot === "RB" ? ["WBR"] : ["WBL"]) : [];
  const wanted = wantedPositions.some((position) => positions.has(position));
  const primaryWanted = wantedPositions.some((position) => primaryPositions.has(position));
  const centralMidfieldHybrid = positions.has("MC");
  let score = wanted ? 100 : 0;
  let familiarity: PositionFamiliarity = wanted ? "Natural" : "NotSuitable";
  if (config.id === "fb-at" && wanted) {
    const sideWingBack = wingBackPositions.some((position) => positions.has(position));
    const sideMidfield = slot === "RB" ? positions.has("MR") : positions.has("ML");
    const centralHybrid = positions.has("DM") || positions.has("MC") || positions.has("DC");
    if (!sideWingBack && !sideMidfield && centralHybrid) {
      score = 88;
      familiarity = "Competent";
    }
  }
  if (config.id === "bpd-de" && wanted && (!primaryWanted || centralMidfieldHybrid)) {
    score = 72;
    familiarity = "Competent";
  }
  if (!wanted && config.id === "af-at") {
    if (positions.has("AMC")) { score = 55; familiarity = "Untrained"; }
    else if (positions.has("AML") || positions.has("AMR")) { score = 45; familiarity = "PlausibleConversion"; }
  } else if (!wanted && config.id === "if-su" && (positions.has("ST") || positions.has("AMC"))) {
    score = 45; familiarity = "PlausibleConversion";
  } else if (!wanted && config.id === "fb-at" && wingBackPositions.some((position) => positions.has(position))) {
    score = 95; familiarity = "Accomplished";
  }

  const left = footStrength(player.leftFoot), right = footStrength(player.rightFoot), either = left >= 2 && right >= 2;
  const activeRule = config.id === "fb-at" ? (slot === "RB" ? "FB_AT_RB" : "FB_AT_LB") : config.id === "if-su" ? (slot === "RW" ? "IF_SU_RW" : "IF_SU_LW") : config.footRule;
  let multiplier = 1;
  if (activeRule === "FB_AT_LB") multiplier = either ? 1.01 : left >= 2 ? 1 : left >= 1 ? 0.93 : 0.88;
  else if (activeRule === "FB_AT_RB") multiplier = either ? 1.01 : right >= 2 ? 1 : right >= 1 ? 0.93 : 0.88;
  else if (activeRule === "IF_SU_LW") multiplier = either ? 1.01 : right >= 2 ? 1 : right >= 1 ? 0.94 : 0.9;
  else if (activeRule === "IF_SU_RW") multiplier = either ? 1.01 : left >= 2 ? 1 : left >= 1 ? 0.94 : 0.9;
  else if (activeRule === "BPD_SIDE_AWARE" && slot === "LCB") multiplier = either ? 1.01 : left >= 2 ? 1 : left >= 1 ? 0.97 : 0.94;
  else if (activeRule === "BPD_SIDE_AWARE" && slot === "RCB") multiplier = either ? 1.01 : right >= 2 ? 1 : right >= 1 ? 0.97 : 0.94;
  else if (activeRule === "CENTRAL_NEUTRAL_PLUS_TWO_FOOT") multiplier = either ? 1.02 : 1;
  else if (activeRule === "CENTRAL_NEUTRAL" || activeRule === "BPD_SIDE_AWARE") multiplier = either ? 1.01 : 1;
  return { part: part(clamp(score * multiplier), player.position ? 1 : 0, 1), familiarity };
}

function ageDevelopment(player: NormalizedPlayer, config: RoleConfig) {
  const age = Number(player.age ?? 26);
  let factor = 0.88;
  if (config.ageCurveGroup === "goalkeeper") factor = age <= 21 ? 1 : age <= 24 ? 0.97 : age <= 30 ? 0.94 : age <= 34 ? 0.88 : 0.74;
  else if (config.ageCurveGroup === "attacker") factor = age <= 20 ? 1 : age <= 23 ? 0.95 : age <= 26 ? 0.84 : age <= 29 ? 0.68 : 0.48;
  else factor = age <= 20 ? 1 : age <= 23 ? 0.96 : age <= 26 ? 0.88 : age <= 29 ? 0.76 : 0.58;
  return part(clamp(factor * 100), player.age === undefined ? 0 : 1, 1);
}

function marketValue(player: NormalizedPlayer, roleScore: number) {
  if (player.transferValueStatus === "not_for_sale") return part(5, 1, 1);
  if (player.valueM === undefined) return part(50, 0, 1);
  const expected = Math.max(1, (roleScore / 100) ** 2 * 120);
  return part(clamp((expected / (player.valueM + expected * 0.35)) * 100), 1, 1);
}

function wageScore(player: NormalizedPlayer, roleScore: number) {
  if (player.wageK === undefined) return part(50, 0, 1);
  const expected = Math.max(5, (roleScore / 100) ** 2 * 350);
  return part(clamp((expected / (player.wageK + expected * 0.35)) * 100), 1, 1);
}

function contractScore(player: NormalizedPlayer) {
  const text = String(player.contractExpires ?? player.contractType ?? "").toLowerCase();
  if (!text || text === "-") return part(55, 0, 1);
  if (/free|expired|non.contract|non contract|trial/.test(text)) return part(100, 1, 1);
  const year = Number(text.match(/20\d{2}/)?.[0]);
  if (!year) return part(58, 1, 1);
  if (year <= 2025) return part(88, 1, 1);
  if (year <= 2026) return part(76, 1, 1);
  if (year <= 2027) return part(62, 1, 1);
  return part(48, 1, 1);
}

function abilityPotentialScore(player: NormalizedPlayer, roleScore: number) {
  const ca = valueOf(player, "currentAbility"), pa = valueOf(player, "potentialAbility");
  if (ca === undefined && pa === undefined) return part(50, 0, 2);
  const values = [ca, pa].filter((value): value is number => value !== undefined).map((value) => clamp(value / 200 * 100));
  const blended = values.reduce((sum, value) => sum + value, 0) / values.length;
  return part(clamp(blended * 0.7 + roleScore * 0.3), values.length, 2);
}

function resaleScore(player: NormalizedPlayer) {
  const age = Number(player.age ?? 26);
  if (age <= 20) return part(96, player.age === undefined ? 0 : 1, 1);
  if (age <= 23) return part(88, 1, 1);
  if (age <= 26) return part(72, 1, 1);
  if (age <= 29) return part(52, 1, 1);
  if (age <= 32) return part(30, 1, 1);
  return part(18, 1, 1);
}

function valueContextScore(player: NormalizedPlayer, config: RoleConfig, pureRoleScore: number) {
  const league = leagueCoefficient(player);
  const market = marketValue(player, pureRoleScore);
  const wage = wageScore(player, pureRoleScore);
  const age = ageDevelopment(player, config);
  const resale = resaleScore(player);
  const contract = contractScore(player);
  const ability = abilityPotentialScore(player, pureRoleScore);
  const leaguePart = part(clamp(league.coefficient * 100), player.division || player.basedIn || player.based ? 1 : 0, 1);
  const score = clamp(
    (market.score ?? 50) * 0.20 +
    (wage.score ?? 50) * 0.15 +
    (age.score ?? 50) * 0.10 +
    (leaguePart.score ?? 50) * 0.15 +
    (resale.score ?? 50) * 0.15 +
    (ability.score ?? 50) * 0.10 +
    (contract.score ?? 55) * 0.15
  );
  const positives: string[] = [];
  const concerns: string[] = [];
  if ((market.score ?? 50) >= 70) positives.push("reasonable transfer value");
  if ((wage.score ?? 50) >= 70) positives.push("low wage for projected level");
  if ((resale.score ?? 50) >= 75) positives.push("strong resale runway");
  if ((contract.score ?? 55) >= 75) positives.push("favourable contract situation");
  if (league.coefficient >= 0.9) positives.push(`${league.label} context`);
  if (player.transferValueStatus === "not_for_sale") concerns.push("not for sale");
  if ((market.score ?? 50) < 35) concerns.push("expensive against projected level");
  if ((wage.score ?? 50) < 35) concerns.push("high wage risk");
  if ((resale.score ?? 50) < 40) concerns.push("limited resale potential");
  if (league.coefficient < 0.75) concerns.push(`league standard risk: ${league.label}`);
  if (!ability.available) concerns.push("CA/PA not exported");
  return { part: part(Number(score.toFixed(1)), market.available + wage.available + age.available + leaguePart.available + resale.available + ability.available + contract.available, 9), positives, concerns, market, wage, age };
}

function dataEvidenceScore(player: NormalizedPlayer, config: RoleConfig, adjustedStats: ScorePart) {
  const minutes = Number(player.minutes ?? 0);
  const apps = valueOf(player, "apps");
  const goals = valueOf(player, "goals");
  const assists = valueOf(player, "assists");
  const rating = valueOf(player, "averageRating");
  let base = minutes < DATA_SCORE_THRESHOLDS.veryLowMinutes ? 18 : minutes < DATA_SCORE_THRESHOLDS.lowMinutes ? 38 : minutes < DATA_SCORE_THRESHOLDS.mediumMinutes ? 65 : 86;
  if (apps !== undefined) base += Math.min(8, apps / 4);
  if (rating !== undefined) base += clamp((rating - 6.6) * 10, -8, 8);
  if (goals !== undefined || assists !== undefined) base += Math.min(6, Number(goals ?? 0) * 0.5 + Number(assists ?? 0) * 0.75);
  if (adjustedStats.available) base = base * 0.75 + (adjustedStats.score ?? 50) * 0.25;
  const expected = Object.keys(config.positiveStatWeights).length + 4;
  const available = adjustedStats.available + [apps, goals, assists, rating].filter((value) => value !== undefined).length;
  const notes: string[] = [];
  if (minutes < DATA_SCORE_THRESHOLDS.veryLowMinutes) notes.push("Under 300 mins: low sample");
  else if (minutes < DATA_SCORE_THRESHOLDS.lowMinutes) notes.push("300-899 mins: limited sample");
  else if (minutes < DATA_SCORE_THRESHOLDS.mediumMinutes) notes.push("900-1799 mins: medium sample");
  else notes.push("1800+ mins: strong sample");
  if (!adjustedStats.available) notes.push("Missing role performance stats");
  if (rating === undefined) notes.push("Average rating not exported");
  return { part: part(Number(clamp(base).toFixed(1)), available, expected), notes };
}

function applyCaps(player: NormalizedPlayer, config: RoleConfig, roleScore: number, familiarity: string) {
  let score = roleScore;
  const caps: string[] = [];
  const familiarityRank: Record<PositionFamiliarity, number> = { NotSuitable: 0, PlausibleConversion: 1, Untrained: 2, Competent: 3, Accomplished: 4, Natural: 5 };
  for (const cap of config.scoreCaps ?? []) {
    let triggered = false;
    if (cap.attribute) {
      const value = attr(player, cap.attribute);
      triggered = value !== undefined && value < Number(cap.lt);
    }
    if (cap.all) triggered = cap.all.every((item) => (attr(player, item.attribute) ?? 0) < item.lt);
    if (cap.positionNotAtLeast) triggered = (familiarityRank[familiarity as PositionFamiliarity] ?? 0) < familiarityRank[cap.positionNotAtLeast];
    if (cap.noCentralForwardSuitability) {
      const positions = parsedPositions(player);
      triggered = !positions.has("ST") && !positions.has("AMC");
    }
    if (triggered) {
      score = Math.min(score, cap.maxRoleScore);
      caps.push(`Role score capped at ${cap.maxRoleScore}`);
    }
  }
  return { score, caps };
}

function applyAttributeCaps(player: NormalizedPlayer, config: RoleConfig, roleScore: number) {
  let score = roleScore;
  const caps: string[] = [];
  for (const cap of config.scoreCaps ?? []) {
    let triggered = false;
    if (cap.attribute) {
      const value = attr(player, cap.attribute);
      triggered = value !== undefined && value < Number(cap.lt);
    }
    if (cap.all) triggered = cap.all.every((item) => (attr(player, item.attribute) ?? 0) < item.lt);
    if (triggered) {
      score = Math.min(score, cap.maxRoleScore);
      caps.push(`Attribute role score capped at ${cap.maxRoleScore}`);
    }
  }
  return { score, caps };
}

export function scorePlayer(player: NormalizedPlayer, roleId: RoleId, slot?: SlotId): RoleScore {
  const league = leagueCoefficient(player);
  const config = ROLE_CONFIG[roleId], attribute = attributeScore(player, config), stats = statsScore(player, config), hidden = hiddenScore(player), position = positionScore(player, config, slot);
  const hasRoleAttributes = attribute.score !== undefined && attribute.available > 0;
  const attributeOnlyRole = applyAttributeCaps(player, config, hasRoleAttributes ? attribute.score! : 0);
  const preCapRole = hasRoleAttributes ? clamp((attribute.score ?? 0) * ROLE_SCORE_WEIGHTS.attribute + (position.part.score ?? 0) * ROLE_SCORE_WEIGHTS.positionFoot + (hidden.score ?? 50) * ROLE_SCORE_WEIGHTS.hidden + (stats.adjusted.score ?? 50) * ROLE_SCORE_WEIGHTS.stats) : 0;
  const positionValue = position.part.score ?? 0;
  const positionCaps: string[] = [];
  let positionCappedRole = preCapRole;
  if (positionValue <= 0) {
    positionCappedRole = Math.min(positionCappedRole, 45);
    positionCaps.push("Role score capped at 45: not suitable for selected position");
  } else if (positionValue < 60) {
    positionCappedRole = Math.min(positionCappedRole, 55);
    positionCaps.push("Role score capped at 55: weak position fit");
  } else if (positionValue < 80) {
    positionCappedRole = Math.min(positionCappedRole, 65);
    positionCaps.push("Role score capped at 65: conversion position fit");
  }
  const capped = applyCaps(player, config, positionCappedRole, position.familiarity);
  capped.caps.unshift(...positionCaps);
  const valueContext = valueContextScore(player, config, capped.score), dataContext = dataEvidenceScore(player, config, stats.adjusted), metaContext = metaScore(player, config);
  const value = valueContext.market, wage = valueContext.wage, age = valueContext.age;
  const recommendation = clamp(capped.score * RECOMMENDATION_SCORE_WEIGHTS.role + (valueContext.part.score ?? 50) * RECOMMENDATION_SCORE_WEIGHTS.value + (dataContext.part.score ?? 50) * RECOMMENDATION_SCORE_WEIGHTS.data);
  const metaRecommendation = clamp(capped.score * META_RECOMMENDATION_SCORE_WEIGHTS.role + (valueContext.part.score ?? 50) * META_RECOMMENDATION_SCORE_WEIGHTS.value + (dataContext.part.score ?? 50) * META_RECOMMENDATION_SCORE_WEIGHTS.data + (metaContext.part.score ?? 50) * META_RECOMMENDATION_SCORE_WEIGHTS.meta);
  const recruitment = clamp(capped.score * RECRUITMENT_SCORE_WEIGHTS.role + (value.score ?? 50) * RECRUITMENT_SCORE_WEIGHTS.marketValue + (wage.score ?? 50) * RECRUITMENT_SCORE_WEIGHTS.wage + (age.score ?? 50) * RECRUITMENT_SCORE_WEIGHTS.ageDevelopment);
  const confidence = dataContext.part.score ?? 50;
  const prospect = clamp(capped.score * 0.55 + (age.score ?? 50) * 0.25 + (value.score ?? 50) * 0.15 + (wage.score ?? 50) * 0.05);
  const currentForm = clamp(capped.score * 0.65 + (stats.adjusted.score ?? 50) * 0.25 + confidence * 0.1);
  const warnings = config.warnings.filter((warning) => {
    const value = attr(player, warning.attribute);
    return value !== undefined && value < warning.lt;
  }).map((warning) => warning.label);
  if (Number(player.minutes ?? 0) < 300) warnings.push("Under 300 mins: low sample");
  if (!hasRoleAttributes) warnings.push("Missing role attributes: Role Score cannot be calculated");
  if (!stats.adjusted.available) warnings.push("Missing performance stats");
  if (!hidden.available) warnings.push("Missing hidden/profile data");
  if (player.transferValueStatus === "not_for_sale") warnings.push("Not for sale: value is unavailable, not zero");
  const keyAttributes = Object.entries(config.attributeWeights).map(([key, weight]) => ({ key, value: attr(player, key), weight })).filter((item): item is { key: string; value: number; weight: number } => item.value !== undefined).sort((a, b) => (b.value * b.weight) - (a.value * a.weight));
  const allCaps = [...attributeOnlyRole.caps, ...capped.caps];
  return {
    roleId, slot, roleScore: Number(capped.score.toFixed(1)), legacyRoleScore: Number(attributeOnlyRole.score.toFixed(1)), valueScore: Number((valueContext.part.score ?? 50).toFixed(1)), dataScore: Number((dataContext.part.score ?? 50).toFixed(1)), metaScore: Number((metaContext.part.score ?? 0).toFixed(1)), recommendationScore: Number(recommendation.toFixed(1)), metaRecommendationScore: Number(metaRecommendation.toFixed(1)), recruitmentScore: Number(recruitment.toFixed(1)), confidenceScore: Number(confidence.toFixed(1)), prospectScore: Number(prospect.toFixed(1)), currentFormScore: Number(currentForm.toFixed(1)),
    attribute, stats: stats.adjusted, rawStats: Number(stats.raw.toFixed(1)), hidden, position: position.part, value: valueContext.part, wage, ageDevelopment: age, data: dataContext.part, meta: metaContext.part, caps: allCaps,
    strengths: keyAttributes.slice(0, 4).map((item) => `${item.key} ${item.value}`),
    weaknesses: keyAttributes.slice(-4).filter((item) => item.value < 12).map((item) => `${item.key} ${item.value}`),
    valuePositives: valueContext.positives,
    valueConcerns: valueContext.concerns,
    dataNotes: dataContext.notes,
    metaNotes: metaContext.notes,
    warnings: [...new Set(warnings)],
    explanation: [`Role Score blends attributes ${Math.round(ROLE_SCORE_WEIGHTS.attribute * 100)}%, position/foot ${Math.round(ROLE_SCORE_WEIGHTS.positionFoot * 100)}%, hidden/profile ${Math.round(ROLE_SCORE_WEIGHTS.hidden * 100)}% and adjusted stats ${Math.round(ROLE_SCORE_WEIGHTS.stats * 100)}%.`, `Attribute-only role fit is ${attributeOnlyRole.score.toFixed(1)} before position, hidden/profile and adjusted stats.`, `Recommendation Score blends Role ${Math.round(RECOMMENDATION_SCORE_WEIGHTS.role * 100)}%, Value ${Math.round(RECOMMENDATION_SCORE_WEIGHTS.value * 100)}%, Data ${Math.round(RECOMMENDATION_SCORE_WEIGHTS.data * 100)}%.`, `Meta Rec blends Role ${Math.round(META_RECOMMENDATION_SCORE_WEIGHTS.role * 100)}%, Value ${Math.round(META_RECOMMENDATION_SCORE_WEIGHTS.value * 100)}%, Data ${Math.round(META_RECOMMENDATION_SCORE_WEIGHTS.data * 100)}%, Meta ${Math.round(META_RECOMMENDATION_SCORE_WEIGHTS.meta * 100)}%.`, `Performance stats use ${league.label} coefficient ${league.coefficient.toFixed(2)} before minutes shrinkage.`, `Stats shrink from ${stats.raw.toFixed(1)} to ${(stats.adjusted.score ?? 50).toFixed(1)} using minutes confidence ${minutesConfidence(Number(player.minutes ?? 0)).toFixed(2)}.`],
  };
}

export function scorePlayers(players: NormalizedPlayer[]) {
  return players.map((player) => ({ ...player, scores: Object.fromEntries((Object.keys(ROLE_CONFIG) as RoleId[]).map((roleId) => [roleId, scorePlayer(player, roleId)])) as Record<RoleId, RoleScore> })) as ScoredPlayer[];
}

export function scoreForSlot(player: ScoredPlayer, roleId: RoleId, slot: SlotId) {
  return scorePlayer(player, roleId, slot);
}
