export type RawPlayer = Record<string, string>;
export type NormalizedPlayer = Record<string, string | number | RawPlayer | undefined> & {
  id: string;
  raw: RawPlayer;
  name: string;
  age?: number;
  club?: string;
  nationality?: string;
  position?: string;
  preferredFoot?: string;
  leftFoot?: string;
  rightFoot?: string;
  valueM?: number;
  wageK?: number;
  minutes?: number;
  averageRating?: number;
};

export type WeightedMetric = { key: string; weight: number; label?: string; inverse?: boolean };
export type Penalty = { key: string; below?: number; above?: number; points: number; label: string };
export type RoleConfig = {
  id: RoleId;
  shortName: string;
  label: string;
  slotLabels: string[];
  essential: WeightedMetric[];
  core: WeightedMetric[];
  secondary: WeightedMetric[];
  hidden: WeightedMetric[];
  stats: WeightedMetric[];
  positions: { natural: string[]; possible: string[] };
  penalties: Penalty[];
};
export type RoleId = "sk-su" | "fb-at" | "bpd-de" | "dm-su" | "if-su" | "am-at" | "af-at";
export type SlotId = "GK" | "LB" | "LCB" | "RCB" | "RB" | "LDM" | "RDM" | "LW" | "AMC" | "RW" | "ST";
export type ScorePart = { score?: number; available: number; expected: number };
export type RoleScore = {
  roleId: RoleId;
  slot?: SlotId;
  total: number;
  attribute: ScorePart;
  stats: ScorePart;
  hidden: ScorePart;
  position: ScorePart;
  value: ScorePart;
  strengths: string[];
  weaknesses: string[];
  warnings: string[];
};
export type ScoredPlayer = NormalizedPlayer & { scores: Record<RoleId, RoleScore> };
export type ValidationReport = {
  files: string[];
  playerCount: number;
  detectedColumns: string[];
  normalizedColumns: string[];
  missingRequired: string[];
  missingUseful: string[];
  messages: string[];
};
