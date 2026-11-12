/* Modals and small notices: save, load, share, confirm and toast. */

import { deleteSaved, getSavedLists, saveNamed, shareUrl } from './storage.js';
import { escapeHtml, pointsLabel } from './format.js';

let modal = null;
let returnFocus = null;

function focusables(root) {
  return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.disabled && element.offsetParent !== null);
}

export function closeModal() {
  if (!modal) return;
  modal.overlay.remove();
  document.body.classList.remove('modal-open');
  modal = null;
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  returnFocus = null;
}

export function openModal({ title, body = '', footer = '', className = '', onClose = null }) {
  closeModal();
  returnFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <section class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal-head">
        <h2 class="h-section" id="modal-title">${escapeHtml(title)}</h2>
        <button class="modal-close" type="button" data-close aria-label="Close">×</button>
      </header>
      <div class="modal-body">${body}</div>
      <footer class="modal-foot">${footer}</footer>
    </section>`;
  document.getElementById('modal-root').append(overlay);
  document.body.classList.add('modal-open');

  const api = {
    overlay,
    body: overlay.querySelector('.modal-body'),
    footer: overlay.querySelector('.modal-foot'),
    title: overlay.querySelector('#modal-title'),
    close: closeModal,
    setBody(html) { api.body.innerHTML = html; },
    setTitle(text) { api.title.textContent = text; }
  };
  modal = api;

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
    if (event.target.closest('[data-close]')) closeModal();
  });

  const onKey = (event) => {
    if (!modal) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(overlay);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  overlay.addEventListener('keydown', onKey);
  overlay.addEventListener('modal:closed', () => overlay.removeEventListener('keydown', onKey));

  queueMicrotask(() => {
    const target = overlay.querySelector('[data-autofocus]') || focusables(overlay)[0] || overlay;
    target.focus();
  });

  if (onClose) overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('[data-close]')) onClose();
  });

  return api;
}

export function toast(message) {
  const host = document.getElementById('toast');
  if (!host) return;
  const item = document.createElement('div');
  item.className = 'toast-item';
  item.textContent = message;
  host.append(item);
  setTimeout(() => item.classList.add('leaving'), 2400);
  setTimeout(() => item.remove(), 2900);
}

export function openConfirm({ title = 'Are you sure?', body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm }) {
  const api = openModal({
    title,
    body: `<p>${body}</p>`,
    footer: `
      <button class="btn secondary" type="button" data-close>${escapeHtml(cancelLabel)}</button>
      <button class="btn" type="button" data-confirm data-autofocus>${escapeHtml(confirmLabel)}</button>`
  });
  api.footer.querySelector('[data-confirm]').addEventListener('click', () => {
    closeModal();
    onConfirm?.();
  });
  return api;
}

export function openSaveDialog({ list, onSaved }) {
  const api = openModal({
    title: 'Save this list',
    body: `
      <label class="field">
        <span>List name</span>
        <input class="input" id="save-name" data-autofocus maxlength="80" value="${escapeHtml(list.name)}">
      </label>
      <p class="note">Saved lists stay in this browser. They are not uploaded anywhere.</p>`,
    footer: `
      <button class="btn secondary" type="button" data-close>Cancel</button>
      <button class="btn" type="button" id="save-confirm">Save list</button>`
  });
  api.footer.querySelector('#save-confirm').addEventListener('click', () => {
    const name = api.body.querySelector('#save-name').value.trim() || 'Untitled Detachment';
    list.name = name;
    const { ok } = saveNamed(list);
    if (!ok) {
      toast('Could not save — browser storage is full or blocked.');
      return;
    }
    closeModal();
    toast(`Saved “${name}”.`);
    onSaved?.(name);
  });
  api.body.querySelector('#save-name').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') api.footer.querySelector('#save-confirm').click();
  });
  return api;
}

function savedRows(entries) {
  if (!entries.length) {
    return `<div class="doc">NO SAVED LISTS. SAVE A DETACHMENT FIRST.</div>`;
  }
  return entries.map((entry) => `
    <div class="saved-row">
      <div class="saved-info">
        <strong>${escapeHtml(entry.name)}</strong>
        <span class="note">${escapeHtml(new Date(entry.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))} · ${entry.total} / ${entry.gameSize} pts</span>
      </div>
      <div class="saved-actions">
        <button class="btn" type="button" data-load="${escapeHtml(entry.id)}">Load</button>
        <button class="btn secondary" type="button" data-delete="${escapeHtml(entry.id)}">Delete</button>
      </div>
    </div>`).join('');
}

export function openLoadDialog({ list, onLoad, onNew }) {
  const entries = getSavedLists();
  const api = openModal({
    title: 'Load a list',
    body: `<div class="saved-list">${savedRows(entries)}</div>`,
    footer: `
      <button class="btn secondary" type="button" data-new>New list</button>
      <button class="btn secondary" type="button" data-close>Close</button>`
  });

  api.body.addEventListener('click', (event) => {
    const loadButton = event.target.closest('[data-load]');
    if (loadButton) {
      const loaded = entries.find((entry) => entry.id === loadButton.dataset.load);
      if (loaded) {
        closeModal();
        onLoad?.(loaded.list);
      }
      return;
    }
    const deleteButton = event.target.closest('[data-delete]');
    if (deleteButton) {
      const entry = entries.find((item) => item.id === deleteButton.dataset.delete);
      openConfirm({
        title: 'Delete saved list?',
        body: `“${escapeHtml(entry?.name || 'This list')}” will be removed from this browser. This cannot be undone.`,
        confirmLabel: 'Delete',
        onConfirm: () => {
          deleteSaved(deleteButton.dataset.delete);
          toast('Saved list deleted.');
          openLoadDialog({ list, onLoad, onNew });
        }
      });
    }
  });

  api.footer.querySelector('[data-new]').addEventListener('click', () => {
    openConfirm({
      title: 'Start a new list?',
      body: list.soldiers.length
        ? 'The current detachment will be replaced by an empty list. Save it first if you want to keep it.'
        : 'The page will start again with an empty list.',
      confirmLabel: 'New list',
      onConfirm: () => {
        closeModal();
        onNew?.();
      }
    });
  });
  return api;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* Fall through to the selection method. */
  }
  const input = document.getElementById('share-url');
  if (!input) return false;
  input.focus();
  input.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

export function openShareDialog({ list }) {
  const url = shareUrl(list);
  const api = openModal({
    title: 'Share this list',
    body: `
      <p>Anyone with this link can open the detachment. The list is stored in the link itself.</p>
      <label class="field">
        <span>Share link</span>
        <input class="input" id="share-url" readonly value="${escapeHtml(url)}" data-autofocus>
      </label>
      <p class="note">${list.soldiers.length} ${list.soldiers.length === 1 ? 'Soldier' : 'Soldiers'} · ${pointsLabel(list.gameSize)} limit</p>`,
    footer: `
      <button class="btn secondary" type="button" data-close>Close</button>
      <button class="btn" type="button" id="copy-share">Copy link</button>`
  });
  api.footer.querySelector('#copy-share').addEventListener('click', async () => {
    const copied = await copyText(url);
    toast(copied ? 'Share link copied.' : 'Select the link and copy it.');
  });
  return api;
}
