import type { RoleScore, ScoredPlayer } from "./types";

const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const download = (name: string, content: string, type: string) => {
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href);
};
const columns = ["name", "age", "club", "division", "basedIn", "nationality", "position", "transferValueStatus", "valueM", "wageK", "contractType", "contractExpires", "playingTime", "minutes", "averageRating"];
const row = (player: ScoredPlayer, score?: RoleScore) => [...columns.map((key) => player[key]), score?.roleScore, score?.valueScore, score?.dataScore, score?.recommendationScore, score?.legacyRoleScore, score?.recruitmentScore, score?.confidenceScore, score?.attribute.score, score?.stats.score, score?.hidden.score, score?.position.score, score?.value.score, score?.caps.join("; "), score?.warnings.join("; "), score?.strengths.join("; "), score?.weaknesses.join("; "), score?.valuePositives.join("; "), score?.valueConcerns.join("; "), score?.dataNotes.join("; ")];
const headers = [...columns, "roleScore", "valueScore", "dataScore", "recommendationScore", "legacyRoleScore", "recruitmentScore", "confidenceScore", "attributeScore", "adjustedStatsScore", "hiddenProfileScore", "positionScore", "valueContextScore", "caps", "warnings", "strengths", "concerns", "valuePositives", "valueConcerns", "dataNotes"];

export function exportCSV(name: string, players: ScoredPlayer[], scores?: Map<string, RoleScore>) {
  const lines = [headers.map(quote).join(",")];
  for (const player of players) lines.push(row(player, scores?.get(player.id)).map(quote).join(","));
  download(name, lines.join("\n"), "text/csv;charset=utf-8");
}
export function exportHTML(name: string, players: ScoredPlayer[], scores: Map<string, RoleScore>) {
  const body = players.map((player) => `<tr>${row(player, scores.get(player.id)).map((value) => `<td>${String(value ?? "")}</td>`).join("")}</tr>`).join("");
  download(name, `<!doctype html><meta charset="utf-8"><title>FM Recruitment Rankings</title><table border="1"><thead><tr>${headers.map((value) => `<th>${value}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`, "text/html;charset=utf-8");
}
