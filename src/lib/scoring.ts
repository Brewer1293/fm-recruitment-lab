import { ROLE_CONFIG } from "./roleConfig";
import type { NormalizedPlayer, RoleConfig, RoleId, RoleScore, ScorePart, ScoredPlayer, SlotId, WeightedMetric } from "./types";

const SCORE_WEIGHTS = { attribute: 55, stats: 20, hidden: 10, position: 10, value: 5 };
const clamp = (value: number, low = 0, high = 100) => Math.min(high, Math.max(low, value));
const num = (player: NormalizedPlayer, key: string) => typeof player[key] === "number" ? player[key] as number : undefined;

function weightedPart(player: NormalizedPlayer, metrics: WeightedMetric[], normalizer: (metric: WeightedMetric, value: number) => number): ScorePart {
  const available = metrics.filter((metric) => num(player, metric.key) !== undefined);
  if (!available.length) return { available: 0, expected: metrics.length };
  const weight = available.reduce((sum, metric) => sum + metric.weight, 0);
  const score = available.reduce((sum, metric) => sum + normalizer(metric, num(player, metric.key)!) * metric.weight, 0) / weight;
  return { score: clamp(score), available: available.length, expected: metrics.length };
}

function attributePart(player: NormalizedPlayer, config: RoleConfig) {
  return weightedPart(player, [...config.essential, ...config.core, ...config.secondary], (_, value) => value * 5);
}
function statPart(player: NormalizedPlayer, config: RoleConfig) {
  return weightedPart(player, config.stats, (metric, value) => {
    const key = metric.key.toLowerCase();
    const target = key.includes("rating") ? 7.5 : key.includes("percentage") || key.includes("completion") ? 85 : key.includes("conceded") ? 0.8 : key.includes("clean") ? 0.5 : key.includes("goals90") ? 0.7 : key.includes("xg90") ? 0.6 : 3;
    const score = metric.inverse ? target / Math.max(value, 0.1) : value / target;
    return clamp(score * 80, 0, 100);
  });
}
function hiddenPart(player: NormalizedPlayer, config: RoleConfig) { return weightedPart(player, config.hidden, (_, value) => value * 5); }
function positionPart(player: NormalizedPlayer, config: RoleConfig, slot?: SlotId): ScorePart {
  const position = String(player.position ?? "").toUpperCase();
  const includes = (values: string[]) => values.some((value) => position.includes(value.toUpperCase()));
  let score = includes(config.positions.natural) ? 100 : includes(config.positions.possible) ? 68 : 38;
  if (config.id === "fb-at" && slot) score += footModifier(player, slot);
  if (config.id === "if-su" && slot) score += footModifier(player, slot);
  return { score: clamp(score), available: player.position ? 1 : 0, expected: 1 };
}
function footModifier(player: NormalizedPlayer, slot: SlotId) {
  const foot = `${player.preferredFoot ?? ""} ${player.leftFoot ?? ""} ${player.rightFoot ?? ""}`.toLowerCase();
  const wantsLeft = slot === "LB" || slot === "RW", wantsRight = slot === "RB" || slot === "LW";
  if (foot.includes("either") || (foot.includes("left") && foot.includes("right"))) return 5;
  if (wantsLeft && foot.includes("left")) return 7;
  if (wantsRight && foot.includes("right")) return 7;
  return foot ? -4 : 0;
}
function valuePart(player: NormalizedPlayer): ScorePart {
  if (player.valueM === undefined && player.wageK === undefined) return { available: 0, expected: 2 };
  const valueScore = player.valueM === undefined ? 65 : clamp(100 - player.valueM * 2.5);
  const wageScore = player.wageK === undefined ? 65 : clamp(100 - player.wageK * 1.5);
  return { score: (valueScore + wageScore) / 2, available: Number(player.valueM !== undefined) + Number(player.wageK !== undefined), expected: 2 };
}
function finalScore(parts: [ScorePart, number][]) {
  const available = parts.filter(([part]) => part.score !== undefined);
  const weight = available.reduce((sum, [, partWeight]) => sum + partWeight, 0);
  return weight ? available.reduce((sum, [part, partWeight]) => sum + part.score! * partWeight, 0) / weight : 0;
}

export function scorePlayer(player: NormalizedPlayer, roleId: RoleId, slot?: SlotId): RoleScore {
  const config = ROLE_CONFIG[roleId], attribute = attributePart(player, config), stats = statPart(player, config), hidden = hiddenPart(player, config), position = positionPart(player, config, slot), value = valuePart(player);
  const warnings: string[] = [];
  if (!stats.available) warnings.push("Missing performance data");
  if (!hidden.available) warnings.push("Missing hidden data");
  if (!player.position) warnings.push("Missing position data");
  const penalties = config.penalties.filter((penalty) => {
    const value = num(player, penalty.key); return value !== undefined && ((penalty.below !== undefined && value < penalty.below) || (penalty.above !== undefined && value > penalty.above));
  });
  const total = clamp(finalScore([[attribute, SCORE_WEIGHTS.attribute], [stats, SCORE_WEIGHTS.stats], [hidden, SCORE_WEIGHTS.hidden], [position, SCORE_WEIGHTS.position], [value, SCORE_WEIGHTS.value]]) - penalties.reduce((sum, penalty) => sum + penalty.points, 0));
  const keyAttributes = [...config.essential, ...config.core].map((metric) => ({ key: metric.key, value: num(player, metric.key) })).filter((item): item is { key: string; value: number } => item.value !== undefined).sort((a, b) => b.value - a.value);
  return { roleId, slot, total: Number(total.toFixed(1)), attribute, stats, hidden, position, value, strengths: keyAttributes.slice(0, 3).map((item) => `${item.key.toUpperCase()} ${item.value}`), weaknesses: [...penalties.map((penalty) => penalty.label), ...keyAttributes.slice(-2).filter((item) => item.value < 11).map((item) => `${item.key.toUpperCase()} ${item.value}`)].slice(0, 3), warnings };
}

export function scorePlayers(players: NormalizedPlayer[], slot?: SlotId) {
  return players.map((player) => ({ ...player, scores: Object.fromEntries((Object.keys(ROLE_CONFIG) as RoleId[]).map((roleId) => [roleId, scorePlayer(player, roleId, slot)])) as Record<RoleId, RoleScore> })) as ScoredPlayer[];
}

export function scoreForSlot(player: ScoredPlayer, roleId: RoleId, slot: SlotId) { return scorePlayer(player, roleId, slot); }
