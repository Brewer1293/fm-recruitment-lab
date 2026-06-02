import type { RoleConfig, RoleId, SlotId } from "./types";

const m = (keys: string[], weight = 1) => keys.map((key) => ({ key, weight }));
const stat = (key: string, weight = 1, inverse = false) => ({ key, weight, inverse });

export const ROLE_CONFIG: Record<RoleId, RoleConfig> = {
  "sk-su": {
    id: "sk-su", shortName: "SK-Su", label: "Sweeper Keeper Support", slotLabels: ["GK"],
    essential: m(["ref", "oneVOne", "agi", "ant", "cmd", "cnt", "pos", "han", "aer"], 3),
    core: m(["kic", "thr", "pas", "fir", "dec", "vis", "cmp", "acc"], 2),
    secondary: [], hidden: m(["consistency", "importantMatches", "pressure", "professionalism"]),
    stats: [stat("savePercentage", 3), stat("cleanSheets90", 2), stat("conceded90", 2, true), stat("passCompletion")],
    positions: { natural: ["GK"], possible: [] }, penalties: [],
  },
  "fb-at": {
    id: "fb-at", shortName: "FB-At", label: "Full Back Attack", slotLabels: ["LB", "RB"],
    essential: m(["acc", "pac", "sta", "wor", "cro", "dri", "otb", "tea"], 3),
    core: m(["tck", "mar", "pos", "ant", "cnt", "dec"], 2), secondary: m(["fir", "pas", "tec"]),
    hidden: m(["consistency", "importantMatches", "professionalism"]),
    stats: [stat("keyPasses90", 2), stat("crossesCompleted90", 2), stat("assists90"), stat("xa90"), stat("tackles90"), stat("interceptions90"), stat("dribbles90"), stat("averageRating")],
    positions: { natural: ["D (L)", "D (R)", "WB (L)", "WB (R)", "DL", "DR", "WBL", "WBR"], possible: ["M (L)", "M (R)", "ML", "MR"] },
    penalties: [{ key: "dirtiness", above: 15, points: 4, label: "high dirtiness" }],
  },
  "bpd-de": {
    id: "bpd-de", shortName: "BPD-De", label: "Ball Playing Defender Defend", slotLabels: ["LCB", "RCB"],
    essential: m(["pas", "cmp", "dec", "vis", "fir", "tec", "tck", "mar", "pos", "ant", "cnt"], 3),
    core: m(["hea", "jum", "str", "bra"], 2), secondary: m(["pac", "acc", "agi"]),
    hidden: m(["consistency", "importantMatches", "pressure", "professionalism"]),
    stats: [stat("passCompletion", 2), stat("progressivePasses90", 2), stat("tackles90"), stat("interceptions90"), stat("headersWon90"), stat("averageRating")],
    positions: { natural: ["D (C)", "DC"], possible: ["DM"] },
    penalties: [{ key: "cnt", below: 10, points: 6, label: "low concentration" }, { key: "dec", below: 10, points: 5, label: "low decisions" }, { key: "pac", below: 9, points: 5, label: "poor pace" }],
  },
  "dm-su": {
    id: "dm-su", shortName: "DM-Su", label: "Defensive Midfielder Support", slotLabels: ["LDM", "RDM"],
    essential: m(["tck", "pos", "ant", "cnt", "dec", "tea", "wor", "sta"], 3),
    core: m(["pas", "fir", "tec", "cmp", "vis"], 2), secondary: m(["pac", "acc", "bal", "str", "agi"]),
    hidden: m(["consistency", "importantMatches", "professionalism", "pressure"]),
    stats: [stat("tackles90", 2), stat("interceptions90", 2), stat("passCompletion"), stat("keyPasses90"), stat("progressivePasses90"), stat("averageRating")],
    positions: { natural: ["DM"], possible: ["M (C)", "MC", "D (C)", "DC"] },
    penalties: [{ key: "wor", below: 10, points: 4, label: "poor work rate" }, { key: "sta", below: 10, points: 4, label: "poor stamina" }, { key: "cnt", below: 10, points: 4, label: "poor concentration" }],
  },
  "if-su": {
    id: "if-su", shortName: "IF-Su", label: "Inside Forward Support", slotLabels: ["LW", "RW"],
    essential: m(["acc", "pac", "dri", "tec", "fir", "otb", "fin", "cmp"], 3),
    core: m(["pas", "vis", "dec", "fla", "cro"], 2), secondary: m(["agi", "bal", "sta", "wor"]),
    hidden: m(["consistency", "importantMatches", "professionalism"]),
    stats: [stat("goals90", 2), stat("xg90", 2), stat("assists90"), stat("xa90"), stat("keyPasses90"), stat("dribbles90"), stat("shots90"), stat("averageRating")],
    positions: { natural: ["AM (L)", "AM (R)", "AML", "AMR", "M (L)", "M (R)", "ML", "MR"], possible: ["ST", "AM (C)", "AMC"] },
    penalties: [{ key: "fin", below: 10, points: 4, label: "low finishing" }, { key: "cmp", below: 10, points: 4, label: "low composure" }, { key: "otb", below: 10, points: 4, label: "poor off the ball" }],
  },
  "am-at": {
    id: "am-at", shortName: "AM-At", label: "Attacking Midfielder Attack", slotLabels: ["AMC"],
    essential: m(["pas", "vis", "dec", "tec", "fir", "otb", "cmp", "fla"], 3),
    core: m(["fin", "lon", "ant"], 2), secondary: m(["agi", "bal", "acc", "tea", "wor"]),
    hidden: m(["consistency", "importantMatches", "professionalism", "pressure"]),
    stats: [stat("keyPasses90", 2), stat("xa90", 2), stat("assists90"), stat("goals90"), stat("xg90"), stat("shots90"), stat("passCompletion"), stat("averageRating")],
    positions: { natural: ["AM (C)", "AMC"], possible: ["M (C)", "MC", "ST"] },
    penalties: [{ key: "dec", below: 10, points: 5, label: "low decisions" }, { key: "vis", below: 10, points: 5, label: "low vision" }, { key: "fir", below: 10, points: 4, label: "low first touch" }],
  },
  "af-at": {
    id: "af-at", shortName: "AF-At", label: "Advanced Forward Attack", slotLabels: ["ST"],
    essential: m(["acc", "pac", "fin", "cmp", "otb", "ant"], 3),
    core: m(["fir", "tec", "dri", "dec"], 2), secondary: m(["agi", "bal", "sta", "str"]),
    hidden: m(["consistency", "importantMatches", "pressure", "professionalism"]),
    stats: [stat("goals90", 3), stat("xg90", 2), stat("shots90"), stat("conversionPercentage"), stat("averageRating")],
    positions: { natural: ["ST", "ST (C)"], possible: ["AM (C)", "AMC", "AM (L)", "AM (R)", "AML", "AMR"] },
    penalties: [{ key: "fin", below: 10, points: 5, label: "low finishing" }, { key: "otb", below: 10, points: 5, label: "low off the ball" }, { key: "cmp", below: 10, points: 5, label: "low composure" }, { key: "pac", below: 10, points: 4, label: "poor pace" }],
  },
};

export const TACTIC_SLOTS: { id: SlotId; roleId: RoleId; x: number; y: number }[] = [
  { id: "ST", roleId: "af-at", x: 50, y: 10 }, { id: "LW", roleId: "if-su", x: 19, y: 29 },
  { id: "AMC", roleId: "am-at", x: 50, y: 31 }, { id: "RW", roleId: "if-su", x: 81, y: 29 },
  { id: "LDM", roleId: "dm-su", x: 37, y: 52 }, { id: "RDM", roleId: "dm-su", x: 63, y: 52 },
  { id: "LB", roleId: "fb-at", x: 15, y: 72 }, { id: "LCB", roleId: "bpd-de", x: 39, y: 70 },
  { id: "RCB", roleId: "bpd-de", x: 61, y: 70 }, { id: "RB", roleId: "fb-at", x: 85, y: 72 },
  { id: "GK", roleId: "sk-su", x: 50, y: 90 },
];
