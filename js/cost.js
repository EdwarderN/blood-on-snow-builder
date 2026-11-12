/* All points arithmetic lives here. Nothing in the UI should add up points itself. */

import { data } from './data.js';

export function getSide(sideId) {
  return data.sideById.get(sideId) || null;
}

export function getSubfaction(list) {
  if (!list?.side || !list?.subfaction) return null;
  const sub = data.subfactionById.get(list.subfaction);
  return sub && sub.sideId === list.side ? sub : null;
}

export function getModifiers(list) {
  return getSubfaction(list)?.modifiers || [];
}

export function isMounted(unit, soldier) {
  return Boolean(unit?.tags?.includes('mounted') || soldier?.horse);
}

export function unitPoints(unitId, list) {
  const unit = data.unitById.get(unitId);
  if (!unit) return 0;
  const discount = getModifiers(list)
    .filter((m) => m.type === 'unitDiscount' && m.unit === unitId)
    .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  return Math.max(0, unit.points - discount);
}

export function horsePoints(list) {
  const modifier = getModifiers(list).find((m) => m.type === 'horseCost');
  return modifier ? Math.max(0, Number(modifier.amount) || 0) : (Number(data.rules.horseCost) || 0);
}

export function itemPoints(itemId, list) {
  const item = data.itemById.get(itemId);
  if (!item) return 0;
  const modifiers = getModifiers(list);
  let points = Number(item.points) || 0;

  for (const m of modifiers) {
    if (m.type === 'itemCost' && m.item === itemId) points = Number(m.cost) || 0;
  }
  for (const m of modifiers) {
    if (m.type === 'itemDiscount' && m.item === itemId) points -= Number(m.amount) || 0;
  }
  for (const m of modifiers) {
    if (m.type === 'equipmentDiscount') points -= Number(m.amount) || 0;
  }
  return Math.max(0, points);
}

export function soldierCost(soldier, list) {
  if (!soldier) return 0;
  let total = unitPoints(soldier.unitId, list);
  if (soldier.horse) total += horsePoints(list);
  for (const itemId of soldier.items || []) total += itemPoints(itemId, list);
  return total;
}

export function listTotal(list) {
  return (list?.soldiers || []).reduce((sum, soldier) => sum + soldierCost(soldier, list), 0);
}

export function getCommander(list) {
  return (list?.soldiers || []).find((soldier) => soldier.isCommander) || null;
}
