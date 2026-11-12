/* Small pieces shared by more than one screen. */

import { escapeHtml } from './format.js';

const TAG_LABELS = {
  character: 'Character',
  mounted: 'Mounted',
  cossack: 'Cossack',
  colourRegiment: 'Colour Regiment'
};

export function unitTags(unit) {
  return (unit.tags || [])
    .filter((tag) => tag !== 'cossack')
    .map((tag) => `<span class="tag">${escapeHtml(TAG_LABELS[tag] || tag)}</span>`)
    .join('');
}

export function traitHtml(trait, inactive = false) {
  if (!trait) return '';
  const note = inactive ? '<span class="disabled-reason">Only while this Soldier is the Commander.</span>' : '';
  return `<p class="trait${inactive ? ' inactive' : ''}"><span class="trait-name">${escapeHtml(trait.name)}</span> ${escapeHtml(trait.text)}${note}</p>`;
}

export function unitImage(unit, className = 'card-img') {
  return `<div class="${className}" data-img-frame><img src="assets/img/units/${escapeHtml(unit.id)}.jpg" alt="" loading="lazy" data-optional-img data-autotall></div>`;
}
