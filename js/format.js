/* Small formatting helpers shared by the builder and the printed roster. */

export const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function displayName(unit, soldier) {
  const nickname = soldier?.nickname?.trim();
  return nickname ? `${unit.name} “${nickname}”` : unit.name;
}

export function mountedMovement(unit, mounted) {
  if (!mounted) return `${unit.ms} cm`;
  const foot = unit.msFoot ?? unit.ms;
  return `16 cm (${foot})`;
}

export function statsCells(unit, mounted) {
  return [
    mountedMovement(unit, mounted),
    `${unit.t}+`,
    `${unit.d}+`,
    `${unit.c}+`,
    `${unit.e}`
  ];
}

export function statsTable(unit, mounted) {
  const cells = statsCells(unit, mounted).map((value) => `<td>${escapeHtml(value)}</td>`).join('');
  return `<table class="stats"><thead><tr><th>MS</th><th>T</th><th>D</th><th>C</th><th>E</th></tr></thead><tbody><tr>${cells}</tr></tbody></table>`;
}

export function statsText(unit, mounted) {
  const [ms, t, d, c, e] = statsCells(unit, mounted);
  return `MS ${ms} · T ${t} · D ${d} · C ${c} · E ${e}`;
}

export function rangeText(range) {
  return String(range || '').replace(/-/g, '−');
}

export function weaponProfile(item) {
  if (!item || item.rof === undefined) return '';
  const parts = [
    `RoF ${item.rof}`,
    rangeText(item.range),
    `Supply ${item.supply}+`,
    `Rel ${item.reliability}+`
  ];
  if (item.mgClass) parts.push(item.mgClass);
  return parts.join(' · ');
}

export const TYPE_LABELS = {
  rifle: 'Rifle', carbine: 'Carbine', handgun: 'Handgun', mg: 'Machine gun', melee: 'Melee',
  grenade: 'Grenade', medical: 'Medical'
};

export function typeLabel(item) {
  if (!item) return '';
  if (item.mgClass) return `${item.mgClass} (${TYPE_LABELS.mg})`;
  return TYPE_LABELS[item.type] || (item.category === 'upgrade' ? 'Upgrade' : 'Item');
}

export function pointsLabel(points) {
  return `${points} ${points === 1 ? 'pt' : 'pts'}`;
}

export function groupLabel(group, sideId) {
  if (group === 'both') return 'Either Side';
  if (group === sideId) return sideId === 'whites' ? 'Whites' : 'Reds';
  if (group === 'interventionists') return 'Interventionists';
  if (group === 'internationals') return 'International Brigades';
  return group;
}

export function tickBoxes(count, label) {
  const boxes = Array.from({ length: count }, () => '<span class="tick" aria-hidden="true"></span>').join('');
  return `<span class="ticks"><span class="tick-label">${escapeHtml(label)}</span>${boxes}</span>`;
}
