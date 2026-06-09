import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { TACTIC_SLOTS } from "../roleConfig";
import { scorePlayer } from "../scoring";
import type { DefaultDataset } from "../defaultDataset";
import type { NormalizedPlayer, SlotId } from "../types";

const RUN = process.env.RUN_DATASET_BENCHMARK === "1";
const DATASET_URL = "https://assets.brewerlabs.uk/datasets/default-players.json.gz";
const TOP_LIMIT = 20;

const POSITION_BY_SLOT: Record<SlotId, string[]> = {
  GK: ["GK"],
  LB: ["DL", "WBL"],
  LCB: ["DC"],
  RCB: ["DC"],
  RB: ["DR", "WBR"],
  LDM: ["DM", "MC"],
  RDM: ["DM", "MC"],
  LW: ["AML"],
  AMC: ["AMC"],
  RW: ["AMR"],
  ST: ["ST"],
};

type BenchmarkTarget = { name: string; aliases?: string[]; club?: string };
type RankedMatch = { target: BenchmarkTarget; rank?: number; score?: number; club?: string; position?: string };

const BENCHMARKS: Partial<Record<SlotId, BenchmarkTarget[]>> = {
  GK: [
    { name: "Thibaut Courtois", club: "Real Madrid" },
    { name: "Alisson", club: "Liverpool" },
    { name: "Ederson", club: "Man City" },
    { name: "Gianluigi Donnarumma", club: "Paris Saint-Germain" },
    { name: "Mike Maignan", club: "Milan" },
    { name: "Manuel Neuer", club: "Bayern" },
  ],
  LB: [
    { name: "Theo Hernández", club: "Milan" },
    { name: "Alphonso Davies", club: "Bayern" },
    { name: "Andrew Robertson", club: "Liverpool" },
    { name: "João Cancelo", club: "Barcelona" },
    { name: "Destiny Udogie", club: "Tottenham" },
    { name: "Alejandro Balde", club: "Barcelona" },
  ],
  RB: [
    { name: "Achraf Hakimi", club: "Paris Saint-Germain" },
    { name: "Trent Alexander-Arnold", club: "Liverpool" },
    { name: "Reece James", club: "Chelsea" },
    { name: "Kyle Walker", club: "Man City" },
    { name: "Denzel Dumfries", club: "Inter" },
    { name: "Jeremie Frimpong", club: "Bayer Leverkusen" },
  ],
  LCB: [
    { name: "Virgil van Dijk", club: "Liverpool" },
    { name: "Rúben Dias", club: "Man City" },
    { name: "William Saliba", club: "Arsenal" },
    { name: "Alessandro Bastoni", club: "Inter" },
    { name: "Éder Militão", club: "Real Madrid" },
    { name: "Joško Gvardiol", club: "Man City" },
  ],
  RCB: [
    { name: "Virgil van Dijk", club: "Liverpool" },
    { name: "Rúben Dias", club: "Man City" },
    { name: "William Saliba", club: "Arsenal" },
    { name: "Marquinhos", club: "Paris Saint-Germain" },
    { name: "Éder Militão", club: "Real Madrid" },
    { name: "Matthijs de Ligt", club: "Bayern" },
  ],
  LDM: [
    { name: "Rodri", club: "Man City" },
    { name: "Declan Rice", club: "Arsenal" },
    { name: "Aurélien Tchouaméni", club: "Real Madrid" },
    { name: "Joshua Kimmich", club: "Bayern" },
    { name: "Bruno Guimarães", club: "Newcastle" },
    { name: "Moisés Caicedo", club: "Chelsea" },
  ],
  RDM: [
    { name: "Rodri", club: "Man City" },
    { name: "Declan Rice", club: "Arsenal" },
    { name: "Aurélien Tchouaméni", club: "Real Madrid" },
    { name: "Joshua Kimmich", club: "Bayern" },
    { name: "Bruno Guimarães", club: "Newcastle" },
    { name: "Moisés Caicedo", club: "Chelsea" },
  ],
  LW: [
    { name: "Vinícius Júnior", club: "Real Madrid" },
    { name: "Kylian Mbappé", club: "Paris Saint-Germain" },
    { name: "Khvicha Kvaratskhelia", club: "Napoli" },
    { name: "Rafael Leão", club: "Milan" },
    { name: "Son Heung-min", aliases: ["Heung-Min Son"], club: "Tottenham" },
    { name: "Marcus Rashford", club: "Man Utd" },
  ],
  RW: [
    { name: "Mohamed Salah", club: "Liverpool" },
    { name: "Bukayo Saka", club: "Arsenal" },
    { name: "Rodrygo", club: "Real Madrid" },
    { name: "Bernardo Silva", club: "Man City" },
    { name: "Ousmane Dembélé", club: "Paris Saint-Germain" },
    { name: "Federico Chiesa", club: "Juventus" },
  ],
  AMC: [
    { name: "Kevin De Bruyne", club: "Man City" },
    { name: "Bruno Fernandes", club: "Man Utd" },
    { name: "Jude Bellingham", club: "Real Madrid" },
    { name: "Martin Ødegaard", club: "Arsenal" },
    { name: "Jamal Musiala", club: "Bayern" },
    { name: "Florian Wirtz", club: "Bayer Leverkusen" },
  ],
  ST: [
    { name: "Kylian Mbappé", club: "Paris Saint-Germain" },
    { name: "Erling Haaland", club: "Man City" },
    { name: "Victor Osimhen", club: "Napoli" },
    { name: "Harry Kane", club: "Bayern" },
    { name: "Lautaro Martínez", club: "Inter" },
    { name: "Benjamin Šeško", club: "RB Leipzig" },
    { name: "Dušan Vlahović", club: "Juventus" },
    { name: "Alexander Isak", club: "Newcastle" },
  ],
};

const MAX_EXPECTED_RANK: Partial<Record<SlotId, Record<string, number>>> = {
  GK: {
    "Thibaut Courtois": 20,
    Alisson: 20,
    Ederson: 20,
    "Gianluigi Donnarumma": 25,
    "Mike Maignan": 20,
    "Manuel Neuer": 25,
  },
  LB: {
    "Andrew Robertson": 20,
    "João Cancelo": 40,
    "Destiny Udogie": 20,
  },
  RB: {
    "Trent Alexander-Arnold": 20,
    "Reece James": 20,
    "Kyle Walker": 25,
  },
  LCB: {
    "Virgil van Dijk": 10,
    "Rúben Dias": 10,
    "William Saliba": 25,
    "Alessandro Bastoni": 25,
    "Éder Militão": 40,
    "Joško Gvardiol": 20,
  },
  RCB: {
    "Virgil van Dijk": 10,
    "Rúben Dias": 10,
    "William Saliba": 25,
    Marquinhos: 20,
    "Éder Militão": 40,
    "Matthijs de Ligt": 25,
  },
  LDM: {
    Rodri: 5,
    "Declan Rice": 10,
    "Aurélien Tchouaméni": 20,
    "Joshua Kimmich": 25,
    "Bruno Guimarães": 20,
    "Moisés Caicedo": 25,
  },
  RDM: {
    Rodri: 5,
    "Declan Rice": 10,
    "Aurélien Tchouaméni": 20,
    "Joshua Kimmich": 25,
    "Bruno Guimarães": 20,
    "Moisés Caicedo": 25,
  },
  LW: {
    "Vinícius Júnior": 15,
    "Kylian Mbappé": 10,
    "Khvicha Kvaratskhelia": 25,
    "Rafael Leão": 35,
    "Son Heung-min": 35,
    "Marcus Rashford": 25,
  },
  RW: {
    "Mohamed Salah": 10,
    "Bukayo Saka": 15,
    Rodrygo: 25,
    "Bernardo Silva": 15,
    "Ousmane Dembélé": 100,
    "Federico Chiesa": 75,
  },
  AMC: {
    "Kevin De Bruyne": 15,
    "Bruno Fernandes": 40,
    "Jude Bellingham": 10,
    "Martin Ødegaard": 10,
    "Jamal Musiala": 25,
    "Florian Wirtz": 20,
  },
  ST: {
    "Kylian Mbappé": 10,
    "Erling Haaland": 5,
    "Victor Osimhen": 15,
    "Harry Kane": 15,
    "Lautaro Martínez": 10,
    "Benjamin Šeško": 80,
    "Dušan Vlahović": 25,
    "Alexander Isak": 20,
  },
};

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function normalizedMatch(value: string | undefined, wanted: string) {
  return normalizeName(String(value ?? "")).includes(normalizeName(wanted));
}

function positionCodes(position?: string) {
  const text = String(position ?? "").toUpperCase().replace(/\s+/g, "");
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

function slotSuitable(player: NormalizedPlayer, slot: SlotId) {
  const codes = positionCodes(player.position);
  return POSITION_BY_SLOT[slot].some((code) => codes.has(code));
}

function targetMatchScore(player: NormalizedPlayer, target: BenchmarkTarget) {
  const names = [target.name, ...(target.aliases ?? [])];
  const exactName = names.some((name) => normalizeName(player.name) === normalizeName(name));
  const containedName = names.some((name) => normalizedMatch(player.name, name));
  if (!exactName && !containedName) return -1;
  const clubScore = target.club && normalizedMatch(player.club, target.club) ? 2 : 0;
  return (exactName ? 4 : 1) + clubScore;
}

async function loadDataset() {
  const response = await fetch(DATASET_URL);
  if (!response.ok) throw new Error(`Could not fetch dataset (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return JSON.parse(gunzipSync(bytes).toString("utf8")) as DefaultDataset;
}

describe.skipIf(!RUN)("dataset role score benchmarks", () => {
  it("prints top role-score lists and benchmark ranks", async () => {
    const dataset = await loadDataset();
    const players = dataset.players;
    expect(players.length).toBeGreaterThan(100000);

    for (const slot of TACTIC_SLOTS) {
      const ranked = players
        .filter((player) => slotSuitable(player, slot.id))
        .map((player) => ({ player, score: scorePlayer(player, slot.roleId, slot.id) }))
        .filter((item) => item.score.attribute.available >= 8 && Number(item.score.position.score ?? 0) >= 80)
        .sort((a, b) => b.score.roleScore - a.score.roleScore);
      const top = ranked.slice(0, TOP_LIMIT).map((item, index) => `${index + 1}. ${item.player.name} (${item.player.club ?? "-"}) ${item.player.position ?? "-"} ${item.score.roleScore}`);
      console.log(`\n${slot.id} ${slot.roleId} top ${TOP_LIMIT}\n${top.join("\n")}`);

      const targets = BENCHMARKS[slot.id] ?? [];
      const benchmarkMatches: RankedMatch[] = targets.map((target) => {
        let bestMatch = { index: -1, score: -1 };
        ranked.forEach((item, index) => {
          const matchScore = targetMatchScore(item.player, target);
          if (matchScore > bestMatch.score) bestMatch = { index, score: matchScore };
        });
        const index = bestMatch.index;
        if (index < 0) return { target };
        const item = ranked[index];
        return { target, rank: index + 1, score: item.score.roleScore, club: item.player.club, position: item.player.position };
      });
      const ranks = benchmarkMatches.map((match) => match.rank === undefined
        ? `${match.target.name}: missing`
        : `${match.target.name}: #${match.rank} ${match.score} ${match.club ?? "-"} ${match.position ?? "-"}`);
      console.log(`${slot.id} benchmarks\n${ranks.join("\n")}`);
      const expectedRanks = MAX_EXPECTED_RANK[slot.id] ?? {};
      const failures = benchmarkMatches.filter((match) => {
        const maxRank = expectedRanks[match.target.name];
        return maxRank !== undefined && match.rank !== undefined && match.rank > maxRank;
      });
      expect(failures.map((match) => `${slot.id} ${match.target.name} ranked #${match.rank}, expected <= #${expectedRanks[match.target.name]}`)).toEqual([]);
    }
  }, 120000);
});
