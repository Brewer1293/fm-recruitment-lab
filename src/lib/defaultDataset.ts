import type { NormalizedPlayer, ValidationReport } from "./types";

const DEFAULT_DATA_BASE_URL = "https://assets.brewerlabs.uk/datasets";
const DB_NAME = "fm-recruitment-default-db";
const STORE_NAME = "datasets";
const CACHE_KEY = "default";

export type DefaultDatasetMetadata = {
  version: string;
  generatedAt: string;
  sourceFile: string;
  playerCount: number;
  url: string;
};

export type DefaultDataset = {
  version: string;
  generatedAt: string;
  sourceFile: string;
  players: NormalizedPlayer[];
  report: ValidationReport;
};

type CachedDataset = {
  metadata: DefaultDatasetMetadata;
  dataset: DefaultDataset;
};

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function openDb() {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}

async function getCachedDataset() {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const cached = await request<CachedDataset | undefined>(tx.objectStore(STORE_NAME).get(CACHE_KEY));
  db.close();
  return cached;
}

async function setCachedDataset(value: CachedDataset) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(value, CACHE_KEY);
  await txDone(tx);
  db.close();
}

export async function clearCachedDefaultDataset() {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(CACHE_KEY);
  await txDone(tx);
  db.close();
}

async function readGzipJson(response: Response) {
  if (!response.body) throw new Error("This browser cannot stream the default database download.");
  if (!("DecompressionStream" in window)) throw new Error("This browser cannot decompress the default database.");
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as DefaultDataset;
}

export async function loadDefaultDataset(onProgress?: (message: string, percent: number) => void) {
  onProgress?.("Checking default database", 5);
  const metadataResponse = await fetchDataset(`${DEFAULT_DATA_BASE_URL}/default-metadata.json`, { cache: "no-cache" });
  if (!metadataResponse.ok) throw new Error(`Default database metadata unavailable (${metadataResponse.status}).`);
  const metadata = await metadataResponse.json() as DefaultDatasetMetadata;
  const cached = await getCachedDataset();
  if (cached?.metadata.version === metadata.version) {
    onProgress?.("Loading cached default database", 100);
    return cached.dataset;
  }

  onProgress?.("Downloading default database", 20);
  const datasetResponse = await fetchDataset(`${DEFAULT_DATA_BASE_URL}/${metadata.url.replace(/^datasets\//, "")}`, { cache: "force-cache" });
  if (!datasetResponse.ok) throw new Error(`Default database unavailable (${datasetResponse.status}).`);
  onProgress?.("Decompressing default database", 55);
  const dataset = await readGzipJson(datasetResponse);
  onProgress?.("Caching default database", 80);
  await setCachedDataset({ metadata, dataset });
  onProgress?.("Default database ready", 100);
  return dataset;
}

async function fetchDataset(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new Error(`Could not reach the default database at assets.brewerlabs.uk. The R2 files are uploaded, but this browser/DNS connection cannot resolve the asset domain yet.`);
  }
}
