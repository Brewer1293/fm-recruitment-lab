import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { createGzip } from "node:zlib";

const ALIASES = {
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
const TEXT_FIELDS = new Set(["name", "dob", "club", "nationality", "secondNationality", "based", "basedIn", "division", "position", "personality", "mediaDescription", "mediaHandling", "preferredFoot", "leftFoot", "rightFoot", "contractType", "contractStarted", "contractExpires", "playingTime", "injury", "injuryRisk", "fatigue", "morale", "height", "uid"]);
const NUMERIC = new Set(Object.keys(ALIASES).filter((key) => !TEXT_FIELDS.has(key)));
const REQUIRED = ["name", "position"];
const USEFUL = ["age", "club", "nationality", "basedIn", "division", "uid", "valueM", "wageK", "minutes", "averageRating", "preferredFoot", "leftFoot", "rightFoot"];

const input = resolve(process.argv[2] ?? "");
const outDir = resolve(process.argv[3] ?? "public/default-data");
if (!process.argv[2]) throw new Error("Usage: node scripts/build-default-dataset.mjs /path/to/export.html [out-dir]");

const clean = (value) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
const norm = (value) => clean(value).toLowerCase().replace(/\.\d+$/, "").trim();
const number = (value) => {
  if (!value || value === "-") return undefined;
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
};
const money = (value) => {
  if (!value) return { status: "missing" };
  const cleaned = String(value).replace(/,/g, "").replace(/£/g, "").trim();
  if (/not for sale/i.test(cleaned) || /^nfs$/i.test(cleaned)) return { status: "not_for_sale" };
  const values = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*([km]?)/gi)].map((match) => {
    const amount = Number(match[1]);
    const suffix = match[2].toLowerCase();
    return suffix === "m" ? amount : suffix === "k" ? amount / 1000 : amount > 1000 ? amount / 1_000_000 : amount;
  });
  if (!values.length) return { status: "missing" };
  const low = Math.min(...values), high = Math.max(...values);
  return { low, high, mid: (low + high) / 2, status: low === high ? "fixed" : "range" };
};
const wage = (value) => {
  if (!value) return undefined;
  const match = String(value).replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([km]?)/i);
  if (!match) return undefined;
  const amount = Number(match[1]), suffix = match[2].toLowerCase();
  return suffix === "m" ? amount * 1000 : suffix === "k" ? amount : amount / 1000;
};
const validText = (value) => {
  const text = clean(value ?? "");
  return Boolean(text && text !== "-" && text !== "- -" && !/^unknown player/i.test(text));
};
const cells = (row) => [...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((match) => clean(match[1]));
const uniqueHeaders = (headers) => {
  const seen = new Map();
  return headers.map((header) => {
    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    return count ? `${header}.${count}` : header;
  });
};
function mapColumns(headers) {
  const normalized = new Map();
  headers.forEach((header) => normalized.set(norm(header), [...(normalized.get(norm(header)) ?? []), header]));
  return Object.fromEntries(Object.entries(ALIASES).map(([key, aliases]) => {
    for (const alias of aliases) {
      const matches = normalized.get(alias);
      if (!matches?.length) continue;
      if (key === "nat" && alias === "nat" && matches.length > 1) return [key, matches[1]];
      return [key, matches[0]];
    }
    return [key, undefined];
  }));
}
function normalizeRow(values, headers, columns, id) {
  const rawValue = (key) => {
    const header = columns[key];
    return header ? values[headers.indexOf(header)] ?? "" : "";
  };
  const name = rawValue("name"), position = rawValue("position");
  if (!validText(name) || !validText(position)) return undefined;
  const player = { id: String(id), name };
  for (const [key, header] of Object.entries(columns)) {
    if (!header) continue;
    const value = values[headers.indexOf(header)] ?? "";
    player[key] = NUMERIC.has(key) ? number(value) : value;
  }
  const parsedValue = money(rawValue("valueM"));
  player.valueLowM = parsedValue.low;
  player.valueHighM = parsedValue.high;
  player.valueM = parsedValue.mid;
  player.transferValueStatus = parsedValue.status;
  player.wageK = wage(rawValue("wageK"));
  const average = (a, b) => typeof player[a] === "number" && typeof player[b] === "number" ? (player[a] + player[b]) / 2 : undefined;
  player.spd = average("pac", "acc");
  player.work = average("wor", "sta");
  player.setP = average("jum", "bra");
  for (const key of Object.keys(player)) if (player[key] === undefined || player[key] === "") delete player[key];
  return player;
}
async function parseHtml(filePath) {
  const source = createReadStream(filePath, { encoding: "utf8", highWaterMark: 1024 * 1024 });
  const fileSize = (await stat(filePath)).size;
  let buffer = "", loaded = 0, inTable = false, headers = undefined, columns = undefined, rowIndex = 0, skippedRows = 0;
  const players = [];
  for await (const chunk of source) {
    loaded += Buffer.byteLength(chunk);
    buffer += chunk;
    if (!inTable) {
      const table = buffer.search(/<table\b/i);
      if (table < 0) {
        buffer = buffer.slice(-1024);
        continue;
      }
      inTable = true;
      buffer = buffer.slice(table);
    }
    let end = buffer.search(/<\/tr>/i);
    while (end >= 0) {
      const row = buffer.slice(0, end + 5);
      buffer = buffer.slice(end + 5);
      const values = cells(row);
      if (values.length) {
        if (!headers) {
          headers = uniqueHeaders(values);
          columns = mapColumns(headers);
          const missingRequired = REQUIRED.filter((key) => !columns[key]);
          if (missingRequired.length) throw new Error(`Missing required columns: ${missingRequired.join(", ")}.`);
        } else {
          rowIndex += 1;
          const player = normalizeRow(values, headers, columns, rowIndex);
          if (player) players.push(player);
          else skippedRows += 1;
        }
      }
      end = buffer.search(/<\/tr>/i);
    }
    if (players.length && players.length % 10000 === 0) {
      const percent = Math.round((loaded / fileSize) * 100);
      console.log(`${players.length.toLocaleString()} players parsed (${percent}%)`);
    }
  }
  if (!headers || !columns) throw new Error("No table found in HTML export.");
  const missingUseful = [...USEFUL, "consistency", "importantMatches", "pressure", "professionalism"].filter((key) => !columns[key]);
  return {
    players,
    report: {
      files: [basename(filePath)],
      playerCount: players.length,
      detectedColumns: headers,
      normalizedColumns: Object.keys(columns).filter((key) => columns[key]),
      missingRequired: REQUIRED.filter((key) => !columns[key]),
      missingUseful,
      messages: [
        "Default database loaded from Cloudflare R2.",
        `${players.length.toLocaleString()} named players imported.`,
        ...(skippedRows ? [`${skippedRows.toLocaleString()} masked rows skipped because name or position was hidden.`] : []),
        `${headers.length} columns detected.`,
        `${Object.keys(columns).filter((key) => columns[key]).length} columns used for scoring.`,
        ...(missingUseful.length ? ["Some scoring categories skipped because columns were missing."] : []),
      ],
    },
  };
}
async function writeGzipJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await new Promise((resolvePromise, reject) => {
    const gzip = createGzip({ level: 9 });
    const out = createWriteStream(filePath);
    gzip.on("error", reject);
    out.on("error", reject);
    out.on("finish", resolvePromise);
    gzip.pipe(out);
    gzip.end(JSON.stringify(value));
  });
}

const started = Date.now();
console.log(`Parsing ${input}`);
const { players, report } = await parseHtml(input);
const generatedAt = new Date().toISOString();
const version = `default-${generatedAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`;
const dataset = { version, generatedAt, sourceFile: basename(input), players, report };
const metadata = { version, generatedAt, sourceFile: basename(input), playerCount: players.length, url: "datasets/default-players.json.gz" };
const dataPath = resolve(outDir, "default-players.json.gz");
const metadataPath = resolve(outDir, "default-metadata.json");
await writeGzipJson(dataPath, dataset);
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
const dataStat = await stat(dataPath);
console.log(JSON.stringify({ players: players.length, version, dataPath, metadataPath, gzipBytes: dataStat.size, seconds: Math.round((Date.now() - started) / 1000) }, null, 2));
