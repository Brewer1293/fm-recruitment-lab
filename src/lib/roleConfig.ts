import type { RoleConfig, RoleId, SlotId } from "./types";

export const PRESET_VERSION = "balanced-fm24-recruitment-v1";

export const ROLE_SCORE_WEIGHTS = {
  attribute: 0.7,
  positionFoot: 0.15,
  hidden: 0.1,
  stats: 0.05,
};

export const RECRUITMENT_SCORE_WEIGHTS = {
  role: 0.7,
  marketValue: 0.15,
  wage: 0.05,
  ageDevelopment: 0.1,
};

export const TACTIC_SLOTS: { id: SlotId; roleId: RoleId; x: number; y: number }[] = [
  { id: "GK", roleId: "sk-su", x: 50, y: 90 },
  { id: "LB", roleId: "fb-at", x: 18, y: 70 },
  { id: "LCB", roleId: "bpd-de", x: 38, y: 73 },
  { id: "RCB", roleId: "bpd-de", x: 62, y: 73 },
  { id: "RB", roleId: "fb-at", x: 82, y: 70 },
  { id: "LDM", roleId: "dm-su", x: 42, y: 55 },
  { id: "RDM", roleId: "dm-su", x: 58, y: 55 },
  { id: "LW", roleId: "if-su", x: 22, y: 34 },
  { id: "AMC", roleId: "am-at", x: 50, y: 33 },
  { id: "RW", roleId: "if-su", x: 78, y: 34 },
  { id: "ST", roleId: "af-at", x: 50, y: 15 },
];

const attackerWeights = {
  Acc: 9, Pac: 9, Sta: 7, Str: 5, Agi: 8, Bal: 7, Jum: 4, Nat: 6, Wor: 6,
  Fin: 7, Fir: 8, Pas: 6, Tec: 8, Dri: 8, Cro: 4, Hea: 2, Mar: 1, Tck: 2,
  Lon: 5, OtB: 8, Tea: 6, Vis: 6, Dec: 7, Ant: 7, Cmp: 7, Cnt: 5, Pos: 3,
  Fla: 7, Bra: 4, Det: 5,
};

export const ROLE_CONFIG: Record<RoleId, RoleConfig> = {
  "sk-su": {
    id: "sk-su", shortName: "SK-Su", label: "Sweeper Keeper", duty: "Support", positions: ["GK"], ageCurveGroup: "goalkeeper", footRule: "CENTRAL_NEUTRAL",
    attributeWeights: { Acc: 7, Pac: 7, Str: 4, Agi: 5, Bal: 4, Nat: 3, Fir: 4, Pas: 4, Tec: 4, Tck: 1, Tea: 3, Vis: 2, Dec: 7, Ant: 7, Cmp: 7, Cnt: 7, Pos: 8, Bra: 5, Det: 4, Ref: 10, "1v1": 8, Cmd: 8, Kic: 8, Thr: 7, Han: 8, Aer: 8 },
    positiveStatWeights: { savePct: 0.42, cleanSheets90: 0.22, passCompletionPct: 0.14, longPassCompletionPct: 0.14, avgRating: 0.08 },
    negativeStatPenalties: { errorsLeadingToGoal90: 0.2 },
    floorPenalties: [{ attribute: "Ref", lt: 12, minus: 5 }, { attribute: "Cmd", lt: 11, minus: 4 }, { attribute: "Pos", lt: 11, minus: 4 }, { attribute: "Han", lt: 11, minus: 3 }],
    warnings: [{ attribute: "Ref", lt: 12, label: "Low reflexes for SK" }, { attribute: "Han", lt: 11, label: "Handling concern" }, { attribute: "Kic", lt: 10, label: "Distribution concern" }],
  },
  "fb-at": {
    id: "fb-at", shortName: "FB-At", label: "Full Back", duty: "Attack", positions: ["DL", "DR", "WBL", "WBR"], ageCurveGroup: "defenderMidfielder", footRule: "FB_AT_LB",
    attributeWeights: { Acc: 9, Pac: 9, Sta: 9, Str: 5, Agi: 7, Bal: 6, Jum: 4, Nat: 7, Wor: 8, Fin: 2, Fir: 6, Pas: 7, Tec: 7, Dri: 7, Cro: 9, Hea: 3, Mar: 6, Tck: 7, Lon: 3, OtB: 8, Tea: 7, Vis: 5, Dec: 7, Ant: 7, Cmp: 6, Cnt: 6, Pos: 6, Fla: 5, Bra: 6, Det: 6 },
    positiveStatWeights: { xA90: 0.18, assists90: 0.14, keyPasses90: 0.12, crossesCompleted90: 0.18, dribblesCompleted90: 0.1, tacklesWon90: 0.1, interceptions90: 0.1, passCompletionPct: 0.08 },
    negativeStatPenalties: { errorsLeadingToGoal90: 0.08 },
    floorPenalties: [{ attribute: "Acc", lt: 12, minus: 3 }, { attribute: "Pac", lt: 12, minus: 3 }, { attribute: "Sta", lt: 12, minus: 4 }, { attribute: "Cro", lt: 11, minus: 4 }],
    warnings: [{ attribute: "Acc", lt: 12, label: "Acceleration concern" }, { attribute: "Pac", lt: 12, label: "Pace concern" }, { attribute: "Sta", lt: 12, label: "Stamina concern" }, { attribute: "Cro", lt: 11, label: "Crossing concern" }],
  },
  "bpd-de": {
    id: "bpd-de", shortName: "BPD-De", label: "Ball Playing Defender", duty: "Defend", positions: ["DC"], ageCurveGroup: "defenderMidfielder", footRule: "BPD_SIDE_AWARE",
    attributeWeights: { Acc: 7, Pac: 8, Sta: 5, Str: 7, Agi: 5, Bal: 6, Jum: 8, Nat: 5, Wor: 5, Fin: 1, Fir: 6, Pas: 8, Tec: 8, Dri: 4, Cro: 1, Hea: 7, Mar: 7, Tck: 8, Lon: 3, OtB: 3, Tea: 6, Vis: 5, Dec: 8, Ant: 8, Cmp: 7, Cnt: 8, Pos: 8, Fla: 2, Bra: 7, Det: 6 },
    positiveStatWeights: { passCompletionPct: 0.2, progressivePasses90: 0.2, longPassCompletionPct: 0.14, tacklesWon90: 0.12, interceptions90: 0.14, headersWonPct: 0.1, cleanSheets90: 0.04, keyPasses90: 0.06 },
    negativeStatPenalties: { errorsLeadingToGoal90: 0.14 },
    floorPenalties: [{ attribute: "Pac", lt: 12, minus: 3 }, { attribute: "Jum", lt: 13, minus: 3 }, { attribute: "Pas", lt: 11, minus: 4 }, { attribute: "Dec", lt: 11, minus: 4 }, { attribute: "Tec", lt: 10, minus: 3 }, { attribute: "Tck", lt: 11, minus: 4 }],
    warnings: [{ attribute: "Pac", lt: 12, label: "Pace concern" }, { attribute: "Jum", lt: 13, label: "Aerial concern" }, { attribute: "Pas", lt: 11, label: "Passing concern" }, { attribute: "Dec", lt: 11, label: "Decision-making concern" }, { attribute: "Tck", lt: 11, label: "Tackling concern" }],
  },
  "dm-su": {
    id: "dm-su", shortName: "DM-Su", label: "Defensive Midfielder", duty: "Support", positions: ["DM", "MC"], ageCurveGroup: "defenderMidfielder", footRule: "CENTRAL_NEUTRAL",
    attributeWeights: { Acc: 6, Pac: 7, Sta: 8, Str: 7, Agi: 5, Bal: 7, Jum: 5, Nat: 6, Wor: 8, Fin: 2, Fir: 7, Pas: 8, Tec: 6, Dri: 4, Cro: 1, Hea: 4, Mar: 7, Tck: 8, Lon: 4, OtB: 5, Tea: 8, Vis: 6, Dec: 9, Ant: 8, Cmp: 7, Cnt: 8, Pos: 9, Fla: 2, Bra: 7, Det: 7 },
    positiveStatWeights: { tacklesWon90: 0.18, interceptions90: 0.18, passCompletionPct: 0.18, progressivePasses90: 0.12, keyPasses90: 0.08, xA90: 0.06, headersWonPct: 0.08, avgRating: 0.12 },
    negativeStatPenalties: { errorsLeadingToGoal90: 0.08 },
    floorPenalties: [{ attribute: "Pos", lt: 12, minus: 5 }, { attribute: "Dec", lt: 11, minus: 4 }, { attribute: "Tck", lt: 11, minus: 4 }, { attribute: "Pas", lt: 11, minus: 3 }],
    warnings: [{ attribute: "Pos", lt: 12, label: "Positioning concern" }, { attribute: "Dec", lt: 11, label: "Decision-making concern" }, { attribute: "Tck", lt: 11, label: "Tackling concern" }, { attribute: "Pas", lt: 11, label: "Passing concern" }],
  },
  "if-su": {
    id: "if-su", shortName: "IF-Su", label: "Inside Forward", duty: "Support", positions: ["AML", "AMR", "ST"], ageCurveGroup: "attacker", footRule: "IF_SU_LW",
    attributeWeights: attackerWeights,
    positiveStatWeights: { xG90: 0.2, goals90: 0.16, xA90: 0.14, assists90: 0.1, shots90: 0.1, shotConversionPct: 0.08, dribblesCompleted90: 0.12, keyPasses90: 0.1 },
    negativeStatPenalties: { errorsLeadingToGoal90: 0.04 },
    floorPenalties: [{ attribute: "Acc", lt: 13, minus: 3 }, { attribute: "Pac", lt: 13, minus: 3 }, { attribute: "Dri", lt: 12, minus: 4 }, { attribute: "Fir", lt: 11, minus: 3 }],
    warnings: [{ attribute: "Acc", lt: 13, label: "Acceleration concern" }, { attribute: "Pac", lt: 13, label: "Pace concern" }, { attribute: "Dri", lt: 12, label: "Dribbling concern" }, { attribute: "Fir", lt: 11, label: "First touch concern" }],
  },
  "am-at": {
    id: "am-at", shortName: "AM-At", label: "Attacking Midfielder", duty: "Attack", positions: ["AMC", "MC"], ageCurveGroup: "attacker", footRule: "CENTRAL_NEUTRAL_PLUS_TWO_FOOT",
    attributeWeights: { Acc: 7, Pac: 7, Sta: 6, Str: 4, Agi: 7, Bal: 7, Jum: 2, Nat: 5, Wor: 5, Fin: 7, Fir: 8, Pas: 8, Tec: 9, Dri: 8, Cro: 4, Hea: 1, Mar: 1, Tck: 1, Lon: 5, OtB: 8, Tea: 7, Vis: 8, Dec: 9, Ant: 8, Cmp: 8, Cnt: 6, Pos: 2, Fla: 8, Bra: 4, Det: 5 },
    positiveStatWeights: { xA90: 0.2, keyPasses90: 0.18, xG90: 0.12, goals90: 0.1, assists90: 0.1, dribblesCompleted90: 0.12, passCompletionPct: 0.08, shots90: 0.05, shotConversionPct: 0.05 },
    negativeStatPenalties: { errorsLeadingToGoal90: 0.04 },
    floorPenalties: [{ attribute: "Dec", lt: 12, minus: 4 }, { attribute: "Tec", lt: 12, minus: 4 }, { attribute: "Pas", lt: 11, minus: 3 }, { attribute: "Fla", lt: 11, minus: 2 }],
    warnings: [{ attribute: "Dec", lt: 12, label: "Decision-making concern" }, { attribute: "Tec", lt: 12, label: "Technique concern" }, { attribute: "Pas", lt: 11, label: "Passing concern" }, { attribute: "Fla", lt: 11, label: "Flair concern" }],
  },
  "af-at": {
    id: "af-at", shortName: "AF-At", label: "Advanced Forward", duty: "Attack", positions: ["ST"], ageCurveGroup: "attacker", footRule: "CENTRAL_NEUTRAL_PLUS_TWO_FOOT",
    attributeWeights: { Acc: 10, Pac: 10, Sta: 7, Str: 7, Agi: 7, Bal: 6, Jum: 7, Nat: 6, Wor: 5, Fin: 10, Fir: 7, Pas: 4, Tec: 6, Dri: 6, Cro: 1, Hea: 6, Lon: 2, OtB: 10, Tea: 4, Vis: 4, Dec: 7, Ant: 8, Cmp: 8, Cnt: 5, Pos: 1, Fla: 4, Bra: 4, Det: 5 },
    positiveStatWeights: { xG90: 0.26, goals90: 0.24, shots90: 0.14, shotConversionPct: 0.14, xA90: 0.06, assists90: 0.04, dribblesCompleted90: 0.06, headersWonPct: 0.06 },
    negativeStatPenalties: { errorsLeadingToGoal90: 0.02 },
    floorPenalties: [{ attribute: "Acc", lt: 13, minus: 3 }, { attribute: "Pac", lt: 13, minus: 3 }, { attribute: "Fin", lt: 12, minus: 5 }, { attribute: "OtB", lt: 12, minus: 4 }, { attribute: "Fir", lt: 10, minus: 2 }],
    scoreCaps: [{ attribute: "Fin", lt: 10, maxRoleScore: 72 }, { attribute: "OtB", lt: 10, maxRoleScore: 72 }, { all: [{ attribute: "Acc", lt: 11 }, { attribute: "Pac", lt: 11 }], maxRoleScore: 65 }, { positionNotAtLeast: "Competent", maxRoleScore: 72 }, { noCentralForwardSuitability: true, maxRoleScore: 55 }],
    warnings: [{ attribute: "Acc", lt: 13, label: "Acceleration concern" }, { attribute: "Pac", lt: 13, label: "Pace concern" }, { attribute: "Fin", lt: 12, label: "Finishing concern" }, { attribute: "OtB", lt: 12, label: "Off the ball concern" }, { attribute: "Fir", lt: 10, label: "First touch concern" }],
  },
};
