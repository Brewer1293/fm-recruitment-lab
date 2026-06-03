import clubUidMap from "./generated/clubUidMap.json";
import type { NormalizedPlayer } from "./types";

const ASSET_BASE_URL = "https://assets.brewerlabs.uk";

const countryCodeAliases: Record<string, string> = {
  eng: "eng", england: "eng",
  sco: "sco", scotland: "sco",
  wal: "wal", wales: "wal",
  nir: "nir", "n ireland": "nir", "northern ireland": "nir",
  irl: "irl", ireland: "irl",
  fra: "fra", france: "fra",
  esp: "esp", spain: "esp",
  ger: "ger", germany: "ger",
  ita: "ita", italy: "ita",
  ned: "ned", netherlands: "ned", holland: "ned",
  por: "por", portugal: "por",
  bel: "bel", belgium: "bel",
  tur: "tur", turkiye: "tur", turkey: "tur",
  usa: "usa", "u s a": "usa", "united states": "usa",
  bra: "bra", brazil: "bra",
  arg: "arg", argentina: "arg",
  nor: "nor", norway: "nor",
  den: "den", denmark: "den",
  swe: "swe", sweden: "swe",
  pol: "pol", poland: "pol",
  cro: "cro", croatia: "cro",
  srb: "srb", serbia: "srb",
  sui: "sui", switzerland: "sui",
  aut: "aut", austria: "aut",
  gre: "gre", greece: "gre",
  cze: "cze", "czech republic": "cze", czechia: "cze",
  ukr: "ukr", ukraine: "ukr",
  mex: "mex", mexico: "mex",
  egy: "egy", egypt: "egy",
  alg: "alg", algeria: "alg",
  mar: "mar", morocco: "mar",
  nga: "nga", nigeria: "nga",
  gha: "gha", ghana: "gha",
  sen: "sen", senegal: "sen",
  cmr: "cmr", cameroon: "cmr",
  col: "col", colombia: "col",
  uru: "uru", uruguay: "uru",
  chi: "chi", chile: "chi",
  jpn: "jpn", japan: "jpn",
  kor: "kor", "south korea": "kor",
  aus: "aus", australia: "aus",
};

const nationUidByKey: Record<string, string> = {
  afg: "106", afghanistan: "106",
  alb: "752", albania: "752",
  alg: "5", algeria: "5",
  and: "753", andorra: "753",
  ang: "6", angola: "6",
  arg: "1649", argentina: "1649",
  arm: "754", armenia: "754",
  aus: "1435", australia: "1435",
  aut: "755", austria: "755",
  aze: "756", azerbaijan: "756",
  bel: "757", belgium: "757",
  bih: "759", bosnia: "759", "bosnia and herzegovina": "759",
  bol: "1650", bolivia: "1650",
  bra: "1651", brazil: "1651",
  bul: "760", bulgaria: "760",
  cam: "11", cmr: "11", cameroon: "11",
  can: "364", canada: "364",
  chi: "1652", chile: "1652",
  chn: "110", china: "110",
  col: "1653", colombia: "1653",
  crc: "366", "costa rica": "366",
  cro: "761", croatia: "761",
  cyp: "762", cyprus: "762",
  cze: "763", "czech republic": "763", czechia: "763",
  den: "764", denmark: "764",
  ecu: "1654", ecuador: "1654",
  egy: "16", egypt: "16",
  eng: "765", england: "765",
  est: "766", estonia: "766",
  fin: "768", finland: "768",
  fra: "769", france: "769",
  geo: "770", georgia: "770",
  ger: "771", germany: "771",
  gha: "21", ghana: "21",
  gre: "772", greece: "772",
  hun: "773", hungary: "773",
  isl: "774", iceland: "774",
  ind: "112", india: "112",
  irl: "789", ireland: "789",
  isr: "775", israel: "775",
  ita: "776", italy: "776",
  civ: "24", "ivory coast": "24", "cote d ivoire": "24",
  jam: "377", jamaica: "377",
  jpn: "116", japan: "116",
  kor: "135", "south korea": "135",
  lat: "777", lva: "777", latvia: "777",
  ltu: "779", lithuania: "779",
  mex: "379", mexico: "379",
  ned: "784", netherlands: "784", holland: "784",
  nir: "785", "n ireland": "785", "northern ireland": "785",
  nor: "786", norway: "786",
  par: "1655", paraguay: "1655",
  per: "1656", peru: "1656",
  pol: "787", poland: "787",
  por: "788", portugal: "788",
  rou: "790", romania: "790",
  rus: "791", russia: "791",
  sco: "793", scotland: "793",
  sen: "41", senegal: "41",
  srb: "802", serbia: "802",
  svk: "794", slovakia: "794",
  svn: "795", slovenia: "795",
  rsa: "45", "south africa": "45",
  esp: "796", spain: "796",
  swe: "797", sweden: "797",
  sui: "798", switzerland: "798",
  tun: "51", tunisia: "51",
  tur: "799", turkey: "799", turkiye: "799",
  ukr: "800", ukraine: "800",
  uru: "1657", uruguay: "1657",
  usa: "390", "u s a": "390", "united states": "390",
  wal: "801", wales: "801",
};

export function normaliseAssetKey(value?: string) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function countryKey(value?: string) {
  const normalised = normaliseAssetKey(value);
  return countryCodeAliases[normalised] ?? normalised;
}

export function resolveClubUid(player: Pick<NormalizedPlayer, "club" | "basedIn" | "based" | "division">) {
  if (!player.club) return undefined;
  const club = normaliseAssetKey(player.club);
  const contexts = [
    countryKey(player.basedIn),
    countryKey(player.based),
    normaliseAssetKey(player.based).replace(/\s.*$/, ""),
  ].filter(Boolean);
  for (const context of contexts) {
    const uid = (clubUidMap as Record<string, string>)[`${club}|${context}`];
    if (uid) return uid;
  }
  return undefined;
}

export function resolveNationUid(value?: string) {
  const key = normaliseAssetKey(value);
  return nationUidByKey[key] ?? nationUidByKey[countryKey(key)];
}

export function playerFaceUrl(player: Pick<NormalizedPlayer, "uid">) {
  return player.uid ? `${ASSET_BASE_URL}/faces/players/${String(player.uid).replace(/,/g, "")}.png` : undefined;
}

export function clubLogoUrl(player: Pick<NormalizedPlayer, "club" | "basedIn" | "based" | "division">) {
  const uid = resolveClubUid(player);
  return uid ? `${ASSET_BASE_URL}/logos/clubs/${uid}.png` : undefined;
}

export function nationLogoUrl(player: Pick<NormalizedPlayer, "nationality">) {
  const uid = resolveNationUid(player.nationality);
  return uid ? `${ASSET_BASE_URL}/logos/nations/${uid}.png` : undefined;
}
