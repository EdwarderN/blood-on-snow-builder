/* Every list-building rule check. Returns errors (the list is illegal) and
   warnings (advice only). The UI must never make up its own rules. */

import { data } from './data.js';
import { getCommander, getModifiers, getSide, isMounted, listTotal } from './cost.js';
import { displayName } from './format.js';

const itemOf = (id) => data.itemById.get(id);
const unitOf = (id) => data.unitById.get(id);

function carriedItems(soldier) {
  return (soldier.items || []).map(itemOf).filter(Boolean);
}

function countCategory(soldier, category) {
  return carriedItems(soldier).filter((item) => item.category === category).length;
}

function hasRequirement(soldier, requirement) {
  return carriedItems(soldier).some((item) => item.type === requirement || item.id === requirement);
}

function requiresLabel(requirement) {
  const names = { rifle: 'a rifle', carbine: 'a carbine', handgun: 'a handgun', mg: 'a machine gun', melee: 'a melee weapon' };
  return names[requirement] || itemOf(requirement)?.name || requirement;
}

function soldierLabel(soldier) {
  const unit = unitOf(soldier.unitId);
  return unit ? displayName(unit, soldier) : 'Unknown Soldier';
}

function hasNoLimit(list, limit) {
  return getModifiers(list).some((modifier) => modifier.type === 'noLimit' && modifier.limit === limit);
}

export function canAddItem(list, soldier, itemId) {
  const item = itemOf(itemId);
  if (!item) return { ok: false, reason: 'That item is not in the equipment list.' };
  if (!soldier) return { ok: false, reason: 'Choose a Soldier first.' };

  const unit = unitOf(soldier.unitId);
  const mounted = isMounted(unit, soldier);

  if (item.infantryOnly && mounted) {
    return { ok: false, reason: 'Infantry only — a mounted Soldier cannot take it.' };
  }
  if (item.mountedOnly && !mounted) {
    return { ok: false, reason: 'Mounted only — give this Soldier a Horse first.' };
  }
  if (item.category === 'firearm' && countCategory(soldier, 'firearm') >= data.rules.carry.firearms) {
    return { ok: false, reason: `Carry limit reached — ${data.rules.carry.firearms} firearms per Soldier.` };
  }
  if (item.category === 'other' && countCategory(soldier, 'other') >= data.rules.carry.otherItems) {
    return { ok: false, reason: `Carry limit reached — ${data.rules.carry.otherItems} other items per Soldier.` };
  }
  if (item.requires?.length) {
    const missing = item.requires.filter((requirement) => !hasRequirement(soldier, requirement));
    if (missing.length) {
      return { ok: false, reason: `Requires ${missing.map(requiresLabel).join(' and ')} first.` };
    }
  }
  return { ok: true, reason: '' };
}

export function validate(list) {
  const errors = [];
  const warnings = [];
  const total = listTotal(list);
  const soldiers = list?.soldiers || [];

  if (total > list.gameSize) {
    errors.push({ code: 'points', message: `The list is ${total - list.gameSize} points over the ${list.gameSize}-point limit.` });
  }
  if (!soldiers.length) return { errors, warnings, total };

  const commanders = soldiers.filter((soldier) => soldier.isCommander);
  if (!commanders.length) {
    errors.push({ code: 'commander-none', message: 'No Commander is chosen. Choose one Soldier as Commander.' });
  } else if (commanders.length > 1) {
    errors.push({ code: 'commander-multi', message: `${commanders.length} Soldiers are marked as Commander; choose exactly one.` });
  }

  for (const soldier of soldiers) {
    const unit = unitOf(soldier.unitId);
    if (!unit) continue;
    const label = soldierLabel(soldier);
    const items = carriedItems(soldier);

    if (!items.some((item) => item.category === 'firearm')) {
      errors.push({ code: 'no-firearm', soldierUid: soldier.uid, message: `${label} carries no firearm.` });
    }

    const firearms = items.filter((item) => item.category === 'firearm').length;
    const others = items.filter((item) => item.category === 'other').length;
    if (firearms > data.rules.carry.firearms) {
      errors.push({ code: 'carry-firearms', soldierUid: soldier.uid, message: `${label} carries ${firearms} firearms; the limit is ${data.rules.carry.firearms}.` });
    }
    if (others > data.rules.carry.otherItems) {
      errors.push({ code: 'carry-other', soldierUid: soldier.uid, message: `${label} carries ${others} other items; the limit is ${data.rules.carry.otherItems}.` });
    }

    const side = getSide(list.side);
    if (!side) {
      errors.push({ code: 'side-missing', soldierUid: soldier.uid, message: `Choose a side before recruiting ${unit.name}.` });
    } else if (!side.unitGroups.includes(unit.group)) {
      errors.push({ code: 'side', soldierUid: soldier.uid, message: `${unit.name} cannot be taken by a ${side.name} list.` });
    }

    const mounted = isMounted(unit, soldier);
    for (const item of items) {
      if (item.infantryOnly && mounted) {
        errors.push({ code: 'mounted-infantry-only', soldierUid: soldier.uid, itemId: item.id, message: `${label} is mounted and cannot take ${item.name} (infantry only).` });
      }
      if (item.mountedOnly && !mounted) {
        errors.push({ code: 'mounted-only', soldierUid: soldier.uid, itemId: item.id, message: `${label} is on foot and cannot take ${item.name} (mounted only).` });
      }
      if (item.requires?.length) {
        const missing = item.requires.filter((requirement) => !hasRequirement(soldier, requirement));
        if (missing.length) {
          errors.push({ code: 'requires', soldierUid: soldier.uid, itemId: item.id, message: `${label} cannot take ${item.name}; it requires ${missing.map(requiresLabel).join(' and ')}.` });
        }
      }
    }

    if (unit.tags?.includes('cossack') && !soldier.voisko) {
      errors.push({ code: 'voisko', soldierUid: soldier.uid, message: `${label} has no Voisko chosen.` });
    }
  }

  const machineGuns = soldiers.reduce((sum, soldier) => sum + carriedItems(soldier).filter((item) => item.type === 'mg').length, 0);
  const mgLimit = Math.floor(list.gameSize / (data.rules.mgPerPoints || 250));
  if (machineGuns > mgLimit) {
    errors.push({ code: 'mg-limit', message: `The list has ${machineGuns} machine guns; at ${list.gameSize} points at most ${mgLimit} are allowed.` });
  }

  const byUnit = new Map();
  for (const soldier of soldiers) byUnit.set(soldier.unitId, (byUnit.get(soldier.unitId) || 0) + 1);

  for (const [unitId, count] of byUnit) {
    const unit = unitOf(unitId);
    if (!unit) continue;
    if (unit.tags?.includes('character') && count > data.rules.maxPerList.character) {
      errors.push({ code: 'character-limit', unitId, message: `Only one ${unit.name} may be taken (${count} in the list).` });
    }
    if (unit.tags?.includes('cossack') && count > data.rules.maxPerList.cossack) {
      errors.push({ code: 'cossack-limit', unitId, message: `Only one Cossack may be taken (${count} in the list).` });
    }
  }

  const colourCount = soldiers.filter((soldier) => unitOf(soldier.unitId)?.tags?.includes('colourRegiment')).length;
  if (colourCount > data.rules.maxPerList.colourRegiments && !hasNoLimit(list, 'colourRegiments')) {
    errors.push({ code: 'colour-limit', message: `At most ${data.rules.maxPerList.colourRegiments} Colour Regiments may be taken (${colourCount} in the list).` });
  }

  const onlySoldier = soldiers.length === 1 ? soldiers[0] : null;
  if (onlySoldier && carriedItems(onlySoldier).some((item) => ['hotchkiss', 'maxim'].includes(item.id))) {
    warnings.push({ code: 'gun-crew', message: 'A Hotchkiss or Maxim needs a second Soldier to Assist. Add crew.' });
  }

  const commander = getCommander(list);
  const commandTraitUnits = soldiers
    .map((soldier) => unitOf(soldier.unitId))
    .filter((unit) => unit && ['officer', 'voenspets'].includes(unit.id));
  if (commander && commandTraitUnits.length) {
    const commanderUnit = unitOf(commander.unitId);
    if (!['officer', 'voenspets'].includes(commanderUnit?.id)) {
      warnings.push({ code: 'commander-trait', message: `The Commander is not an Officer or Voenspets, so ${commandTraitUnits[0].name}'s Commander trait is inactive.` });
    }
  }

  const spare = list.gameSize - total;
  if (spare > 25) {
    warnings.push({ code: 'under-points', message: `The list is ${spare} points under the game size — more than 25 points spare.` });
  }

  return { errors, warnings, total };
}
