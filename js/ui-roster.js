/* The printable roster. Black and white, A4, no pictures. */

import { data } from './data.js';
import { getCommander, getSide, getSubfaction, listTotal, soldierCost } from './cost.js';
import { displayName, escapeHtml, statsText, tickBoxes, typeLabel, weaponProfile } from './format.js';

function rulesBlock(side, sub) {
  return `
    <section class="roster-section">
      <h2>Faction rules</h2>
      <div class="roster-rules">
        <article>
          <h3>${escapeHtml(side.name)}</h3>
          ${side.factionRules.map((rule) => `<p><strong>${escapeHtml(rule.name)}.</strong> ${escapeHtml(rule.text)}</p>`).join('')}
        </article>
        ${sub ? `<article>
          <h3>${escapeHtml(sub.name)}</h3>
          ${sub.rules.map((rule) => `<p><strong>${escapeHtml(rule.name)}.</strong> ${escapeHtml(rule.text)}</p>`).join('')}
        </article>` : ''}
      </div>
    </section>`;
}

function soldierRow(soldier, list) {
  const unit = data.unitById.get(soldier.unitId);
  if (!unit) return '';
  const gear = soldier.items.map((id) => data.itemById.get(id)?.name).filter(Boolean);
  if (soldier.horse) gear.unshift('Horse');
  const notes = [];
  if (unit.tags?.includes('mounted')) notes.push('Mounted');
  if (soldier.voisko) notes.push(`Voisko: ${soldier.voisko}`);
  if (soldier.isCommander) notes.push('Commander');
  const trait = unit.trait
    ? `<strong>${escapeHtml(unit.trait.name)}.</strong> ${escapeHtml(unit.trait.text)}${unit.trait.commanderOnly && !soldier.isCommander ? ' <em>(Only while Commander.)</em>' : ''}`
    : '—';
  return `
    <tr>
      <td class="c-soldier">
        <strong>${escapeHtml(unit.name)}</strong>
        ${soldier.nickname ? `<span class="small">“${escapeHtml(soldier.nickname)}”</span>` : ''}
        ${notes.length ? `<span class="small">${escapeHtml(notes.join(' · '))}</span>` : ''}
      </td>
      <td class="c-stats">${escapeHtml(statsText(unit, soldier.horse || unit.tags?.includes('mounted')))}</td>
      <td class="c-gear">${gear.length ? gear.map((name) => escapeHtml(name)).join(', ') : '—'}</td>
      <td class="c-trait">${trait}</td>
      <td class="c-points">${soldierCost(soldier, list)}</td>
      <td class="c-conditions">
        ${tickBoxes(unit.e, 'Wnd')}
        ${tickBoxes(1, 'Shaken')}
        ${tickBoxes(1, 'Ammo')}
        ${tickBoxes(1, 'Jam')}
      </td>
    </tr>`;
}

function weaponTable(list) {
  const ids = new Set();
  for (const soldier of list.soldiers) for (const id of soldier.items) ids.add(id);
  const weapons = data.equipment.filter((item) => ids.has(item.id) && item.type);
  if (!weapons.length) return '';
  return `
    <section class="roster-section weapon-reference">
      <h2>Weapon reference</h2>
      <table class="table roster-table">
        <thead><tr><th>Weapon</th><th>Type</th><th>Profile</th><th>Notes</th></tr></thead>
        <tbody>
          ${weapons.map((item) => `
            <tr>
              <td><strong>${escapeHtml(item.name)}</strong></td>
              <td>${escapeHtml(typeLabel(item))}</td>
              <td>${escapeHtml(weaponProfile(item) || (item.type === 'melee' ? 'Melee' : '—'))}</td>
              <td>${escapeHtml(item.note || '')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

export function rosterHtml(list) {
  const side = getSide(list.side);
  const sub = getSubfaction(list);
  const total = listTotal(list);
  const commander = getCommander(list);
  const commanderUnit = commander && data.unitById.get(commander.unitId);
  if (!side) {
    return `<div class="roster-page"><h1>${escapeHtml(list.name)}</h1><p>No side chosen yet.</p></div>`;
  }

  return `
    <article class="roster-page">
      <header class="roster-head">
        <div>
          <span class="roster-kicker">Blood on Snow · Detachment Roster</span>
          <h1>${escapeHtml(list.name || 'Untitled Detachment')}</h1>
        </div>
        <div class="roster-meta">
          <span>${escapeHtml(side.name)} · ${escapeHtml(sub?.name || 'No subfaction')}</span>
          <strong>${total} / ${list.gameSize} pts</strong>
          <span>Commander: ${escapeHtml(commanderUnit ? displayName(commanderUnit, commander) : '—')}</span>
        </div>
      </header>

      ${rulesBlock(side, sub)}

      <section class="roster-section">
        <h2>Detachment</h2>
        <table class="table roster-table soldier-table">
          <thead>
            <tr><th>Soldier</th><th>Stats</th><th>Equipment</th><th>Trait</th><th>Pts</th><th>Cond.</th></tr>
          </thead>
          <tbody>${list.soldiers.map((soldier) => soldierRow(soldier, list)).join('')}</tbody>
        </table>
      </section>

      ${weaponTable(list)}

      <footer class="roster-foot">
        <span>Wnd: one box per point of E · Shaken · Ammo: Out of Ammo · Jam: Jammed</span>
        <span>${escapeHtml(list.name || 'Untitled Detachment')} · ${total} / ${list.gameSize} pts</span>
      </footer>
    </article>`;
}

export function renderRoster(list) {
  const host = document.getElementById('print-roster');
  if (host) host.innerHTML = rosterHtml(list);
}
