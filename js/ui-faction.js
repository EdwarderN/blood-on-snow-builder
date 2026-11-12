/* Faction picker, faction rules and the collapsed army summary. */

import { data } from './data.js';
import { getSide, getSubfaction } from './cost.js';
import { escapeHtml } from './format.js';
import { traitHtml } from './ui-parts.js';

function sideChoiceHtml(side, list) {
  const selected = list.side === side.id;
  return `
    <button class="panel side-choice${selected ? ' selected' : ''}" type="button" data-side="${escapeHtml(side.id)}">
      <span class="side-name">${escapeHtml(side.name)}</span>
      <span class="side-meta">${side.factionRules.length} faction ${side.factionRules.length === 1 ? 'rule' : 'rules'} · ${side.subfactions.length} subfactions</span>
      <span class="side-rules">${side.factionRules.map((rule) => escapeHtml(rule.name)).join(' · ')}</span>
    </button>`;
}

function pickerHtml(list) {
  const side = getSide(list.side);
  if (!side) {
    return `
      <div class="hero">
        <figure class="frame hero-cover"><img src="assets/img/cover.jpg" alt="Blood on Snow cover star"></figure>
        <div class="hero-copy">
          <span class="h-kicker">Blood on Snow · Army Builder</span>
          <h1 class="h-page">Choose your side</h1>
          <p class="lede">Build a detachment for the Russian Civil War.</p>
          <div class="side-grid">${data.factions.sides.map((entry) => sideChoiceHtml(entry, list)).join('')}</div>
          <div class="sidebar"><p>Pick a side, then a subfaction. Your work is saved in this browser as you go.</p></div>
        </div>
      </div>`;
  }

  const sub = getSubfaction(list);
  return `
    <div class="army-picker">
      <div class="army-picker-head">
        <span class="h-kicker">Army</span>
        <h1 class="h-page">Choose your side</h1>
      </div>
      <div class="side-grid">${data.factions.sides.map((entry) => sideChoiceHtml(entry, list)).join('')}</div>
      <div class="panel faction-rules">
        <h4>${escapeHtml(side.name)} faction rules</h4>
        ${side.factionRules.map((rule) => traitHtml(rule)).join('')}
      </div>
      <h2 class="h-section">Subfaction</h2>
      <p class="note">Each subfaction adds two rules and may change points.</p>
      <div class="subfaction-grid">
        ${side.subfactions.map((entry) => `
          <button class="panel subfaction-card${sub?.id === entry.id ? ' selected' : ''}" type="button" data-sub="${escapeHtml(entry.id)}">
            <span class="subfaction-head">
              <span class="subfaction-name">${escapeHtml(entry.name)}</span>
              ${sub?.id === entry.id ? '<span class="selected-mark">Selected</span>' : ''}
            </span>
            ${entry.rules.map((rule) => `<span class="rule"><span class="trait-name">${escapeHtml(rule.name)}</span> <span class="rule-text">${escapeHtml(rule.text)}</span></span>`).join('')}
          </button>`).join('')}
      </div>
      <div class="picker-actions">
        <button class="btn" type="button" data-action="close-picker"${sub ? '' : ' disabled'}>View detachment</button>
      </div>
    </div>`;
}

function summaryHtml(list) {
  const side = getSide(list.side);
  const sub = getSubfaction(list);
  return `
    <div class="army-summary">
      <div class="army-summary-main">
        <span class="h-kicker">Army</span>
        <span class="army-title">${escapeHtml(side.name)}<span class="army-dot">·</span>${escapeHtml(sub?.name || 'No subfaction')}</span>
      </div>
      <button class="btn secondary" type="button" data-action="open-picker">Change army</button>
      <details class="army-rules">
        <summary>Faction &amp; subfaction rules</summary>
        <div class="army-rules-body">
          <div class="panel">
            <h4>${escapeHtml(side.name)} faction rules</h4>
            ${side.factionRules.map((rule) => traitHtml(rule)).join('')}
          </div>
          ${sub ? `<div class="panel">
            <h4>${escapeHtml(sub.name)} subfaction rules</h4>
            ${sub.rules.map((rule) => traitHtml(rule)).join('')}
          </div>` : ''}
        </div>
      </details>
    </div>`;
}

export function armyHtml(list, pickerOpen) {
  return pickerOpen || !list.side ? pickerHtml(list) : summaryHtml(list);
}
