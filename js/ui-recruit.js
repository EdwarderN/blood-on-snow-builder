/* The recruit list, grouped by which side may take each Soldier. */

import { data } from './data.js';
import { getSide, isMounted, unitPoints } from './cost.js';
import { escapeHtml, groupLabel, statsTable } from './format.js';
import { traitHtml, unitImage, unitTags } from './ui-parts.js';

const GROUPS = ['both', 'whites', 'reds', 'interventionists', 'internationals'];

function recruitCard(unit, list) {
  const cost = unitPoints(unit.id, list);
  const original = cost < unit.points ? `<s>${unit.points}</s>` : '';
  return `
    <article class="card unit-card" role="button" tabindex="0" data-add-unit="${escapeHtml(unit.id)}"
      aria-label="Recruit ${escapeHtml(unit.name)} for ${cost} points">
      ${unitImage(unit)}
      <div class="card-h">
        <span class="nm">${escapeHtml(unit.name)}</span>
        ${unitTags(unit)}
        <span class="pts">${cost} ${original}</span>
      </div>
      ${statsTable(unit, isMounted(unit, null))}
      ${traitHtml(unit.trait)}
      <span class="card-cta">Recruit</span>
    </article>`;
}

export function recruitHtml(list) {
  const side = getSide(list.side);
  const allowed = data.units.filter((unit) => side.unitGroups.includes(unit.group));
  const sections = GROUPS
    .filter((group) => side.unitGroups.includes(group))
    .map((group) => {
      const units = allowed.filter((unit) => unit.group === group);
      if (!units.length) return '';
      return `
        <section class="recruit-group">
          <h3 class="h-sub">${escapeHtml(groupLabel(group, side.id))}</h3>
          <div class="unit-grid">${units.map((unit) => recruitCard(unit, list)).join('')}</div>
        </section>`;
    }).join('');
  return `
    <div class="panel-head">
      <h2 class="h-section">Recruit</h2>
      <span class="panel-count">${allowed.length} available</span>
    </div>
    <p class="note">Tap a Soldier to add him to the detachment.</p>
    ${sections}`;
}
