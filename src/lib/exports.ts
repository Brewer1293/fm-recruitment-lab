import type { RoleScore, ScoredPlayer } from "./types";

const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const download = (name: string, content: string, type: string) => {
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href);
};
const columns = ["name", "age", "club", "nationality", "position", "valueM", "wageK", "minutes", "averageRating"];
const row = (player: ScoredPlayer, score?: RoleScore) => [...columns.map((key) => player[key]), score?.total, score?.attribute.score, score?.stats.score, score?.hidden.score, score?.position.score, score?.value.score, score?.strengths.join("; "), score?.weaknesses.join("; ")];
const headers = [...columns, "roleScore", "attributeScore", "statsScore", "hiddenScore", "positionScore", "valueScore", "strengths", "concerns"];

export function exportCSV(name: string, players: ScoredPlayer[], scores?: Map<string, RoleScore>) {
  download(name, [headers, ...players.map((player) => row(player, scores?.get(player.id)))].map((values) => values.map(quote).join(",")).join("\n"), "text/csv;charset=utf-8");
}
export function exportHTML(name: string, players: ScoredPlayer[], scores: Map<string, RoleScore>) {
  const body = players.map((player) => `<tr>${row(player, scores.get(player.id)).map((value) => `<td>${String(value ?? "")}</td>`).join("")}</tr>`).join("");
  download(name, `<!doctype html><meta charset="utf-8"><title>Miracle One Rankings</title><table border="1"><thead><tr>${headers.map((value) => `<th>${value}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`, "text/html;charset=utf-8");
}
