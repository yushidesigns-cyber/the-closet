import { store } from './state.js?v=2';
import { renderApp } from './render.js?v=2';
import { onPhotoReady } from './photos.js?v=2';
import { importBackupFile } from './backup.js?v=2';

const root = document.getElementById('app');

function withFocusPreserved(fn) {
  const active = document.activeElement;
  let focusKey = null, selStart = null, selEnd = null;
  if (active && root.contains(active) && active.dataset && active.dataset.focusKey) {
    focusKey = active.dataset.focusKey;
    if ('selectionStart' in active) { try { selStart = active.selectionStart; selEnd = active.selectionEnd; } catch (e) {} }
  }
  fn();
  if (focusKey) {
    const el = root.querySelector('[data-focus-key="' + focusKey.replace(/"/g, '\\"') + '"]');
    if (el) {
      el.focus();
      if (selStart != null && 'setSelectionRange' in el) { try { el.setSelectionRange(selStart, selEnd); } catch (e) {} }
    }
  }
}

function render() { withFocusPreserved(() => renderApp(root)); }

store.subscribe(render);
onPhotoReady(render);

store.ready.then(render);

// ── photo inputs ──
function handlePhotoFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  store.setSheetPendingPhoto(file, url);
}
document.getElementById('photo-choose').addEventListener('change', e => { handlePhotoFile(e.target.files[0]); e.target.value = ''; });
document.getElementById('photo-capture').addEventListener('change', e => { handlePhotoFile(e.target.files[0]); e.target.value = ''; });

document.getElementById('backup-import').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) await importBackupFile(file);
});
