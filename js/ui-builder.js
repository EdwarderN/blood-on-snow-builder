/* The builder: detachment cards, live validation and all builder interactions. */

import { data } from './data.js';
import {
  addSoldier, applySide, duplicateSoldier, removeItemAt, removeSoldier,
  setCommander, setHorse, setNickname, setSubfaction, setVoisko
} from './state.js';
import {
  getSide, getSubfaction, horsePoints, isMounted, itemPoints,
  listTotal, soldierCost
} from './cost.js';
import { validate } from './validate.js';
import { openEquipmentDialog } from './ui-equipment.js';
import { openConfirm, toast } from './ui-dialogs.js';
import { armyHtml } from './ui-faction.js';
import { recruitHtml } from './ui-recruit.js';
import { displayName, escapeHtml, statsTable, typeLabel } from './format.js';
import { traitHtml, unitImage, unitTags } from './ui-parts.js';

let list = null;
let notify = () => {};
let pickerOpen = true;
let mobileView = 'recruit';

function itemPrice(itemId) {
  return itemPoints(itemId, list);
}

function itemListHtml(soldier) {
  if (!soldier.items.length) return '<p class="note">No equipment — this Soldier carries no firearm.</p>';
  return `<ul class="gear-list">${soldier.items.map((itemId, index) => {
    const item = data.itemById.get(itemId);
    if (!item) return '';
    return `<li>
      <span class="gear-name">${escapeHtml(item.name)}<span class="gear-type">${escapeHtml(typeLabel(item))}</span></span>
      <span class="gear-cost">${itemPrice(itemId)} pts</span>
      <button class="gear-remove" type="button" data-remove-item="${index}" aria-label="Remove ${escapeHtml(item.name)}">×</button>
    </li>`;
  }).join('')}</ul>`;
}

function soldierCard(soldier) {
  const unit = data.unitById.get(soldier.unitId);
  if (!unit) return '';
  const mounted = isMounted(unit, soldier);
  const traitInactive = Boolean(unit.trait?.commanderOnly && !soldier.isCommander);
  const horse = horsePoints(list);
  const choices = unit.trait?.choices || [];
  const controls = [];
  if (!unit.tags?.includes('mounted')) {
    controls.push(`
      <label class="check"><input type="checkbox" data-horse ${soldier.horse ? 'checked' : ''}> Horse <span class="note">(+${horse} pts)</span></label>`);
  } else {
    controls.push('<span class="note mounted-note">Mounted — horse included.</span>');
  }
  if (choices.length) {
    controls.push(`
      <label class="field-inline"><span>Voisko</span>
        <select class="input" data-voisko>
          <option value="">Choose host…</option>
          ${choices.map((choice) => `<option value="${escapeHtml(choice)}"${soldier.voisko === choice ? ' selected' : ''}>${escapeHtml(choice)}</option>`).join('')}
        </select>
      </label>`);
  }
  controls.push(`
    <label class="field-inline nickname-field"><span>Nickname</span>
      <input class="input" data-nickname maxlength="40" placeholder="Optional" value="${escapeHtml(soldier.nickname)}">
    </label>`);

  return `
    <article class="card soldier-card" data-uid="${escapeHtml(soldier.uid)}">
      <div class="soldier-top">
        ${unitImage(unit, 'soldier-figure')}
        <div class="soldier-main">
          <div class="card-h">
            <span class="nm">${escapeHtml(unit.name)}</span>
            ${unitTags(unit)}
            <span class="pts">${soldierCost(soldier, list)}</span>
          </div>
          ${statsTable(unit, mounted)}
          <label class="commander-toggle">
            <input type="radio" name="commander" data-commander value="${escapeHtml(soldier.uid)}"${soldier.isCommander ? ' checked' : ''}>
            Commander
          </label>
        </div>
      </div>
      <div class="soldier-controls">${controls.join('')}</div>
      ${traitHtml(unit.trait, traitInactive)}
      <div class="gear-block">
        ${itemListHtml(soldier)}
        <button class="btn secondary" type="button" data-equip>Add equipment</button>
      </div>
      <div class="card-actions">
        <button class="btn secondary" type="button" data-duplicate>Duplicate</button>
        <button class="btn secondary" type="button" data-delete>Delete</button>
      </div>
    </article>`;
}

function detachmentHtml() {
  const total = listTotal(list);
  return `
    <div class="panel-head">
      <h2 class="h-section">Detachment</h2>
      <span class="panel-count">${list.soldiers.length} ${list.soldiers.length === 1 ? 'Soldier' : 'Soldiers'} · ${total} ${total === 1 ? 'pt' : 'pts'}</span>
    </div>
    ${list.soldiers.length
      ? `<div class="soldier-grid">${list.soldiers.map(soldierCard).join('')}</div>`
      : '<div class="doc">DETACHMENT EMPTY. AWAITING RECRUITS.</div>'}`;
}

function validationHtml() {
  const result = validate(list);
  const { errors, warnings } = result;
  const messages = [
    ...errors.map((error) => `<p class="msg error">${escapeHtml(error.message)}</p>`),
    ...warnings.map((warning) => `<p class="msg warning">${escapeHtml(warning.message)}</p>`)
  ].join('');
  return `
    <button class="validation-summary" type="button" data-action="toggle-validation" aria-expanded="false">
      <span>${errors.length} ${errors.length === 1 ? 'error' : 'errors'} · ${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}</span>
      <span class="validation-chevron" aria-hidden="true">▾</span>
    </button>
    <div class="validation-body">
      <h2 class="h-section">List check</h2>
      ${messages || '<p class="note">No problems found. The detachment is legal so far.</p>'}
    </div>`;
}

function enhanceImages(root) {
  for (const img of root.querySelectorAll('img[data-optional-img]')) {
    const drop = () => img.closest('[data-img-frame]')?.remove();
    img.addEventListener('error', drop, { once: true });
    if (img.complete && img.naturalWidth === 0) drop();
  }
  for (const img of root.querySelectorAll('img[data-autotall]')) {
    const apply = () => {
      if (img.naturalHeight > img.naturalWidth * 1.15) {
        img.closest('.card-img, .soldier-figure')?.classList.add('tall');
      }
    };
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener('load', apply, { once: true });
  }
}

export function render() {
  const main = document.getElementById('main');
  if (!main || !list) return;
  const showBuilder = Boolean(list.side) && !pickerOpen;
  const tabs = `
    <div class="mobile-tabs" role="tablist" aria-label="Builder view">
      <button class="mobile-tab${mobileView === 'roster' ? ' active' : ''}" type="button" role="tab" aria-selected="${mobileView === 'roster'}" data-mobile-view="roster">Detachment <span>${list.soldiers.length}</span></button>
      <button class="mobile-tab${mobileView === 'recruit' ? ' active' : ''}" type="button" role="tab" aria-selected="${mobileView === 'recruit'}" data-mobile-view="recruit">Recruit</button>
    </div>`;
  main.innerHTML = `
    <section class="army-panel" aria-label="Army">${armyHtml(list, pickerOpen)}</section>
    ${showBuilder ? `
      <div class="builder-layout${mobileView === 'recruit' ? ' show-recruit' : ''}">
        ${tabs}
        <section class="recruit-panel" aria-label="Recruit Soldiers">${recruitHtml(list)}</section>
        <section class="detachment-panel" aria-label="Detachment">${detachmentHtml()}</section>
        <aside class="validation-panel" id="validation-panel" aria-label="List validation">${validationHtml()}</aside>
      </div>` : ''}`;
  enhanceImages(main);
}

function commit(message) {
  render();
  notify(list);
  if (message) toast(message);
}

function openPicker() {
  pickerOpen = true;
  render();
  document.querySelector('.army-panel')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function chooseSide(sideId) {
  const side = getSide(sideId);
  if (!side || list.side === sideId) return;
  const allowed = new Set(side.unitGroups);
  const removed = list.soldiers.filter((soldier) => !allowed.has(data.unitById.get(soldier.unitId)?.group)).length;
  const apply = () => {
    applySide(list, sideId);
    pickerOpen = true;
    commit(`Now building ${side.name}.`);
  };
  if (list.soldiers.length) {
    openConfirm({
      title: `Change to ${side.name}?`,
      body: removed
        ? `${removed} ${removed === 1 ? 'Soldier is' : 'Soldiers are'} not allowed in a ${escapeHtml(side.name)} list and will be removed. Their equipment will be lost.`
        : `All current Soldiers are allowed in a ${escapeHtml(side.name)} list, but the subfaction will be reset to ${escapeHtml(side.subfactions[0]?.name || 'the first choice')}.`,
      confirmLabel: 'Change side',
      onConfirm: apply
    });
  } else {
    apply();
  }
}

function removeWithConfirm(uid) {
  const soldier = list.soldiers.find((entry) => entry.uid === uid);
  const unit = data.unitById.get(soldier?.unitId);
  if (!soldier || !unit) return;
  openConfirm({
    title: 'Delete this Soldier?',
    body: `${escapeHtml(displayName(unit, soldier))} and all his equipment will be removed from the detachment.`,
    confirmLabel: 'Delete',
    onConfirm: () => {
      removeSoldier(list, uid);
      commit(`${unit.name} deleted.`);
    }
  });
}

export function setList(nextList) {
  list = nextList;
  pickerOpen = !list.side;
  mobileView = list.soldiers.length ? 'roster' : 'recruit';
  render();
}

export function getList() {
  return list;
}

export function mountBuilder({ initialList, onListChange }) {
  list = initialList;
  notify = onListChange;
  pickerOpen = !list.side;
  mobileView = list.soldiers.length ? 'roster' : 'recruit';
  const main = document.getElementById('main');

  main.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-mobile-view]');
    if (tab) {
      mobileView = tab.dataset.mobileView;
      render();
      document.querySelector(`[data-mobile-view="${mobileView}"]`)?.focus({ preventScroll: true });
      document.querySelector('.builder-layout')?.scrollIntoView({ block: 'start' });
      return;
    }

    const add = event.target.closest('[data-add-unit]');
    if (add) {
      const soldier = addSoldier(list, add.dataset.addUnit);
      if (soldier) {
        const unit = data.unitById.get(soldier.unitId);
        commit(`${unit.name} recruited.`);
      }
      return;
    }

    const sideButton = event.target.closest('[data-side]');
    if (sideButton) {
      chooseSide(sideButton.dataset.side);
      return;
    }

    const subButton = event.target.closest('[data-sub]');
    if (subButton) {
      if (setSubfaction(list, subButton.dataset.sub)) {
        pickerOpen = false;
        commit(`Subfaction: ${getSubfaction(list)?.name}.`);
      }
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'open-picker') { openPicker(); return; }
    if (action === 'close-picker') { pickerOpen = false; render(); return; }
    if (action === 'toggle-validation') {
      const panel = document.getElementById('validation-panel');
      panel.classList.toggle('open');
      const expanded = panel.classList.contains('open');
      panel.querySelector('.validation-summary').setAttribute('aria-expanded', String(expanded));
      return;
    }

    const card = event.target.closest('.soldier-card');
    if (!card) return;
    const uid = card.dataset.uid;

    if (event.target.closest('[data-equip]')) {
      const soldier = list.soldiers.find((entry) => entry.uid === uid);
      if (soldier) openEquipmentDialog({ list, soldier, onChange: () => commit() });
      return;
    }
    if (event.target.closest('[data-duplicate]')) {
      duplicateSoldier(list, uid);
      commit('Soldier duplicated.');
      return;
    }
    if (event.target.closest('[data-delete]')) {
      removeWithConfirm(uid);
      return;
    }
    const remove = event.target.closest('[data-remove-item]');
    if (remove) {
      const item = data.itemById.get(list.soldiers.find((entry) => entry.uid === uid)?.items[Number(remove.dataset.removeItem)]);
      if (removeItemAt(list, uid, Number(remove.dataset.removeItem))) commit(`${item?.name || 'Item'} removed.`);
    }
  });

  main.addEventListener('change', (event) => {
    const card = event.target.closest('.soldier-card');
    if (!card) return;
    const uid = card.dataset.uid;
    if (event.target.matches('[data-commander]')) {
      setCommander(list, uid);
      commit();
    } else if (event.target.matches('[data-horse]')) {
      setHorse(list, uid, event.target.checked);
      commit();
    } else if (event.target.matches('[data-voisko]')) {
      setVoisko(list, uid, event.target.value);
      commit();
    } else if (event.target.matches('[data-nickname]')) {
      setNickname(list, uid, event.target.value);
      notify(list);
    }
  });

  main.addEventListener('keydown', (event) => {
    const card = event.target.closest('[data-add-unit]');
    if (!card) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      card.click();
    }
  });

  render();
}
