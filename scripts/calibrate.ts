import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { leagueCoefficient } from "../src/lib/leagueCoefficients";
import { ROLE_CONFIG, TACTIC_SLOTS } from "../src/lib/roleConfig";
import { scorePlayer } from "../src/lib/scoring";
import type { NormalizedPlayer, RoleConfig, RoleId, SlotId } from "../src/lib/types";

type DatasetFile = { players?: NormalizedPlayer[] } | NormalizedPlayer[];
type Pair = { x: number; y: number };

const attrMap: Record<string, keyof NormalizedPlayer> = {
  Acc: "acc", Pac: "pac", Sta: "sta", Str: "str", Agi: "agi", Bal: "bal", Jum: "jum", Nat: "nat", Wor: "wor",
  Fin: "fin", Fir: "fir", Pas: "pas", Tec: "tec", Dri: "dri", Cro: "cro", Hea: "hea", Mar: "mar", Tck: "tck",
  Lon: "lon", OtB: "otb", Tea: "tea", Vis: "vis", Dec: "dec", Ant: "ant", Cmp: "cmp", Cnt: "cnt", Pos: "pos",
  Fla: "fla", Bra: "bra", Det: "det", Ref: "ref", "1v1": "oneVOne", Cmd: "cmd", Kic: "kic", Thr: "thr",
  Han: "han", Aer: "aer",
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pearson(values: Pair[]) {
  if (values.length < 3) return undefined;
  const xMean = values.reduce((sum, pair) => sum + pair.x, 0) / values.length;
  const yMean = values.reduce((sum, pair) => sum + pair.y, 0) / values.length;
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;
  for (const pair of values) {
    const x = pair.x - xMean;
    const y = pair.y - yMean;
    numerator += x * y;
    xDenominator += x * x;
    yDenominator += y * y;
  }
  const denominator = Math.sqrt(xDenominator * yDenominator);
  return denominator ? numerator / denominator : undefined;
}

function sortedCorrelationWeights(players: NormalizedPlayer[], config: RoleConfig, slot?: SlotId) {
  const entries = Object.entries(config.attributeWeights)
    .filter(([, weight]) => weight > 0)
    .map(([attribute, weight]) => {
      const key = attrMap[attribute];
      const pairs = players.flatMap((player) => {
        const attributeValue = key ? numberValue(player[key]) : undefined;
        const averageRating = numberValue(player.averageRating);
        if (attributeValue === undefined || averageRating === undefined) return [];
        return [{ x: attributeValue, y: averageRating * leagueCoefficient(player).coefficient }];
      });
      return { attribute, weight, correlation: pearson(pairs), samples: pairs.length };
    })
    .filter((entry) => entry.correlation !== undefined && entry.samples >= 20)
    .sort((a, b) => (b.correlation ?? 0) - (a.correlation ?? 0));

  const averageWeight = entries.reduce((sum, entry) => sum + entry.weight, 0) / Math.max(entries.length, 1);
  const underWeighted = entries.filter((entry) => (entry.correlation ?? 0) >= 0.25 && entry.weight < averageWeight).slice(0, 5);
  const overWeighted = entries.filter((entry) => (entry.correlation ?? 0) <= 0.05 && entry.weight > averageWeight).slice(-5).reverse();
  return { slot, underWeighted, overWeighted };
}

async function loadPlayers(filePath: string) {
  const buffer = await readFile(filePath);
  const text = extname(filePath) === ".gz" ? gunzipSync(buffer).toString("utf8") : buffer.toString("utf8");
  const parsed = JSON.parse(text) as DatasetFile;
  const players = Array.isArray(parsed) ? parsed : parsed.players;
  if (!Array.isArray(players)) throw new Error("Dataset must be an array of players or an object with a players array.");
  return players;
}

function formatCorrelation(value: number | undefined) {
  return value === undefined ? "n/a" : value.toFixed(3);
}

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: npm run calibrate -- /path/to/default-players.json[.gz]");
  const players = await loadPlayers(resolve(input));
  console.log(`Loaded ${players.length.toLocaleString()} players`);

  for (const slot of TACTIC_SLOTS) {
    const config = ROLE_CONFIG[slot.roleId];
    const scored = players
      .map((player) => ({ player, score: scorePlayer(player, slot.roleId, slot.id) }))
      .filter(({ player, score }) => numberValue(player.averageRating) !== undefined && (score.position.score ?? 0) >= 80);
    const pairs = scored.map(({ player, score }) => ({
      x: score.roleScore,
      y: Number(player.averageRating) * leagueCoefficient(player).coefficient,
    }));
    const correlation = pearson(pairs);
    const leaders = scored
      .sort((a, b) => b.score.roleScore - a.score.roleScore)
      .slice(0, 5)
      .map(({ player, score }) => `${player.name} ${score.roleScore.toFixed(1)}`)
      .join(", ");
    const hints = sortedCorrelationWeights(scored.map(({ player }) => player), config, slot.id);

    console.log(`\n${slot.id} ${config.label} - ${config.duty}`);
    console.log(`  samples=${pairs.length} corr(roleScore, league-adjusted AvRat)=${formatCorrelation(correlation)}`);
    console.log(`  leaders=${leaders || "none"}`);
    console.log(`  possible under-weighted attrs=${hints.underWeighted.map((entry) => `${entry.attribute} w${entry.weight}/r${formatCorrelation(entry.correlation)}`).join(", ") || "none"}`);
    console.log(`  possible over-weighted attrs=${hints.overWeighted.map((entry) => `${entry.attribute} w${entry.weight}/r${formatCorrelation(entry.correlation)}`).join(", ") || "none"}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
