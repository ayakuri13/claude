import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const STORE_PATH = new URL("../data/notified.json", import.meta.url);
const STORE_FILE = fileURLToPath(STORE_PATH);

const MAX_ENTRIES = 10000;

function ensureDir() {
  const dir = dirname(STORE_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function load() {
  ensureDir();
  if (!existsSync(STORE_FILE)) {
    return { notified_ids: [], updated_at: null };
  }
  return JSON.parse(readFileSync(STORE_FILE, "utf-8"));
}

function save(data) {
  ensureDir();
  writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function filterNewPosts(posts) {
  const store = load();
  const knownIds = new Set(store.notified_ids);

  const newPosts = posts.filter((p) => !knownIds.has(p.id));

  if (newPosts.length > 0) {
    const allIds = [...store.notified_ids, ...newPosts.map((p) => p.id)];
    // 古いエントリを削除して上限を超えないようにする
    const trimmed = allIds.length > MAX_ENTRIES ? allIds.slice(-MAX_ENTRIES) : allIds;
    save({ notified_ids: trimmed, updated_at: new Date().toISOString() });
  }

  return newPosts;
}
