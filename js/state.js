import { CATS, TINT, JTYPES, BASE_MOODS, SUBS, PAIRS, SLOTSETS, BASE_BY_MOOD, ACCENT,
  DEFAULT_CLOSET_VIEW, ASSEMBLE_PACE, SEED } from './constants.js?v=13';
import { kvGet, kvSet, photoPut, photoDelete, photoGet } from './db.js?v=13';
import { resizeImageToBase64, analyzeInspiration, matchCandidates } from './claude.js?v=13';

const STATE_KEY = 'state';

function freshState() {
  const items = SEED.map((s, i) => ({ id: i + 1, name: s[0], cat: s[1], sub: s[2], moods: s[3], jtype: s[4], wears: s[5], fav: !!s[6], photoId: null }));
  return {
    items, nextId: items.length + 1, deleted: [],
    screen: 'put',
    closetView: DEFAULT_CLOSET_VIEW,
    cat: 'All', sub: null, sort: 'all', moodFilter: null, q: '', openDropdown: null,
    mood: 'Ethnic', pulled: false, base: null, moodAtPull: null, slots: [], reveal: 0,
    outfitWorn: false, plannedFromOutfit: false, nonce: 0,
    prefs: {}, pairPrefs: {}, history: [], correct: 0, iqCard: null, lastVerdict: '', focusPair: null,
    events: [], nextEventId: 1,
    sheet: null, wiz: null, toast: '', undoFn: null,
    customCats: [], catEdit: false, builtInRenames: {}, removedCats: [],
    subs: JSON.parse(JSON.stringify(SUBS)), tags: ['Wedding', 'Vacation', 'Date night', 'Temple'],
    newCat: '', newSub: '', newTag: '', settingsParent: 'Sarees', dataNote: '',
    claudeApiKey: '', inspo: null
  };
}

// fields that get written to IndexedDB — everything durable per the
// local-first data model; UI-only ephemeral fields (current screen, open
// sheet/wizard, filters, toast) are excluded and reset on reload.
// claudeApiKey is persisted here (survives reload) but deliberately kept out
// of exportBackup()'s payload — a wardrobe backup file is meant to be shared
// or moved between devices, and it should never carry the owner's API key.
const PERSIST_KEYS = ['items', 'nextId', 'deleted', 'closetView', 'prefs', 'pairPrefs', 'history',
  'correct', 'events', 'nextEventId', 'customCats', 'builtInRenames', 'removedCats', 'subs', 'tags', 'claudeApiKey'];

function pickPersisted(state) {
  const out = {};
  for (const k of PERSIST_KEYS) out[k] = state[k];
  return out;
}

class Store {
  constructor() {
    this.state = freshState();
    this.subs = new Set();
    this.overlaySubs = new Set();
    this.timers = [];
    this._saveTimer = null;
    this.ready = this._load();
  }

  async _load() {
    try {
      const saved = await kvGet(STATE_KEY);
      if (saved && typeof saved === 'object') Object.assign(this.state, saved);
    } catch (e) { console.warn('the-closet: failed to load saved state', e); }
  }

  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  // "overlay" subscribers re-render only the sheet/wizard/toast layer, not
  // the screen behind it — used for interactions scoped entirely to an open
  // sheet or wizard (picking a category, a mood, a wizard option, stepping
  // forward/back) so they never rebuild the closet grid behind them.
  subscribeOverlay(fn) { this.overlaySubs.add(fn); return () => this.overlaySubs.delete(fn); }
  notify() { this.subs.forEach(fn => fn()); this._schedulePersist(); }
  notifyOverlay() { this.overlaySubs.forEach(fn => fn()); }
  // mutate state without triggering a re-render — for text fields with no
  // on-screen dependents, so typing doesn't rebuild the whole app (and its
  // photo grid) on every keystroke, which is what caused the visible
  // scroll/shake behind the keyboard.
  mutate(fn) { fn(this.state); }
  setOverlay(patch) { Object.assign(this.state, patch); this.notifyOverlay(); }
  _schedulePersist() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      kvSet(STATE_KEY, pickPersisted(this.state)).catch(e => console.warn('the-closet: save failed', e));
    }, 200);
  }
  set(patch) { Object.assign(this.state, patch); this.notify(); }

  flash(msg, undo) {
    this.timers.forEach(clearTimeout); this.timers = [];
    this.set({ toast: msg, undoFn: undo || null });
    const t = setTimeout(() => this.set({ toast: '', undoFn: null }), undo ? 6000 : 2600);
    this.timers.push(t);
  }
  accent() { return ACCENT; }
  allCats() {
    const r = this.state.builtInRenames || {}, rem = this.state.removedCats || [];
    return CATS.map(c => r[c] || c).concat(this.state.customCats).filter(c => rem.indexOf(c) === -1);
  }
  byId(id) { return this.state.items.find(i => i.id === id); }
  plabel(it) { return it ? (it.jtype || it.sub || it.cat) : ''; }
  tint(it) { return it ? (TINT[it.cat] || '#DEDAD1') : '#E4E1D9'; }

  // ── wear counting: unique per outfit ──
  bumpWears(ids, dir) {
    const uniq = Array.from(new Set(ids));
    this.state.items = this.state.items.map(i => uniq.includes(i.id) ? { ...i, wears: Math.max(0, i.wears + dir) } : i);
  }

  // ── preference-led picking ──
  score(it, mood) {
    let s = (this.state.prefs[it.id] || 0) * 4;
    if (it.moods.includes(mood)) s += 6;
    if (it.fav) s += 2.5;
    s += Math.min(3, it.wears * 0.12);
    return s;
  }
  pick(cats, jtype, mood, exclude, nonce) {
    let c = this.state.items.filter(i => cats.includes(i.cat) && (!jtype || i.jtype === jtype) && !exclude.includes(i.id));
    if (!c.length) return null;
    c = c.slice().sort((a, b) => this.score(b, mood) - this.score(a, mood) || a.id - b.id);
    return c[(nonce || 0) % c.length];
  }
  buildOutfit(baseKey, keepLocks) {
    const mood = this.state.mood, prev = this.state.slots;
    const defs = SLOTSETS[baseKey];
    const used = [], out = [];
    defs.forEach((d, idx) => {
      const old = keepLocks ? prev.find(p => p.label === d[0]) : null;
      if (old && old.locked && old.itemId) { used.push(old.itemId); out.push({ label: d[0], cats: d[1], jtype: d[2], itemId: old.itemId, locked: true, nonce: old.nonce || 0 }); return; }
      const it = this.pick(d[1], d[2], mood, used, this.state.nonce + idx);
      if (it) used.push(it.id);
      out.push({ label: d[0], cats: d[1], jtype: d[2], itemId: it ? it.id : null, locked: false, nonce: this.state.nonce + idx });
    });
    return out;
  }
  pull() {
    if (this.state.outfitWorn) this.bumpWears(this.state.slots.map(s => s.itemId).filter(Boolean), -1);
    const st0 = this.state;
    const bases = BASE_BY_MOOD[st0.mood] || BASE_BY_MOOD.Casual;
    // an outfit built from an inspiration match has no real SLOTSETS base
    // (its slots come from whatever Claude detected in the photo, not a
    // fixed slot template) — re-pulling it always starts fresh rather than
    // trying to "hold locks around" a base key that buildOutfit can't look up.
    const holdLocks = st0.pulled && st0.moodAtPull === st0.mood && SLOTSETS[st0.base] && st0.slots.some(x => x.locked && x.itemId);
    const baseKey = holdLocks ? st0.base : bases[st0.nonce % bases.length];
    this.state.nonce += 1;
    const slots = this.buildOutfit(baseKey, holdLocks);
    this.timers.forEach(clearTimeout); this.timers = [];
    this.set({ pulled: true, base: baseKey, moodAtPull: this.state.mood, slots, reveal: 0, outfitWorn: false, plannedFromOutfit: false });
    if (holdLocks) this.flash(slots.filter(x => x.locked).length + ' locked · everything else re-pulled.');
    const pace = ASSEMBLE_PACE;
    slots.forEach((_, i) => { const t = setTimeout(() => this.set({ reveal: i + 1 }), pace * (i + 1)); this.timers.push(t); });
  }
  shuffleSlot(i) {
    if (this.state.outfitWorn) return this.flash('Undo the worn state before changing pieces.');
    const slots = this.state.slots.slice();
    const sl = { ...slots[i] };
    const exclude = slots.filter((x, j) => j !== i && x.itemId).map(x => x.itemId);
    const next = this.pick(sl.cats, sl.jtype, this.state.mood, exclude, (sl.nonce || 0) + 1);
    sl.nonce = (sl.nonce || 0) + 1;
    sl.itemId = next ? next.id : sl.itemId;
    slots[i] = sl;
    this.set({ slots, plannedFromOutfit: false });
  }
  toggleLock(i) {
    const slots = this.state.slots.slice();
    slots[i] = { ...slots[i], locked: !slots[i].locked };
    this.set({ slots });
  }
  toggleWorn() {
    const ids = this.state.slots.map(s => s.itemId).filter(Boolean);
    if (this.state.outfitWorn) { this.bumpWears(ids, -1); this.set({ outfitWorn: false }); this.flash('Worn state undone — wear counts reversed.'); }
    else { this.bumpWears(ids, 1); this.set({ outfitWorn: true }); this.flash('Marked worn today. Undo stays on the button.'); }
  }
  planFromOutfit() {
    if (this.state.plannedFromOutfit) return;
    const ids = Array.from(new Set(this.state.slots.map(s => s.itemId).filter(Boolean)));
    const d = new Date(); d.setDate(d.getDate() + 7);
    this.state.events = this.state.events.concat([{ id: this.state.nextEventId, name: 'Untitled event', date: d.toISOString().slice(0, 10), vibe: this.state.mood, worn: false, itemIds: ids }]);
    this.state.nextEventId += 1;
    this.set({ plannedFromOutfit: true });
    this.flash('Added to Planned Outfits — name it there.');
  }

  // ── Fashion IQ ──
  // a "side" is either a plain category ('Tops') or a specific jewellery
  // subtype ('Jewellery:Earrings') so pairs can distinguish earrings from a
  // necklace instead of treating all jewellery as one interchangeable blob.
  sideParts(s) { const i = s.indexOf(':'); return i < 0 ? { cat: s, jtype: null } : { cat: s.slice(0, i), jtype: s.slice(i + 1) }; }
  sideLabel(s) { const { cat, jtype } = this.sideParts(s); return jtype || cat; }
  pairKey(p) { return p[0] + ' + ' + p[1]; }
  pairLabel(p) { return this.sideLabel(p[0]) + ' + ' + this.sideLabel(p[1]); }
  ratedTypes() { return new Set(this.state.history.map(h => h.key)); }
  underLearned() {
    const r = this.ratedTypes();
    // a pair-type only counts as a "blind spot" if the wardrobe can
    // actually fill it — otherwise a permanently-empty category (e.g. no
    // Blouse pieces yet) gets stuck forever as the only "under-learned"
    // pair, which starves the pool and stops IQ from ever offering a card
    // again once every fillable pair has been rated once.
    const hasSide = s => { const { cat, jtype } = this.sideParts(s); return this.state.items.some(i => i.cat === cat && (!jtype || i.jtype === jtype)); };
    return PAIRS.filter(p => !r.has(this.pairKey(p)) && hasSide(p[0]) && hasSide(p[1]));
  }
  makeCard(forcePair) {
    const under = this.underLearned();
    const pool = forcePair ? [forcePair] : (under.length ? under : PAIRS);
    const n = this.state.history.length;
    // Try every pair-type in the pool (starting from the usual rotating
    // index) before giving up — a wardrobe with a whole category empty
    // (e.g. no Blouse pieces) made a fixed single attempt fail outright
    // whenever the rotation landed on Sarees+Blouse or Blouse+Jewellery,
    // so the card just vanished even with plenty of other pairs available.
    for (let attempt = 0; attempt < pool.length; attempt++) {
      const p = pool[(this.state.nonce + n + attempt) % pool.length];
      const pa = this.sideParts(p[0]), pb = this.sideParts(p[1]);
      const a = this.pick([pa.cat], pa.jtype, this.state.mood, [], n);
      const b = this.pick([pb.cat], pb.jtype, this.state.mood, a ? [a.id] : [], n + 1);
      if (!a || !b) continue;
      const pp = this.state.pairPrefs[this.pairKey(p)] || { love: 0, no: 0 };
      const prediction = (pp.love >= pp.no) ? 'Love it' : 'Not for me';
      return { key: this.pairKey(p), label: this.pairLabel(p), aId: a.id, bId: b.id, prediction, reason: under.length && !forcePair ? 'Under-learned' : 'Refining' };
    }
    return null;
  }
  // mutates synchronously without notify() — meant to be called just before
  // rendering the IQ screen so the freshly-picked card is visible immediately,
  // without triggering a nested re-render from inside render().
  ensureCard() { if (!this.state.iqCard) { const c = this.makeCard(this.state.focusPair); if (c) this.state.iqCard = c; } }
  answer(love) {
    const c = this.state.iqCard; if (!c) return;
    const ok = (c.prediction === 'Love it') === love;
    const now = new Date();
    const prefs = { ...this.state.prefs };
    [c.aId, c.bId].forEach(id => { prefs[id] = (prefs[id] || 0) + (love ? 1 : -1); });
    const pairPrefs = { ...this.state.pairPrefs };
    const cur = pairPrefs[c.key] || { love: 0, no: 0 };
    pairPrefs[c.key] = love ? { ...cur, love: cur.love + 1 } : { ...cur, no: cur.no + 1 };
    const entry = { key: c.key, aId: c.aId, bId: c.bId, love, correct: ok, ts: now.getTime() };
    this.set({
      prefs, pairPrefs, history: [entry].concat(this.state.history), correct: this.state.correct + (ok ? 1 : 0),
      iqCard: null, focusPair: null, nonce: this.state.nonce + 1,
      lastVerdict: ok ? 'IQ predicted this correctly — the pattern holds.' : 'IQ was wrong. That correction carries the most weight.'
    });
  }
  iqScore() {
    const total = this.state.history.length;
    const cov = this.ratedTypes().size / PAIRS.length;
    return Math.round(22 + 44 * Math.min(1, total / 18) + 34 * cov);
  }

  // ── planned events ──
  eventWorn(e) {
    if (e.worn) { this.bumpWears(e.itemIds, -1); this.state.events = this.state.events.map(x => x.id === e.id ? { ...x, worn: false } : x); this.notify(); this.flash('Undone — wear counts reversed.'); }
    else { this.bumpWears(e.itemIds, 1); this.state.events = this.state.events.map(x => x.id === e.id ? { ...x, worn: true } : x); this.notify(); this.flash('Marked worn. Undo sits on the same button.'); }
  }
  removeEvent(e) {
    if (e.worn) this.bumpWears(e.itemIds, -1);
    const idx = this.state.events.findIndex(x => x.id === e.id);
    this.state.events = this.state.events.filter(x => x.id !== e.id);
    this.notify();
    this.flash('"' + e.name + '" removed.', () => {
      if (e.worn) this.bumpWears(e.itemIds, 1);
      const ev = this.state.events.slice(); ev.splice(Math.max(0, idx), 0, e);
      this.set({ events: ev });
    });
  }

  // ── wizard ──
  wizSteps(w) {
    const base = this.byId(w.baseId);
    const needsBlouse = base && (base.cat === 'Sarees' || base.cat === 'Lehenga');
    const steps = [{ k: 'vibe', t: 'Choose a vibe' }, { k: 'base', t: 'Choose the base piece' }];
    if (needsBlouse || !base) steps.push({ k: 'blouse', t: 'Choose a blouse' });
    steps.push({ k: 'footwear', t: 'Choose footwear' });
    // one step per jewellery type (earrings, rings, necklace, ...) instead
    // of one grid mixing all of them — and a type with nothing in the
    // wardrobe simply doesn't get a step at all, rather than showing up as
    // an empty page to skip through.
    JTYPES.forEach(jt => {
      if (this.state.items.some(i => i.cat === 'Jewellery' && i.jtype === jt)) {
        steps.push({ k: 'jewellery:' + jt, t: 'Choose ' + jt.toLowerCase() });
      }
    });
    steps.push({ k: 'details', t: 'Name and date it' }, { k: 'review', t: 'Review' });
    return steps;
  }
  wizStart() { const d = new Date(); d.setDate(d.getDate() + 14); this.setOverlay({ wiz: { step: 0, vibe: null, baseId: null, blouseId: null, shoeId: null, jewelIds: [], name: '', date: d.toISOString().slice(0, 10) } }); }
  wizNext() {
    const w = this.state.wiz; if (!w) return;
    const steps = this.wizSteps(w);
    const cur = steps[w.step];
    if (cur.k === 'vibe' && !w.vibe) return this.flash('Pick a vibe to continue.');
    if (cur.k === 'base' && !w.baseId) return this.flash('Pick the base piece.');
    if (cur.k === 'review') return this.wizSave();
    if (cur.k === 'details' && !w.name.trim()) return this.flash('Give the event a name.');
    this.setOverlay({ wiz: { ...w, step: Math.min(steps.length - 1, w.step + 1) } });
  }
  wizBack() { const w = this.state.wiz; if (!w) return; if (w.step === 0) return this.setOverlay({ wiz: null }); this.setOverlay({ wiz: { ...w, step: w.step - 1 } }); }
  editEvent(e) {
    const items = e.itemIds.map(id => this.byId(id)).filter(Boolean);
    const baseCats = ['Sarees', 'Lehenga', 'Dresses', 'Suits', 'Jumpsuit', 'Tops'];
    const base = items.find(i => baseCats.includes(i.cat));
    const blouse = items.find(i => i.cat === 'Blouse');
    const shoe = items.find(i => i.cat === 'Footwear');
    const wiz = {
      step: 0, editId: e.id, vibe: e.vibe, baseId: base ? base.id : null, blouseId: blouse ? blouse.id : null,
      shoeId: shoe ? shoe.id : null, jewelIds: items.filter(i => i.cat === 'Jewellery').map(i => i.id), name: e.name, date: e.date
    };
    // editing opens on the review step (the last one) showing everything
    // already chosen, rather than forcing a walk back through every step
    // from vibe again — Back still steps backward through the same choices.
    wiz.step = this.wizSteps(wiz).length - 1;
    this.setOverlay({ wiz });
  }
  wizSave() {
    const w = this.state.wiz;
    const ids = Array.from(new Set([w.baseId, w.blouseId, w.shoeId].concat(w.jewelIds).filter(Boolean)));
    if (w.editId) {
      const prev = this.state.events.find(x => x.id === w.editId);
      if (prev && prev.worn) { this.bumpWears(prev.itemIds, -1); this.bumpWears(ids, 1); }
      this.state.events = this.state.events.map(x => x.id === w.editId ? { ...x, name: w.name.trim() || x.name, date: w.date, vibe: w.vibe || x.vibe, itemIds: ids } : x).sort((a, b) => a.date < b.date ? -1 : 1);
      this.set({ wiz: null });
      this.flash('Planned outfit updated.');
      return;
    }
    this.state.events = this.state.events.concat([{ id: this.state.nextEventId, name: w.name.trim() || 'Untitled event', date: w.date, vibe: w.vibe || 'Ethnic', worn: false, itemIds: ids }]).sort((a, b) => a.date < b.date ? -1 : 1);
    this.state.nextEventId += 1;
    this.set({ wiz: null });
    this.flash('Planned outfit saved.');
  }
  wizSelect(kind, id) {
    const w = this.state.wiz;
    if (kind.indexOf('jewellery') === 0) { const has = w.jewelIds.includes(id); this.setOverlay({ wiz: { ...w, jewelIds: has ? w.jewelIds.filter(x => x !== id) : w.jewelIds.concat([id]) } }); return; }
    const map = { base: 'baseId', blouse: 'blouseId', footwear: 'shoeId' };
    this.state.wiz = { ...w, [map[kind]]: w[map[kind]] === id ? null : id };
    this.notifyOverlay();
    this.wizNextSoft();
  }
  wizNextSoft() { const w = this.state.wiz; if (!w) return; const steps = this.wizSteps(w); if (steps[w.step].k !== 'review') this.setOverlay({ wiz: { ...this.state.wiz, step: Math.min(steps.length - 1, w.step + 1) } }); }

  // ── sheet (add/edit piece) ──
  openAdd() { this.setOverlay({ sheet: { name: '', cat: 'Sarees', sub: null, moods: [], jtype: null, photoId: null, photoPreviewUrl: null, pendingBlob: null } }); }
  openEdit(it) { this.setOverlay({ sheet: { id: it.id, name: it.name, cat: it.cat, sub: it.sub, moods: it.moods.slice(), jtype: it.jtype, photoId: it.photoId || null, photoPreviewUrl: null, pendingBlob: null } }); }
  setSheetPendingPhoto(blob, previewUrl) {
    const sh = this.state.sheet; if (!sh) return;
    if (sh.photoPreviewUrl) URL.revokeObjectURL(sh.photoPreviewUrl);
    this.setOverlay({ sheet: { ...sh, pendingBlob: blob, photoPreviewUrl: previewUrl } });
  }
  async saveSheet() {
    const sh = this.state.sheet;
    if (!sh.name.trim()) return this.flash('An item needs a name.');
    let photoId = sh.photoId || null;
    if (sh.pendingBlob) {
      const oldId = photoId;
      photoId = 'p_' + (sh.id || 'new') + '_' + Date.now();
      await photoPut(photoId, sh.pendingBlob);
      if (oldId && oldId !== photoId) await photoDelete(oldId).catch(() => {});
    }
    if (sh.photoPreviewUrl) URL.revokeObjectURL(sh.photoPreviewUrl);
    if (sh.id) {
      this.state.items = this.state.items.map(i => i.id === sh.id ? { ...i, name: sh.name.trim(), cat: sh.cat, sub: sh.sub, moods: sh.moods, jtype: sh.jtype, photoId } : i);
      this.set({ sheet: null, closetView: DEFAULT_CLOSET_VIEW });
      this.flash('Piece updated.');
    } else {
      this.state.items = [{ id: this.state.nextId, name: sh.name.trim(), cat: sh.cat, sub: sh.sub, moods: sh.moods, jtype: sh.jtype, wears: 0, fav: false, photoId }].concat(this.state.items);
      this.state.nextId += 1;
      this.set({ sheet: null, closetView: DEFAULT_CLOSET_VIEW });
      this.flash('Added to the closet.');
    }
  }
  del(it) {
    this.state.items = this.state.items.filter(i => i.id !== it.id);
    this.state.deleted = [it].concat(this.state.deleted);
    this.set({ closetView: DEFAULT_CLOSET_VIEW });
    this.flash(it.name + ' moved to Recently deleted.', () => this.restore(it));
  }
  restore(it) { this.state.deleted = this.state.deleted.filter(i => i.id !== it.id); this.state.items = [it].concat(this.state.items); this.set({ closetView: DEFAULT_CLOSET_VIEW }); }

  renameCat(from, to) {
    if (!to.trim()) return;
    const v = to;
    TINT[v] = TINT[from] || TINT[v] || '#DEDAD1';
    const subs = { ...this.state.subs };
    if (subs[from] !== undefined) { subs[v] = subs[from]; if (v !== from) delete subs[from]; }
    this.set({
      items: this.state.items.map(i => i.cat === from ? { ...i, cat: v } : i),
      deleted: this.state.deleted.map(i => i.cat === from ? { ...i, cat: v } : i),
      customCats: this.state.customCats.map(c => c === from ? v : c),
      builtInRenames: Object.assign({}, this.state.builtInRenames, CATS.includes(from) ? { [from]: v } : {}),
      subs,
      cat: this.state.cat === from ? v : this.state.cat,
      settingsParent: this.state.settingsParent === from ? v : this.state.settingsParent
    });
  }
  removeCat(c, n) {
    if (n > 0) return this.flash(c + ' still holds ' + n + ' pieces. Move or delete them first.');
    const prevSubs = this.state.subs[c];
    const wasCustom = this.state.customCats.indexOf(c) !== -1;
    const subs = { ...this.state.subs }; delete subs[c];
    this.set({
      customCats: this.state.customCats.filter(x => x !== c), removedCats: (this.state.removedCats || []).concat([c]), subs,
      cat: this.state.cat === c ? 'All' : this.state.cat, settingsParent: this.state.settingsParent === c ? 'Sarees' : this.state.settingsParent
    });
    this.flash('Category "' + c + '" removed.', () => this.set({
      removedCats: (this.state.removedCats || []).filter(x => x !== c),
      customCats: wasCustom ? this.state.customCats.concat([c]) : this.state.customCats,
      subs: prevSubs ? { ...this.state.subs, [c]: prevSubs } : this.state.subs
    }));
  }

  filtered() {
    const s = this.state, q = s.q.trim().toLowerCase();
    let list = s.items.filter(i => {
      if (s.cat !== 'All' && i.cat !== s.cat) return false;
      if (s.sub && i.sub !== s.sub && i.jtype !== s.sub) return false;
      if (s.moodFilter && !i.moods.includes(s.moodFilter)) return false;
      if (s.sort === 'starred' && !i.fav) return false;
      if (q) {
        const hay = [i.name, i.cat, i.sub, i.jtype].concat(i.moods).filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (s.sort === 'most') list = list.slice().sort((a, b) => b.wears - a.wears);
    if (s.sort === 'least') list = list.slice().sort((a, b) => a.wears - b.wears);
    return list;
  }

  // ── inspiration match (Claude vision) ──
  openInspo() { this.setOverlay({ inspo: { step: 'upload', photoBlob: null, photoPreviewUrl: null, mood: null, summary: '', matches: [], error: '' } }); }
  closeInspo() { this.setOverlay({ inspo: null }); }
  setInspoPhoto(blob, previewUrl) {
    const cur = this.state.inspo || {};
    this.setOverlay({ inspo: { ...cur, step: 'upload', photoBlob: blob, photoPreviewUrl: previewUrl, error: '' } });
  }
  async runInspoMatch() {
    const cur = this.state.inspo;
    if (!cur || !cur.photoBlob) return;
    const apiKey = (this.state.claudeApiKey || '').trim();
    if (!apiKey) { this.setOverlay({ inspo: { ...cur, step: 'error', error: 'Add a Claude API key in Settings first.' } }); return; }
    this.setOverlay({ inspo: { ...cur, step: 'analyzing', error: '' } });
    try {
      const { base64, mediaType } = await resizeImageToBase64(cur.photoBlob, 800);
      const analysis = await analyzeInspiration(apiKey, base64, mediaType, CATS, JTYPES, BASE_MOODS);
      // pull a real, bounded shortlist of candidates per detected slot straight
      // from the closet — never the whole wardrobe (too many photos = too much
      // cost/latency), favourites and more-worn pieces first as a cheap proxy
      // for "pieces this person actually likes," then let Claude's second
      // pass do the real visual comparison against the inspiration photo.
      const slotsWithPool = analysis.slots.map(sl => {
        const pool = this.state.items.filter(i => i.cat === sl.category && (!sl.jtype || i.jtype === sl.jtype) && i.photoId);
        const cands = pool.slice().sort((a, b) => (b.fav - a.fav) || (b.wears - a.wears)).slice(0, 4);
        return { category: sl.category, jtype: sl.jtype, description: sl.description, candidateIds: cands.map(c => c.id) };
      }).filter(sl => sl.candidateIds.length > 0);
      if (!slotsWithPool.length) {
        this.setOverlay({ inspo: { ...cur, step: 'error', error: "Nothing in your closet (with a photo) matches the categories in this look yet." } });
        return;
      }
      const slotsWithImages = await Promise.all(slotsWithPool.map(async sl => {
        const images = [];
        for (const id of sl.candidateIds) {
          const it = this.byId(id);
          const blob = it && it.photoId ? await photoGet(it.photoId) : null;
          if (!blob) continue;
          const resized = await resizeImageToBase64(blob, 500);
          images.push({ id, ...resized });
        }
        return { ...sl, images };
      }));
      const usableSlots = slotsWithImages.filter(sl => sl.images.length > 0);
      if (!usableSlots.length) {
        this.setOverlay({ inspo: { ...cur, step: 'error', error: "Couldn't load photos for the matching pieces — try again." } });
        return;
      }
      const results = await matchCandidates(apiKey, base64, mediaType, usableSlots);
      const matches = usableSlots.map((sl, i) => {
        const r = (results.slot_matches || []).find(m => m.slot_index === i);
        return {
          category: sl.category, jtype: sl.jtype, description: sl.description, candidateIds: sl.candidateIds,
          chosenId: r && r.has_match ? r.best_item_id : null,
          confidence: r ? r.confidence : null, reasoning: r ? r.reasoning : '',
          alternateIds: r ? (r.alternate_item_ids || []) : []
        };
      });
      this.setOverlay({ inspo: { ...cur, step: 'results', mood: analysis.mood, summary: analysis.summary, matches } });
    } catch (e) {
      this.setOverlay({ inspo: { ...this.state.inspo, step: 'error', error: e.message || 'Something went wrong reaching Claude.' } });
    }
  }
  chooseInspoMatch(slotIndex, itemId) {
    const cur = this.state.inspo;
    const matches = cur.matches.slice();
    matches[slotIndex] = { ...matches[slotIndex], chosenId: itemId };
    this.setOverlay({ inspo: { ...cur, matches } });
  }
  buildOutfitFromInspo() {
    const cur = this.state.inspo;
    const chosen = cur.matches.filter(m => m.chosenId);
    const slots = chosen.map(m => ({ label: m.jtype || m.category, cats: [m.category], jtype: m.jtype, itemId: m.chosenId, locked: false, nonce: 0 }));
    this.timers.forEach(clearTimeout); this.timers = [];
    this.set({
      inspo: null, screen: 'put', pulled: true, base: 'Inspiration match',
      mood: cur.mood || this.state.mood, moodAtPull: cur.mood || this.state.mood,
      slots, reveal: slots.length, outfitWorn: false, plannedFromOutfit: false
    });
    this.flash('Outfit built from your inspiration photo.');
  }
}

export const store = new Store();
