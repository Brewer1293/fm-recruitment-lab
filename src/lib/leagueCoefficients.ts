import type { NormalizedPlayer } from "./types";

export type LeagueCoefficientMatch = { coefficient: number; label: string; matched: string };

const RULES: { pattern: RegExp; coefficient: number; label: string }[] = [
  { pattern: /\b(premier league|english premier|england premier)\b/i, coefficient: 1.0, label: "Premier League" },
  { pattern: /\b(la ?liga|laliga|spanish first division|primera division)\b/i, coefficient: 1.0, label: "LaLiga" },
  { pattern: /\b(serie a|italian serie a)\b/i, coefficient: 0.99, label: "Serie A" },
  { pattern: /\b(bundesliga)(?!\s*2| 2\b|\. 2)\b/i, coefficient: 0.99, label: "Bundesliga" },
  { pattern: /\b(ligue 1|french first division)\b/i, coefficient: 0.96, label: "Ligue 1" },
  { pattern: /\b(champions league|uefa champions)\b/i, coefficient: 1.03, label: "UEFA Champions League" },
  { pattern: /\b(europa league|uefa europa)\b/i, coefficient: 0.97, label: "UEFA Europa League" },
  { pattern: /\b(championship|sky bet champ)\b/i, coefficient: 0.78, label: "EFL Championship" },
  { pattern: /\b(2\.? bundesliga|bundesliga 2|segunda division|serie b|ligue 2)\b/i, coefficient: 0.76, label: "Major second tier" },
  { pattern: /\b(eredivisie)\b/i, coefficient: 0.86, label: "Eredivisie" },
  { pattern: /\b(liga portugal|portuguese premier|primeira liga)\b/i, coefficient: 0.84, label: "Liga Portugal" },
  { pattern: /\b(belgian pro|jupiler|pro league)\b/i, coefficient: 0.82, label: "Belgian Pro League" },
  { pattern: /\b(super lig|super league turkey|turkish super)\b/i, coefficient: 0.82, label: "Turkish Super Lig" },
  { pattern: /\b(scottish premiership|cinch premiership)\b/i, coefficient: 0.76, label: "Scottish Premiership" },
  { pattern: /\b(mls|major league soccer)\b/i, coefficient: 0.74, label: "MLS" },
  { pattern: /\b(brasileirao|brazilian national first|serie a brazil)\b/i, coefficient: 0.78, label: "Brazil Serie A" },
  { pattern: /\b(argentine premier|argentina primera|liga profesional)\b/i, coefficient: 0.76, label: "Argentina Primera" },
  { pattern: /\b(austrian bundesliga|swiss super|danish superliga|eliteserien|allsvenskan)\b/i, coefficient: 0.72, label: "European top tier" },
  { pattern: /\b(league one|efl league 1)\b/i, coefficient: 0.64, label: "EFL League One" },
  { pattern: /\b(league two|efl league 2)\b/i, coefficient: 0.56, label: "EFL League Two" },
  { pattern: /\b(national league)\b/i, coefficient: 0.48, label: "National League" },
];

const COUNTRY_DEFAULTS: { pattern: RegExp; coefficient: number; label: string }[] = [
  { pattern: /\b(england|spain)\b/i, coefficient: 0.86, label: "Strong football nation default" },
  { pattern: /\b(italy|germany|france)\b/i, coefficient: 0.84, label: "Strong football nation default" },
  { pattern: /\b(portugal|netherlands|belgium|turkiye|turkey|brazil|argentina)\b/i, coefficient: 0.74, label: "High-mid football nation default" },
  { pattern: /\b(scotland|austria|switzerland|denmark|norway|sweden|usa|mexico)\b/i, coefficient: 0.68, label: "Mid football nation default" },
];

const text = (value: unknown) => String(value ?? "").trim();

export function leagueCoefficient(player: Pick<NormalizedPlayer, "division" | "basedIn" | "based" | "nationality">): LeagueCoefficientMatch {
  const haystack = [player.division, player.basedIn, player.based, player.nationality].map(text).filter(Boolean).join(" | ");
  for (const rule of RULES) if (rule.pattern.test(haystack)) return { coefficient: rule.coefficient, label: rule.label, matched: haystack };
  for (const rule of COUNTRY_DEFAULTS) if (rule.pattern.test(haystack)) return { coefficient: rule.coefficient, label: rule.label, matched: haystack };
  return { coefficient: 0.62, label: "Unmapped league default", matched: haystack || "No league exported" };
}

export function adjustedPositiveMetric(value: number, coefficient: number) {
  return value * coefficient;
}

export function adjustedNegativeMetric(value: number, coefficient: number) {
  return value / Math.max(coefficient, 0.1);
}
