/* The equipment picker. Invalid choices stay visible, greyed out, with the reason. */

import { data } from './data.js';
import { addItem } from './state.js';
import { itemPoints, isMounted } from './cost.js';
import { canAddItem } from './validate.js';
import { displayName, escapeHtml, pointsLabel, statsText, typeLabel, weaponProfile } from './format.js';
import { openModal, toast } from './ui-dialogs.js';

const GROUPS = [
  { title: 'Rifles', test: (item) => item.category === 'firearm' && item.type === 'rifle' },
  { title: 'Carbines', test: (item) => item.category === 'firearm' && item.type === 'carbine' },
  { title: 'Handguns', test: (item) => item.category === 'firearm' && item.type === 'handgun' },
  { title: 'Machine Guns', test: (item) => item.category === 'firearm' && item.type === 'mg' },
  { title: 'Upgrades', test: (item) => item.category === 'upgrade' },
  { title: 'Melee', test: (item) => item.category === 'other' && item.type === 'melee' },
  { title: 'Other', test: (item) => item.category === 'other' && item.type !== 'melee' }
];

function count(soldier, category) {
  return soldier.items
    .map((id) => data.itemById.get(id))
    .filter((item) => item?.category === category).length;
}

function imagePath(item) {
  return `assets/img/equipment/${item.id}.jpg`;
}

function itemHtml(item, soldier, list) {
  const check = canAddItem(list, soldier, item.id);
  const cost = itemPoints(item.id, list);
  const carried = soldier.items.filter((id) => id === item.id).length;
  const profile = weaponProfile(item);
  const original = cost < item.points ? `<s>${item.points}</s>` : '';
  const reason = check.ok ? '' : `<span class="disabled-reason">${escapeHtml(check.reason)}</span>`;
  return `
    <button class="equip-item${check.ok ? '' : ' disabled'}" type="button"
      data-item="${escapeHtml(item.id)}" aria-disabled="${check.ok ? 'false' : 'true'}"
      title="${escapeHtml(check.ok ? `Add ${item.name}` : check.reason)}">
      <span class="equip-img card-img weapon"><img src="${imagePath(item)}" alt="" loading="lazy" onerror="this.closest('.equip-img').remove()"></span>
      <span class="equip-main">
        <span class="equip-name">${escapeHtml(item.name)} <span class="equip-cost">${cost} pts ${original}</span></span>
        <span class="equip-profile">${escapeHtml(profile || typeLabel(item))}</span>
        ${item.note ? `<span class="note">${escapeHtml(item.note)}</span>` : ''}
        ${reason}
      </span>
      ${carried ? `<span class="equip-count">×${carried}</span>` : ''}
    </button>`;
}

function bodyHtml(list, soldier) {
  const unit = data.unitById.get(soldier.unitId);
  const mounted = isMounted(unit, soldier);
  const groups = GROUPS.map((group) => {
    const items = data.equipment.filter(group.test);
    if (!items.length) return '';
    return `
      <section class="equip-group">
        <h3 class="h-sub">${group.title}</h3>
        <div class="equip-grid">${items.map((item) => itemHtml(item, soldier, list)).join('')}</div>
      </section>`;
  }).join('');
  return `
    <div class="equip-context">
      <p class="note">${escapeHtml(statsText(unit, mounted))}</p>
      <p class="carry-line">Firearms <strong>${count(soldier, 'firearm')} / ${data.rules.carry.firearms}</strong>
        · Other items <strong>${count(soldier, 'other')} / ${data.rules.carry.otherItems}</strong></p>
    </div>
    ${groups}`;
}

export function openEquipmentDialog({ list, soldier, onChange }) {
  const unit = data.unitById.get(soldier.unitId);
  const api = openModal({
    title: `Equip ${displayName(unit, soldier)}`,
    body: bodyHtml(list, soldier),
    footer: `<button class="btn" type="button" data-close>Done</button>`,
    className: 'modal-sheet'
  });

  api.body.addEventListener('click', (event) => {
    const button = event.target.closest('[data-item]');
    if (!button) return;
    const item = data.itemById.get(button.dataset.item);
    if (!item) return;
    const check = canAddItem(list, soldier, item.id);
    if (!check.ok) {
      toast(check.reason);
      return;
    }
    addItem(list, soldier.uid, item.id);
    const scroll = api.body.scrollTop;
    api.body.innerHTML = bodyHtml(list, soldier);
    api.body.scrollTop = scroll;
    onChange?.();
    toast(`${item.name} added for ${pointsLabel(itemPoints(item.id, list))}.`);
  });
}
