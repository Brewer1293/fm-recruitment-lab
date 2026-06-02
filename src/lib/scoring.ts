import { RECRUITMENT_SCORE_WEIGHTS, ROLE_CONFIG, ROLE_SCORE_WEIGHTS } from "./roleConfig";
import type { NormalizedPlayer, RoleConfig, RoleId, RoleScore, ScorePart, ScoredPlayer, SlotId } from "./types";

const clamp = (value: number, low = 0, high = 100) => Math.min(high, Math.max(low, value));
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
  let total = 0, weight = 0, available = 0;
  for (const [key, rawWeight] of Object.entries(config.attributeWeights)) {
    if (rawWeight <= 0) continue;
    const value = attr(player, key);
    if (value === undefined) continue;
    total += clamp(value / 20 * 100) * rawWeight;
    weight += rawWeight;
    available += 1;
  }
  const floorPenalty = Math.min(15, config.floorPenalties.reduce((sum, penalty) => {
    const value = attr(player, penalty.attribute);
    return value !== undefined && value < penalty.lt ? sum + penalty.minus : sum;
  }, 0));
  return part(weight ? clamp(total / weight - floorPenalty) : 50, available, Object.keys(config.attributeWeights).length);
}

function statsScore(player: NormalizedPlayer, config: RoleConfig) {
  let total = 0, weight = 0, available = 0;
  for (const [key, rawWeight] of Object.entries(config.positiveStatWeights)) {
    const target = statTargets[key], value = target ? valueOf(player, target[0]) : undefined;
    if (value === undefined) continue;
    total += clamp(value / target[1] * 100) * rawWeight;
    weight += rawWeight;
    available += 1;
  }
  let raw = weight ? total / weight : 50;
  for (const [key, rawWeight] of Object.entries(config.negativeStatPenalties)) {
    const target = statTargets[key], value = target ? valueOf(player, target[0]) : undefined;
    if (value !== undefined) raw -= clamp(value / target[1] * 100) * rawWeight;
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
  ["GK", "DL", "DR", "DC", "WBL", "WBR", "DM", "MC", "AMC", "AML", "AMR", "ST"].forEach((value) => { if (text.includes(value)) out.add(value); });
  return out;
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
  const wanted = config.positions.some((position) => positions.has(position));
  let score = wanted ? 100 : 0;
  let familiarity = wanted ? "Natural" : "NotSuitable";
  if (!wanted && config.id === "af-at") {
    if (positions.has("AMC")) { score = 55; familiarity = "Untrained"; }
    else if (positions.has("AML") || positions.has("AMR")) { score = 45; familiarity = "PlausibleConversion"; }
  } else if (!wanted && config.id === "if-su" && (positions.has("ST") || positions.has("AMC"))) {
    score = 45; familiarity = "PlausibleConversion";
  } else if (!wanted && config.id === "fb-at" && (positions.has("WBL") || positions.has("WBR"))) {
    score = 95; familiarity = "Accomplished";
  }

  const left = footStrength(player.leftFoot), right = footStrength(player.rightFoot), either = left >= 2 && right >= 2;
  const activeRule = config.id === "fb-at" ? (slot === "RB" ? "FB_AT_RB" : "FB_AT_LB") : config.id === "if-su" ? (slot === "RW" ? "IF_SU_RW" : "IF_SU_LW") : config.footRule;
  let multiplier = 1;
  if (activeRule === "FB_AT_LB") multiplier = either ? 0.99 : left >= 2 ? 1 : left >= 1 ? 0.93 : 0.88;
  else if (activeRule === "FB_AT_RB") multiplier = either ? 0.99 : right >= 2 ? 1 : right >= 1 ? 0.93 : 0.88;
  else if (activeRule === "IF_SU_LW") multiplier = either ? 0.99 : right >= 2 ? 1 : 0.92;
  else if (activeRule === "IF_SU_RW") multiplier = either ? 0.99 : left >= 2 ? 1 : 0.92;
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

function applyCaps(player: NormalizedPlayer, config: RoleConfig, roleScore: number, familiarity: string) {
  let score = roleScore;
  const caps: string[] = [];
  for (const cap of config.scoreCaps ?? []) {
    let triggered = false;
    if (cap.attribute) {
      const value = attr(player, cap.attribute);
      triggered = value !== undefined && value < Number(cap.lt);
    }
    if (cap.all) triggered = cap.all.every((item) => (attr(player, item.attribute) ?? 0) < item.lt);
    if (cap.positionNotAtLeast) triggered = !["Natural", "Accomplished", "Competent"].includes(familiarity);
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

export function scorePlayer(player: NormalizedPlayer, roleId: RoleId, slot?: SlotId): RoleScore {
  const config = ROLE_CONFIG[roleId], attribute = attributeScore(player, config), stats = statsScore(player, config), hidden = hiddenScore(player), position = positionScore(player, config, slot);
  const preCapRole = clamp((attribute.score ?? 50) * ROLE_SCORE_WEIGHTS.attribute + (position.part.score ?? 0) * ROLE_SCORE_WEIGHTS.positionFoot + (hidden.score ?? 50) * ROLE_SCORE_WEIGHTS.hidden + (stats.adjusted.score ?? 50) * ROLE_SCORE_WEIGHTS.stats);
  const capped = applyCaps(player, config, preCapRole, position.familiarity);
  const value = marketValue(player, capped.score), wage = wageScore(player, capped.score), age = ageDevelopment(player, config);
  const recruitment = clamp(capped.score * RECRUITMENT_SCORE_WEIGHTS.role + (value.score ?? 50) * RECRUITMENT_SCORE_WEIGHTS.marketValue + (wage.score ?? 50) * RECRUITMENT_SCORE_WEIGHTS.wage + (age.score ?? 50) * RECRUITMENT_SCORE_WEIGHTS.ageDevelopment);
  const confidence = clamp(minutesConfidence(Number(player.minutes ?? 0)) * 45 + (attribute.available / Math.max(attribute.expected, 1)) * 20 + (stats.adjusted.available / Math.max(stats.adjusted.expected, 1)) * 15 + (hidden.available ? 10 : 0) + ((position.part.score ?? 0) / 100) * 10);
  const prospect = clamp(capped.score * 0.55 + (age.score ?? 50) * 0.25 + (value.score ?? 50) * 0.15 + (wage.score ?? 50) * 0.05);
  const currentForm = clamp(capped.score * 0.65 + (stats.adjusted.score ?? 50) * 0.25 + confidence * 0.1);
  const warnings = config.warnings.filter((warning) => {
    const value = attr(player, warning.attribute);
    return value !== undefined && value < warning.lt;
  }).map((warning) => warning.label);
  if (Number(player.minutes ?? 0) < 300) warnings.push("Under 300 mins: low sample");
  if (!stats.adjusted.available) warnings.push("Missing performance stats");
  if (!hidden.available) warnings.push("Missing hidden/profile data");
  if (player.transferValueStatus === "not_for_sale") warnings.push("Not for sale: value is unavailable, not zero");
  const keyAttributes = Object.entries(config.attributeWeights).map(([key, weight]) => ({ key, value: attr(player, key), weight })).filter((item): item is { key: string; value: number; weight: number } => item.value !== undefined).sort((a, b) => (b.value * b.weight) - (a.value * a.weight));
  return {
    roleId, slot, roleScore: Number(capped.score.toFixed(1)), recruitmentScore: Number(recruitment.toFixed(1)), confidenceScore: Number(confidence.toFixed(1)), prospectScore: Number(prospect.toFixed(1)), currentFormScore: Number(currentForm.toFixed(1)),
    attribute, stats: stats.adjusted, rawStats: Number(stats.raw.toFixed(1)), hidden, position: position.part, value, wage, ageDevelopment: age, caps: capped.caps,
    strengths: keyAttributes.slice(0, 4).map((item) => `${item.key} ${item.value}`),
    weaknesses: keyAttributes.slice(-4).filter((item) => item.value < 12).map((item) => `${item.key} ${item.value}`),
    warnings: [...new Set(warnings)],
    explanation: [`Role Score is pure role suitability.`, `Stats shrink from ${stats.raw.toFixed(1)} to ${(stats.adjusted.score ?? 50).toFixed(1)} using minutes confidence ${minutesConfidence(Number(player.minutes ?? 0)).toFixed(2)}.`, `Value, wage and age affect Recruitment Score only.`],
  };
}

export function scorePlayers(players: NormalizedPlayer[]) {
  return players.map((player) => ({ ...player, scores: Object.fromEntries((Object.keys(ROLE_CONFIG) as RoleId[]).map((roleId) => [roleId, scorePlayer(player, roleId)])) as Record<RoleId, RoleScore> })) as ScoredPlayer[];
}

export function scoreForSlot(player: ScoredPlayer, roleId: RoleId, slot: SlotId) {
  return scorePlayer(player, roleId, slot);
}
