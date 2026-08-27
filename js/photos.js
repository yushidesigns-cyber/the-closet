import { photoGet } from './db.js?v=11';

const urlCache = new Map(); // photoId -> objectURL
const pending = new Set();
let onReadyCallback = null;

export function onPhotoReady(fn) { onReadyCallback = fn; }

export function getPhotoUrl(photoId) {
  if (!photoId) return null;
  if (urlCache.has(photoId)) return urlCache.get(photoId);
  if (!pending.has(photoId)) {
    pending.add(photoId);
    photoGet(photoId).then(blob => {
      pending.delete(photoId);
      if (blob) {
        urlCache.set(photoId, URL.createObjectURL(blob));
        if (onReadyCallback) onReadyCallback();
      }
    }).catch(() => pending.delete(photoId));
  }
  return null;
}
