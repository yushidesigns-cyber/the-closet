import { store } from './state.js?v=13';
import { photoGet, photoPut, photoClearAll } from './db.js?v=13';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data: URL
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(dataUrl) {
  return fetch(dataUrl).then(r => r.blob());
}

function referencedPhotoIds(s) {
  const ids = new Set();
  s.items.forEach(i => { if (i.photoId) ids.add(i.photoId); });
  s.deleted.forEach(i => { if (i.photoId) ids.add(i.photoId); });
  return Array.from(ids);
}

export async function exportBackup() {
  const s = store.state;
  const photoIds = referencedPhotoIds(s);
  const photos = {};
  for (const id of photoIds) {
    try {
      const blob = await photoGet(id);
      if (blob) photos[id] = await blobToBase64(blob);
    } catch (e) { /* skip unreadable photo */ }
  }
  const payload = {
    version: 1,
    exported: new Date().toISOString(),
    items: s.items, deleted: s.deleted, events: s.events, nextId: s.nextId, nextEventId: s.nextEventId,
    iq: { history: s.history, prefs: s.prefs, pairPrefs: s.pairPrefs, correct: s.correct },
    taxonomy: { customCats: s.customCats, builtInRenames: s.builtInRenames, removedCats: s.removedCats, subs: s.subs, tags: s.tags },
    closetView: s.closetView,
    photos
  };
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'the-closet-backup.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    store.set({ dataNote: 'Backup written: ' + s.items.length + ' pieces, ' + s.events.length + ' planned outfits, ' + s.history.length + ' IQ ratings.' });
  } catch (e) {
    store.set({ dataNote: 'Export failed: ' + e.message });
  }
}

export async function importBackupFile(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (e) {
    store.set({ dataNote: 'That file is not a valid backup.' });
    return;
  }
  if (!payload || !Array.isArray(payload.items)) {
    store.set({ dataNote: 'That file is not a valid backup.' });
    return;
  }
  if (!confirm('Import will replace all wardrobe data on this device with the backup contents. Continue?')) return;

  await photoClearAll();
  const photos = payload.photos || {};
  for (const id of Object.keys(photos)) {
    try { await photoPut(id, await base64ToBlob(photos[id])); } catch (e) { /* skip */ }
  }

  const iq = payload.iq || {};
  const tax = payload.taxonomy || {};
  store.set({
    items: payload.items || [], deleted: payload.deleted || [], events: payload.events || [],
    nextId: payload.nextId || ((payload.items || []).length + 1),
    nextEventId: payload.nextEventId || ((payload.events || []).length + 1),
    history: iq.history || [], prefs: iq.prefs || {}, pairPrefs: iq.pairPrefs || {}, correct: iq.correct || 0,
    customCats: tax.customCats || [], builtInRenames: tax.builtInRenames || {}, removedCats: tax.removedCats || [],
    subs: tax.subs || {}, tags: tax.tags || [],
    closetView: payload.closetView || 'grid',
    sheet: null, wiz: null,
    dataNote: 'Backup imported: ' + (payload.items || []).length + ' pieces restored.'
  });
}
