/* App entry point: load data, restore the last list or a share link, wire the top bar. */

import { data, loadData } from './data.js';
import { newList, setGameSize, setName } from './state.js';
import { listTotal } from './cost.js';
import { loadCurrent, parseShareHash, saveCurrent } from './storage.js';
import { getList, mountBuilder, render, setList } from './ui-builder.js';
import { renderRoster } from './ui-roster.js';
import { openLoadDialog, openSaveDialog, openShareDialog, toast } from './ui-dialogs.js';
import { escapeHtml } from './format.js';

let saveTimer = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveCurrent(getList()), 250);
}

function updateTopbar() {
  const list = getList();
  if (!list) return;
  const nameInput = document.getElementById('list-name');
  const sizeSelect = document.getElementById('game-size');
  const points = document.getElementById('points');
  if (document.activeElement !== nameInput) nameInput.value = list.name;
  sizeSelect.value = String(list.gameSize);
  const total = listTotal(list);
  points.textContent = `${total} / ${list.gameSize}`;
  points.classList.toggle('over', total > list.gameSize);
}

function onListChanged() {
  updateTopbar();
  scheduleSave();
}

function loadIntoList(next) {
  setList(next);
  updateTopbar();
  saveCurrent(next);
  toast(`Loaded “${next.name || 'Untitled Detachment'}”.`);
}

function startNewList() {
  const fresh = newList();
  setList(fresh);
  updateTopbar();
  saveCurrent(fresh);
  toast('New detachment started.');
}

function bindTopbar() {
  const nameInput = document.getElementById('list-name');
  const sizeSelect = document.getElementById('game-size');
  for (const size of data.rules.gameSizes) {
    sizeSelect.insertAdjacentHTML('beforeend', `<option value="${size}">${size} pts</option>`);
  }

  nameInput.addEventListener('input', () => {
    setName(getList(), nameInput.value);
    scheduleSave();
  });

  sizeSelect.addEventListener('change', () => {
    if (setGameSize(getList(), sizeSelect.value)) {
      updateTopbar();
      render();
      scheduleSave();
    }
  });

  document.querySelector('[data-action="save"]').addEventListener('click', () => {
    openSaveDialog({
      list: getList(),
      onSaved() {
        updateTopbar();
        scheduleSave();
      }
    });
  });

  document.querySelector('[data-action="load"]').addEventListener('click', () => {
    openLoadDialog({
      list: getList(),
      onLoad: loadIntoList,
      onNew: startNewList
    });
  });

  document.querySelector('[data-action="share"]').addEventListener('click', () => {
    openShareDialog({ list: getList() });
  });

  document.querySelector('[data-action="print"]').addEventListener('click', () => {
    renderRoster(getList());
    requestAnimationFrame(() => window.print());
  });

  window.addEventListener('beforeprint', () => renderRoster(getList()));
  window.addEventListener('beforeunload', () => saveCurrent(getList()));
}

function showFatal(error) {
  console.error(error);
  document.getElementById('main').innerHTML = `
    <div class="doc">
      COULD NOT LOAD THE ARMY LISTS.<br><br>
      ${escapeHtml(error.message)}<br><br>
      Run the folder from a local web server (or GitHub Pages) rather than opening index.html directly.
    </div>`;
}

async function boot() {
  try {
    await loadData();
  } catch (error) {
    showFatal(error);
    return;
  }

  const shared = parseShareHash(location.hash);
  const saved = shared ? null : loadCurrent();
  const initial = shared || saved || newList();

  if (new URLSearchParams(location.search).get('print') === '1') {
    document.body.classList.add('print-mode');
    renderRoster(initial);
    return;
  }
  if (shared) history.replaceState(null, '', `${location.pathname}${location.search}`);

  mountBuilder({ initialList: initial, onListChange: onListChanged });
  bindTopbar();
  updateTopbar();
  saveCurrent(initial);
  if (shared) toast('Shared list loaded.');
}

boot();
