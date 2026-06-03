import type { NormalizedPlayer, RawPlayer, ValidationReport } from "./types";

const ALIASES: Record<string, string[]> = {
  name: ["name"], age: ["age"], dob: ["dob", "date of birth"], club: ["club", "team"], nationality: ["nat", "nationality"], secondNationality: ["2nd nat", "second nationality"],
  internationalCaps: ["caps", "international caps"], internationalGoals: ["int goals", "international goals"],
  based: ["based"], basedIn: ["based in"], division: ["division"],
  position: ["position", "pos"], personality: ["personality"], mediaDescription: ["media description"], mediaHandling: ["media handling"],
  preferredFoot: ["preferred foot"], leftFoot: ["left foot"], rightFoot: ["right foot"],
  contractType: ["contract type", "type"], contractStarted: ["contract started", "started"], contractExpires: ["contract expires", "expires"],
  playingTime: ["playing time", "agreed playing time", "actual playing time"], injury: ["injury"], injuryRisk: ["injury risk"],
  fatigue: ["fatigue"], morale: ["morale"], condition: ["condition", "con"], fitness: ["fitness"], sharpness: ["sharpness", "match sharpness", "shp"],
  height: ["height"], valueM: ["transfer value", "value"], wageK: ["wage"], minutes: ["mins", "minutes"],
  averageRating: ["av rat", "average rating"], uid: ["uid"],
  acc: ["acc"], pac: ["pac"], sta: ["sta"], wor: ["wor"], cro: ["cro"], dri: ["dri", "drb"],
  nat: ["nat", "natural fitness"],
  otb: ["otb", "off the ball"], tck: ["tck"], mar: ["mar"], pos: ["pos"], ant: ["ant"], cnt: ["cnt"],
  dec: ["dec"], fir: ["fir"], pas: ["pas"], tec: ["tec"], vis: ["vis"], cmp: ["cmp", "com"],
  fla: ["fla"], fin: ["fin"], lon: ["lon"], agi: ["agi"], bal: ["bal"], str: ["str"], jum: ["jum"],
  hea: ["hea"], bra: ["bra"], cor: ["cor", "corners"], fre: ["fre", "free kick taking", "free kicks"], lth: ["l th", "long throws"], pen: ["pen", "penalty taking", "penalties"], agg: ["agg", "aggression"], ldr: ["ldr", "leadership"],
  ref: ["ref"], oneVOne: ["1v1"], cmd: ["cmd"], kic: ["kic"], thr: ["thr"],
  han: ["han"], aer: ["aer"], com: ["com", "communication"], ecc: ["ecc", "eccentricity"], pun: ["pun", "punching", "punching tendency"], tro: ["tro", "tendency to rush out", "rushing out"],
  consistency: ["consistency", "cons"], importantMatches: ["important matches", "imp matches", "imp m"],
  pressure: ["pressure", "pres"], professionalism: ["professionalism", "prof"], dirtiness: ["dirtiness", "dirty", "dirt"],
  goals90: ["gls/90", "goals/90"], xg90: ["xg/90"], assists90: ["asts/90", "ast/90", "assists/90"],
  xa90: ["xa/90"], keyPasses90: ["k ps/90", "key passes/90"], shots90: ["shot/90", "shots/90"],
  passCompletion: ["pas %", "pass %"], tackles90: ["tck/90", "tackles/90"], interceptions90: ["int/90", "interceptions/90"],
  headersWon90: ["hdrs w/90", "headers won/90"], headersPct: ["hdr %", "headers %"], crossesCompleted90: ["cr c/90", "crosses completed/90"],
  dribbles90: ["drb/90", "dribbles/90"], savePercentage: ["sv %", "save %"], cleanSheets90: ["cln/90", "clean sheets/90"],
  conceded90: ["con/90", "goals conceded/90"], conversionPercentage: ["conv %", "conversion %"], progressivePasses90: ["pr passes/90", "progressive passes/90"],
  longPassCompletion: ["long pass %", "long passes %"], errorsLeadingToGoal90: ["errors/90", "err/90", "errors leading to goal/90"],
};
const TEXT_FIELDS = ["name", "dob", "club", "nationality", "secondNationality", "based", "basedIn", "division", "position", "personality", "mediaDescription", "mediaHandling", "preferredFoot", "leftFoot", "rightFoot", "contractType", "contractStarted", "contractExpires", "playingTime", "injury", "injuryRisk", "fatigue", "morale", "height", "uid"];
const NUMERIC = new Set(Object.keys(ALIASES).filter((key) => !TEXT_FIELDS.includes(key)));
const REQUIRED = ["name", "position"];
const USEFUL = ["age", "club", "nationality", "basedIn", "division", "uid", "valueM", "wageK", "minutes", "averageRating", "preferredFoot", "leftFoot", "rightFoot"];

const clean = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
const norm = (value: string) => clean(value).toLowerCase().replace(/\.\d+$/, "").trim();
const number = (value?: string) => {
  if (!value || value === "-") return undefined;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
};
const money = (value?: string) => {
  if (!value) return { low: undefined, high: undefined, mid: undefined, status: "missing" as const };
  const cleaned = value.replace(/,/g, "").replace(/£/g, "").trim();
  if (/not for sale/i.test(cleaned) || /^nfs$/i.test(cleaned)) return { low: undefined, high: undefined, mid: undefined, status: "not_for_sale" as const };
  const values = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*([km]?)/gi)].map((match) => {
    const amount = Number(match[1]), suffix = match[2].toLowerCase();
    return suffix === "m" ? amount : suffix === "k" ? amount / 1000 : amount > 1000 ? amount / 1_000_000 : amount;
  });
  if (!values.length) return { low: undefined, high: undefined, mid: undefined, status: "missing" as const };
  const low = Math.min(...values), high = Math.max(...values);
  return { low, high, mid: (low + high) / 2, status: low === high ? "fixed" as const : "range" as const };
};
const wage = (value?: string) => {
  if (!value) return undefined;
  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([km]?)/i);
  if (!match) return undefined;
  const amount = Number(match[1]), suffix = match[2].toLowerCase();
  return suffix === "m" ? amount * 1000 : suffix === "k" ? amount : amount / 1000;
};

function uniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    return count ? `${header}.${count}` : header;
  });
}

function cells(row: string) {
  return [...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((match) => clean(match[1]));
}

async function parseHTML(file: File, onProgress: (percent: number) => void) {
  const reader = file.stream().getReader(), decoder = new TextDecoder("utf-8");
  let buffer = "", loaded = 0, inTable = false, headers: string[] = [];
  const rows: RawPlayer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength; buffer += decoder.decode(value, { stream: true });
    onProgress(Math.min(98, Math.round((loaded / file.size) * 100)));
    if (!inTable) {
      const table = buffer.search(/<table\b/i);
      if (table < 0) { buffer = buffer.slice(-1024); continue; }
      inTable = true; buffer = buffer.slice(table);
    }
    let end = buffer.search(/<\/tr>/i);
    while (end >= 0) {
      const row = buffer.slice(0, end + 5); buffer = buffer.slice(end + 5);
      const values = cells(row);
      if (values.length) {
        if (!headers.length) headers = uniqueHeaders(values);
        else rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
      }
      end = buffer.search(/<\/tr>/i);
    }
  }
  onProgress(100);
  if (!headers.length) throw new Error("No table found in uploaded HTML.");
  return { rows, headers };
}

function mapColumns(headers: string[]) {
  const normalized = new Map<string, string[]>();
  headers.forEach((header) => normalized.set(norm(header), [...(normalized.get(norm(header)) ?? []), header]));
  return Object.fromEntries(Object.entries(ALIASES).map(([key, aliases]) => {
    for (const alias of aliases) {
      const matches = normalized.get(alias);
      if (!matches?.length) continue;
      if (key === "nat" && alias === "nat" && matches.length > 1) return [key, matches[1]];
      return [key, matches[0]];
    }
    return [key, undefined];
  })) as Record<string, string | undefined>;
}

const validText = (value?: string) => {
  const text = clean(value ?? "");
  return Boolean(text && text !== "-" && text !== "- -" && !/^unknown player/i.test(text));
};

function normalize(rows: RawPlayer[], columns: Record<string, string | undefined>) {
  const players: NormalizedPlayer[] = [];
  let skippedRows = 0;
  rows.forEach((raw, index) => {
    const name = raw[columns.name ?? ""];
    const position = raw[columns.position ?? ""];
    if (!validText(name) || !validText(position)) {
      skippedRows += 1;
      return;
    }
    const player: NormalizedPlayer = { id: String(index + 1), raw, name };
    Object.entries(columns).forEach(([key, header]) => {
      if (!header) return;
      const value = raw[header];
      player[key] = NUMERIC.has(key) ? number(value) : value;
    });
    const parsedValue = money(raw[columns.valueM ?? ""]);
    player.valueLowM = parsedValue.low;
    player.valueHighM = parsedValue.high;
    player.valueM = parsedValue.mid;
    player.transferValueStatus = parsedValue.status;
    player.wageK = wage(raw[columns.wageK ?? ""]);
    const average = (a: string, b: string) => typeof player[a] === "number" && typeof player[b] === "number" ? ((player[a] as number) + (player[b] as number)) / 2 : undefined;
    player.spd = average("pac", "acc"); player.work = average("wor", "sta"); player.setP = average("jum", "bra");
    players.push(player);
  });
  return { players, skippedRows };
}

export async function importFMFiles(files: File[], onProgress: (message: string, percent: number) => void) {
  const allRows: RawPlayer[] = [], allHeaders = new Set<string>(), names: string[] = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    if (!/\.html?$/i.test(file.name)) throw new Error(`${file.name}: upload an FM HTML export.`);
    names.push(file.name);
    const parsed = await parseHTML(file, (percent) => onProgress(`Reading ${file.name}`, Math.round(((index + percent / 100) / files.length) * 100)));
    parsed.headers.forEach((header) => allHeaders.add(header));
    for (const row of parsed.rows) allRows.push(row);
  }
  const headers = [...allHeaders], columns = mapColumns(headers);
  const missingRequired = REQUIRED.filter((key) => !columns[key]);
  if (missingRequired.length) throw new Error(`Missing required columns: ${missingRequired.join(", ")}.`);
  const missingUseful = [...USEFUL, "consistency", "importantMatches", "pressure", "professionalism"].filter((key) => !columns[key]);
  const { players, skippedRows } = normalize(allRows, columns);
  const report: ValidationReport = {
    files: names, playerCount: players.length, detectedColumns: headers, normalizedColumns: Object.keys(columns).filter((key) => columns[key]),
    missingRequired, missingUseful,
    messages: [`Large file imported successfully.`, `${players.length.toLocaleString()} named players imported.`, ...(skippedRows ? [`${skippedRows.toLocaleString()} masked rows skipped because name or position was hidden.`] : []), `${headers.length} columns detected.`, `${Object.keys(columns).filter((key) => columns[key]).length} columns used for scoring.`, ...(missingUseful.length ? ["Some scoring categories skipped because columns were missing."] : [])],
  };
  return { players, report };
}
