/* The current list and every change made to it. All functions mutate the list they
   are given and return the same list, so the UI can re-render after each call. */

import { data } from './data.js';

export function newUid() {
  if (globalThis.crypto?.getRandomValues) {
    const words = new Uint32Array(2);
    globalThis.crypto.getRandomValues(words);
    return `${words[0].toString(36)}${words[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function newList(overrides = {}) {
  return {
    name: 'Untitled Detachment',
    gameSize: data.rules?.defaultGameSize || 500,
    side: null,
    subfaction: null,
    soldiers: [],
    ...overrides
  };
}

export function findSoldier(list, uid) {
  return list.soldiers.find((soldier) => soldier.uid === uid) || null;
}

export function addSoldier(list, unitId) {
  const unit = data.unitById.get(unitId);
  if (!unit || !list.side) return null;
  const side = data.sideById.get(list.side);
  if (!side?.unitGroups.includes(unit.group)) return null;

  const soldier = {
    uid: newUid(),
    unitId,
    horse: false,
    voisko: '',
    items: [],
    isCommander: !list.soldiers.some((entry) => entry.isCommander),
    nickname: ''
  };
  list.soldiers.push(soldier);
  return soldier;
}

export function duplicateSoldier(list, uid) {
  const source = findSoldier(list, uid);
  if (!source) return null;
  const copy = {
    ...source,
    uid: newUid(),
    items: [...source.items],
    isCommander: false
  };
  const index = list.soldiers.indexOf(source);
  list.soldiers.splice(index + 1, 0, copy);
  return copy;
}

export function removeSoldier(list, uid) {
  const index = list.soldiers.findIndex((soldier) => soldier.uid === uid);
  if (index === -1) return false;
  const [removed] = list.soldiers.splice(index, 1);
  if (removed.isCommander && list.soldiers.length) list.soldiers[0].isCommander = true;
  return true;
}

export function setCommander(list, uid) {
  for (const soldier of list.soldiers) soldier.isCommander = soldier.uid === uid;
}

export function setHorse(list, uid, horse) {
  const soldier = findSoldier(list, uid);
  const unit = soldier && data.unitById.get(soldier.unitId);
  if (!soldier || !unit || unit.tags?.includes('mounted')) return false;
  soldier.horse = Boolean(horse);
  return true;
}

export function setVoisko(list, uid, voisko) {
  const soldier = findSoldier(list, uid);
  if (!soldier) return false;
  const unit = data.unitById.get(soldier.unitId);
  const choices = unit?.trait?.choices || [];
  soldier.voisko = choices.includes(voisko) ? voisko : '';
  return true;
}

export function setNickname(list, uid, nickname) {
  const soldier = findSoldier(list, uid);
  if (!soldier) return false;
  soldier.nickname = String(nickname || '').slice(0, 40);
  return true;
}

export function addItem(list, uid, itemId) {
  const soldier = findSoldier(list, uid);
  if (!soldier || !data.itemById.has(itemId)) return false;
  soldier.items.push(itemId);
  return true;
}

export function removeItemAt(list, uid, index) {
  const soldier = findSoldier(list, uid);
  if (!soldier || index < 0 || index >= soldier.items.length) return false;
  soldier.items.splice(index, 1);
  return true;
}

export function applySide(list, sideId) {
  const side = data.sideById.get(sideId);
  if (!side) return { removed: 0 };
  if (list.side === side.id) return { removed: 0 };

  const allowed = new Set(side.unitGroups);
  const before = list.soldiers.length;
  list.soldiers = list.soldiers.filter((soldier) => {
    const unit = data.unitById.get(soldier.unitId);
    return unit && allowed.has(unit.group);
  });
  list.side = side.id;
  list.subfaction = side.subfactions?.[0]?.id || null;
  if (list.soldiers.length && !list.soldiers.some((soldier) => soldier.isCommander)) {
    list.soldiers[0].isCommander = true;
  }
  return { removed: before - list.soldiers.length };
}

export function setSubfaction(list, subfactionId) {
  const side = data.sideById.get(list.side);
  const sub = side?.subfactions?.find((entry) => entry.id === subfactionId);
  if (!sub) return false;
  list.subfaction = sub.id;
  return true;
}

export function setGameSize(list, size) {
  const value = Number(size);
  if (!data.rules.gameSizes.includes(value)) return false;
  list.gameSize = value;
  return true;
}

export function setName(list, name) {
  list.name = String(name ?? '').slice(0, 80);
  return list;
}

const isAllowedUnit = (unit, side) => Boolean(unit && side && side.unitGroups.includes(unit.group));

/* Turn saved, shared or hand-edited JSON into a list the app can trust.
   Unknown units and items are dropped; valid over-limit lists are preserved. */
export function sanitizeList(raw, options = {}) {
  const list = newList();
  if (!raw || typeof raw !== 'object') return list;

  list.name = typeof raw.name === 'string' && raw.name.trim()
    ? raw.name.trim().slice(0, 80)
    : (options.fallbackName || list.name);

  list.gameSize = data.rules.gameSizes.includes(Number(raw.gameSize))
    ? Number(raw.gameSize)
    : data.rules.defaultGameSize;

  const side = data.sideById.get(raw.side) || null;
  list.side = side?.id || null;
  if (side) {
    const requested = side.subfactions?.find((sub) => sub.id === raw.subfaction);
    list.subfaction = requested?.id || side.subfactions?.[0]?.id || null;
  }

  const usedUids = new Set();
  let commanderSeen = false;
  const soldiers = Array.isArray(raw.soldiers) ? raw.soldiers : [];
  for (const entry of soldiers) {
    if (!entry || typeof entry !== 'object') continue;
    const unit = data.unitById.get(entry.unitId);
    if (!isAllowedUnit(unit, side)) continue;

    let uid = typeof entry.uid === 'string' && entry.uid && !usedUids.has(entry.uid)
      ? entry.uid
      : newUid();
    usedUids.add(uid);

    const mountedUnit = unit.tags?.includes('mounted');
    const choices = unit.trait?.choices || [];
    const items = Array.isArray(entry.items)
      ? entry.items.filter((id) => typeof id === 'string' && data.itemById.has(id))
      : [];

    const isCommander = entry.isCommander === true && !commanderSeen;
    if (isCommander) commanderSeen = true;

    list.soldiers.push({
      uid,
      unitId: unit.id,
      horse: !mountedUnit && entry.horse === true,
      voisko: choices.includes(entry.voisko) ? entry.voisko : '',
      items,
      isCommander,
      nickname: typeof entry.nickname === 'string' ? entry.nickname.trim().slice(0, 40) : ''
    });
  }

  return list;
}
