import { store } from './state.js?v=5';
import { renderApp, renderOverlaysOnly } from './render.js?v=5';
import { onPhotoReady } from './photos.js?v=5';
import { importBackupFile } from './backup.js?v=5';

const root = document.getElementById('app');

// Keep fixed-position overlays (sheet, wizard) sized to the actual visible
// area instead of the full layout viewport. iOS Safari doesn't shrink
// window.innerHeight/100vh when the keyboard opens, so a fixed overlay
// bottom-anchored with plain inset:0/100vh ends up positioned as if the
// keyboard weren't there — then the browser's own "scroll focused input
// into view" heuristic repeatedly fights to compensate on every keystroke,
// which is what made the page appear to drift/shake while typing.
function updateViewportVars() {
  const vv = window.visualViewport;
  const height = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--vvh', height + 'px');
}
updateViewportVars();
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateViewportVars);
  window.visualViewport.addEventListener('scroll', updateViewportVars);
} else {
  window.addEventListener('resize', updateViewportVars);
}

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
      el.focus({ preventScroll: true });
      if (selStart != null && 'setSelectionRange' in el) { try { el.setSelectionRange(selStart, selEnd); } catch (e) {} }
    }
  }
}

function render() { withFocusPreserved(() => renderApp(root)); }
function renderOverlay() { withFocusPreserved(() => renderOverlaysOnly(root)); }

store.subscribe(render);
store.subscribeOverlay(renderOverlay);
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
