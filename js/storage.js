/* localStorage persistence and the share link format.
   A shared list is compact JSON, encoded as base64url in the URL hash. */

import { listTotal } from './cost.js';
import { sanitizeList } from './state.js';

const SAVED_KEY = 'bos.saved.v1';
const CURRENT_KEY = 'bos.current.v1';
const MAX_SAVED = 30;

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token) {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(token.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function toCompact(list) {
  return {
    v: 1,
    n: list.name,
    g: list.gameSize,
    s: list.side,
    f: list.subfaction,
    u: (list.soldiers || []).map((soldier) => ({
      d: soldier.uid,
      i: soldier.unitId,
      h: soldier.horse ? 1 : 0,
      v: soldier.voisko || '',
      e: soldier.items || [],
      c: soldier.isCommander ? 1 : 0,
      k: soldier.nickname || ''
    }))
  };
}

export function fromCompact(compact) {
  if (!compact || compact.v !== 1) return null;
  return {
    name: compact.n,
    gameSize: compact.g,
    side: compact.s,
    subfaction: compact.f,
    soldiers: (compact.u || []).map((soldier) => ({
      uid: soldier.d,
      unitId: soldier.i,
      horse: soldier.h === 1,
      voisko: soldier.v || '',
      items: soldier.e || [],
      isCommander: soldier.c === 1,
      nickname: soldier.k || ''
    }))
  };
}

export function encodeList(list) {
  return toBase64Url(JSON.stringify(toCompact(list)));
}

export function decodeList(token) {
  try {
    const compact = JSON.parse(fromBase64Url(token));
    const raw = fromCompact(compact);
    return raw ? sanitizeList(raw) : null;
  } catch {
    return null;
  }
}

export function parseShareHash(hash = '') {
  const match = String(hash).replace(/^#/, '').match(/(?:^|&)list=([^&]+)/);
  if (!match) return null;
  try {
    return decodeList(decodeURIComponent(match[1]));
  } catch {
    return decodeList(match[1]);
  }
}

export function shareUrl(list, base) {
  const fallback = 'https://arkanumduels.github.io/blood-on-snow-builder/';
  let url;
  try {
    url = new URL(base || globalThis.location?.href || fallback);
  } catch {
    url = new URL(fallback);
  }
  url.hash = `list=${encodeList(list)}`;
  return url.href;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveCurrent(list) {
  return writeJson(CURRENT_KEY, toCompact(list));
}

export function loadCurrent() {
  const compact = readJson(CURRENT_KEY);
  const raw = compact ? fromCompact(compact) : null;
  return raw ? sanitizeList(raw) : null;
}

export function saveNamed(list) {
  const entries = readJson(SAVED_KEY);
  const saved = Array.isArray(entries) ? entries : [];
  const entry = {
    id: `save-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: list.name?.trim() || 'Untitled Detachment',
    savedAt: new Date().toISOString(),
    compact: toCompact(list)
  };
  saved.unshift(entry);
  const ok = writeJson(SAVED_KEY, saved.slice(0, MAX_SAVED));
  return { ok, entry };
}

export function getSavedLists() {
  const entries = readJson(SAVED_KEY);
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && entry.id && entry.compact)
    .map((entry) => {
      const list = sanitizeList(fromCompact(entry.compact) || {});
      return {
        id: entry.id,
        name: entry.name || list.name,
        savedAt: entry.savedAt,
        gameSize: list.gameSize,
        total: listTotal(list),
        side: list.side,
        list
      };
    });
}

export function loadSaved(id) {
  const found = getSavedLists().find((entry) => entry.id === id);
  return found ? sanitizeList(found.list) : null;
}

export function deleteSaved(id) {
  const entries = readJson(SAVED_KEY);
  if (!Array.isArray(entries)) return false;
  return writeJson(SAVED_KEY, entries.filter((entry) => entry.id !== id));
}

export function clearCurrent() {
  try {
    localStorage.removeItem(CURRENT_KEY);
    return true;
  } catch {
    return false;
  }
}
