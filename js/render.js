import { h, clear } from './dom.js?v=12';
import { store } from './state.js?v=12';
import { getPhotoUrl } from './photos.js?v=12';
import { exportBackup } from './backup.js?v=12';
import { CATS, JTYPES, BASE_MOODS, NAV, NAV_ICONS, PAIRS, APP_VERSION } from './constants.js?v=12';
import * as icon from './icons.js?v=12';

const ac = () => store.accent();

// ── generic building blocks ──────────────────────────────────────────
function thumb(it, extraClass) {
  const div = h('div', { class: 'thumb' + (extraClass ? ' ' + extraClass : ''), style: { background: store.tint(it) } });
  const photoId = it && it.photoId;
  if (photoId) {
    const url = getPhotoUrl(photoId);
    if (url) { div.appendChild(h('img', { src: url, alt: '' })); return div; }
  }
  div.appendChild(h('span', { class: 'plabel' }, store.plabel(it)));
  return div;
}

function chip(label, active, onClick, cls) {
  return h('button', { class: 'chip' + (cls ? ' ' + cls : '') + (active ? ' chip-active' : ''), onclick: onClick }, label);
}

function btn(label, variant, onClick, extra) {
  return h('button', Object.assign({ class: 'btn btn-block ' + variant, onclick: onClick }, extra || {}), label);
}

function iconBtn(iconEl, onClick, opts) {
  opts = opts || {};
  return h('button', { class: 'btn-icon' + (opts.lg ? ' lg' : '') + (opts.locked ? ' locked' : ''), onclick: onClick, title: opts.title || '' }, iconEl);
}

// a button that opens a small in-page menu of options — used for Sort/Mood
// on the Closet screen so those filters don't take up a whole scrolling
// chip row. Only one dropdown is ever open at a time (tracked in state so
// picking an option or tapping the transparent scrim behind it can close it).
function filterDropdown(key, label, options, selectedValue, isActive) {
  const open = store.state.openDropdown === key;
  const current = options.find(o => o.value === selectedValue);
  const btnText = isActive && current ? label + ' · ' + current.label : label;
  const wrap = h('div', { class: 'dropdown-wrap' });
  wrap.appendChild(h('button', {
    class: 'dropdown-btn' + (open ? ' dropdown-btn-open' : '') + (isActive ? ' dropdown-btn-active' : ''),
    onclick: () => store.set({ openDropdown: open ? null : key })
  }, [h('span', {}, btnText), icon.iconChevronDown()]));
  if (open) {
    wrap.appendChild(h('div', { class: 'dropdown-scrim', onclick: () => store.set({ openDropdown: null }) }));
    wrap.appendChild(h('div', { class: 'dropdown-panel' },
      options.map(opt => h('button', {
        class: 'dropdown-item' + (opt.value === selectedValue ? ' active' : ''),
        onclick: () => store.set(Object.assign({ openDropdown: null }, opt.patch))
      }, opt.label))));
  }
  return wrap;
}

function textField(props) {
  const el = h('input', Object.assign({ type: props.type || 'text' }, props.attrs || {}));
  if (props.focusKey) el.dataset.focusKey = props.focusKey;
  el.value = props.value || '';
  el.placeholder = props.placeholder || '';
  el.addEventListener('input', () => props.onInput(el.value));
  if (props.onEnter) el.addEventListener('keydown', e => { if (e.key === 'Enter') props.onEnter(); });
  return el;
}

function eyebrow(text) { return h('div', { class: 'eyebrow' }, text); }

function emptyBox(title, body, extra) {
  return h('div', { class: 'empty-box' }, [
    h('div', { class: 'empty-title' }, title),
    h('div', { class: 'empty-body' }, body),
    extra || null
  ]);
}

// ── screens ───────────────────────────────────────────────────────────
function screenOutfit() {
  const s = store.state;
  const bases = BASE_MOODS.concat(s.tags);
  const wrap = h('div', { class: 'screen-pad' });

  wrap.appendChild(h('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' } }, [
    h('div', {}, [eyebrow('Today'), h('div', { class: 'title-serif', style: { fontSize: '38px', marginTop: '6px' } }, ['Put something', h('br'), 'together'])]),
    h('div', { style: { textAlign: 'right', flex: 'none', paddingBottom: '3px' } }, [
      h('div', { class: 'eyebrow' }, 'IQ'),
      h('div', { class: 'title-serif', style: { fontSize: '30px', color: ac() } }, String(store.iqScore()))
    ])
  ]));

  if (s.items.length === 0) {
    wrap.appendChild(emptyBox('Nothing in the closet yet.', 'Add a few pieces first — outfits are pulled from what you actually own, never invented.',
      h('button', { class: 'btn btn-outline', style: { marginTop: '14px', minHeight: '42px', padding: '0 18px' }, onclick: () => store.set({ screen: 'closet' }) }, 'Go to Closet')));
    return wrap;
  }

  wrap.appendChild(h('div', { class: 'eyebrow', style: { marginTop: '24px' } }, 'Mood'));
  wrap.appendChild(h('div', { class: 'chip-row', style: { marginTop: '9px', flexWrap: 'wrap' } },
    bases.map(m => chip(m, s.mood === m, () => store.set({ mood: m })))));

  const holdLocks = s.pulled && s.moodAtPull === s.mood && s.slots.some(x => x.locked && x.itemId);
  const pullLabel = !s.pulled ? 'Pull an outfit' : (holdLocks ? 'Pull around the locks' : 'Pull another outfit');
  wrap.appendChild(h('button', { class: 'btn btn-primary btn-block', style: { marginTop: '20px' }, onclick: () => store.pull() }, [
    h('span', {}, pullLabel), icon.iconPull()
  ]));

  if (s.pulled) {
    const lockedCount = s.slots.filter(x => x.locked).length;
    const box = h('div', { style: { marginTop: '26px' } });
    box.appendChild(h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid rgba(22,21,15,0.14)', paddingBottom: '8px' } }, [
      h('div', { style: { fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#16150F' } }, s.mood + ' · ' + (s.base || '')),
      h('div', { class: 'eyebrow' }, lockedCount ? lockedCount + ' locked' : 'Tap lock to hold a piece')
    ]));
    s.slots.forEach((sl, i) => {
      if (!sl.itemId) return; // nothing suitable was found for this slot — don't show a dead row
      const it = store.byId(sl.itemId);
      const revealed = i < s.reveal;
      const row = h('div', { class: 'outfit-slot', style: { opacity: revealed ? 1 : 0.18 } });
      row.appendChild(thumb(revealed ? it : null));
      row.appendChild(h('div', { class: 'slot-info' }, [
        h('div', { class: 'slot-label' }, sl.label),
        h('div', { class: 'slot-name' }, revealed ? it.name : ''),
        h('div', { class: 'slot-sub' }, revealed ? (it.sub || it.jtype || it.cat) : '')
      ]));
      row.appendChild(h('div', { class: 'slot-actions' }, [
        iconBtn(icon.iconLock(sl.locked ? '#F6F4EF' : '#16150F'), () => store.toggleLock(i), { title: 'Lock', locked: sl.locked }),
        iconBtn(icon.iconShuffle(), () => store.shuffleSlot(i), { title: 'Shuffle' })
      ]));
      box.appendChild(row);
    });
    box.appendChild(h('div', { style: { marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px' } }, [
      h('button', { class: 'btn btn-block', style: { border: '1px solid rgba(22,21,15,0.16)', background: s.outfitWorn ? '#16150F' : 'transparent', color: s.outfitWorn ? '#F6F4EF' : '#16150F' }, onclick: () => store.toggleWorn() }, [
        icon.iconCheck(), h('span', {}, s.outfitWorn ? 'Worn · Undo' : 'Mark this outfit worn')
      ]),
      h('button', { class: 'btn btn-outline btn-block', style: { minHeight: '46px' }, onclick: () => store.planFromOutfit() }, s.plannedFromOutfit ? 'Added to planned outfits' : 'Add to planned outfits')
    ]));
    wrap.appendChild(box);
  } else {
    wrap.appendChild(emptyBox('Nothing pulled yet.', 'Choose a mood and pull. Fashion IQ weights each slot by what you have loved, favourited and actually worn — it never rolls dice.'));
  }
  return wrap;
}

function closetHeaderCats() {
  const s = store.state;
  return ['All'].concat(store.allCats());
}

function screenCloset() {
  const s = store.state;
  const list = store.filtered();
  const wrap = h('div');
  const pad = h('div', { class: 'screen-pad' });
  pad.appendChild(h('div', { class: 'title-serif', style: { fontSize: '42px', textTransform: 'uppercase' } }, 'The Closet'));
  pad.appendChild(h('div', { style: { marginTop: '8px', fontSize: '9px', letterSpacing: '0.1em', color: ac(), fontFamily: 'monospace' } }, 'build ' + APP_VERSION));
  pad.appendChild(h('div', { class: 'eyebrow', style: { marginTop: '4px' } },
    list.length + ' of ' + s.items.length + ' pieces' + (s.cat === 'All' ? '' : ' · ' + s.cat)));
  pad.appendChild(h('div', { class: 'search-field', style: { marginTop: '16px' } }, [
    icon.iconSearch(),
    textField({ value: s.q, placeholder: 'Search name, tag, subcategory…', focusKey: 'closet-q', onInput: v => store.set({ q: v }) })
  ]));
  wrap.appendChild(pad);

  // pinned as one block so filters never scroll up under the status bar/notch
  const filters = h('div', { class: 'closet-filters-sticky' });

  filters.appendChild(h('div', { class: 'chip-row', style: { padding: '2px 20px' } },
    closetHeaderCats().map(c => chip(c, s.cat === c, () => store.set({ cat: c, sub: null })))));

  const hasSubs = s.cat !== 'All' && (s.subs[s.cat] || s.cat === 'Jewellery');
  if (hasSubs) {
    const subList = s.cat === 'Jewellery' ? JTYPES : (s.subs[s.cat] || []);
    filters.appendChild(h('div', { class: 'underline-rail', style: { marginTop: '6px', padding: '2px 20px' } },
      subList.map(x => h('button', { class: 'underline-chip' + (s.sub === x ? ' active' : ''), style: s.sub === x ? { borderColor: ac() } : {}, onclick: () => store.set({ sub: s.sub === x ? null : x }) }, x))));
  }

  const sortRow = h('div', { class: 'screen-pad', style: { marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' } });
  const sortOptions = [
    { value: 'all', label: 'All pieces', patch: { sort: 'all' } },
    { value: 'starred', label: 'Starred', patch: { sort: 'starred' } },
    { value: 'most', label: 'Most worn', patch: { sort: 'most' } },
    { value: 'least', label: 'Least worn', patch: { sort: 'least' } }
  ];
  const moodOptions = [{ value: null, label: 'All moods', patch: { moodFilter: null } }].concat(
    BASE_MOODS.concat(s.tags).map(m => ({ value: m, label: m, patch: { moodFilter: m } })));
  sortRow.appendChild(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
    filterDropdown('sort', 'Sort by', sortOptions, s.sort, s.sort !== 'all'),
    filterDropdown('mood', 'Mood', moodOptions, s.moodFilter, s.moodFilter != null)
  ]));
  sortRow.appendChild(h('div', { style: { display: 'flex', flex: 'none', border: '1px solid rgba(22,21,15,0.14)' } }, [
    h('button', { class: 'btn-icon', style: { width: '34px', height: '32px', border: 'none', background: s.closetView === 'grid' ? '#16150F' : 'transparent', color: s.closetView === 'grid' ? '#F6F4EF' : '#6B665B' }, title: 'Editorial 2-up', onclick: () => store.set({ closetView: 'grid' }) }, icon.iconGrid()),
    h('button', { class: 'btn-icon', style: { width: '34px', height: '32px', border: 'none', borderLeft: '1px solid rgba(22,21,15,0.14)', background: s.closetView === 'feed' ? '#16150F' : 'transparent', color: s.closetView === 'feed' ? '#F6F4EF' : '#6B665B' }, title: 'Full-bleed feed', onclick: () => store.set({ closetView: 'feed' }) }, icon.iconFeed())
  ]));
  filters.appendChild(sortRow);

  wrap.appendChild(filters);

  if (s.items.length === 0) {
    wrap.appendChild(emptyBox('Your closet is empty.', 'Tap "Add piece" to photograph and tag your first item.'));
    return wrap;
  }
  if (list.length === 0) {
    const box = h('div', { class: 'screen-pad' });
    box.appendChild(emptyBox('Nothing matches.', 'Clear the filters, or add the piece you were looking for.',
      h('button', { class: 'btn btn-outline', style: { marginTop: '14px', minHeight: '42px', padding: '0 18px' }, onclick: () => store.set({ cat: 'All', sub: null, sort: 'all', moodFilter: null, q: '' }) }, 'Clear filters')));
    wrap.appendChild(box);
    return wrap;
  }

  if (s.closetView === 'grid') {
    const grid = h('div', { class: 'closet-grid screen-pad', style: { marginTop: '18px' } });
    list.forEach(it => grid.appendChild(wardrobeCardGrid(it)));
    wrap.appendChild(grid);
  } else {
    const feed = h('div', { class: 'closet-feed', style: { marginTop: '18px' } });
    list.forEach(it => feed.appendChild(wardrobeCardFeed(it)));
    wrap.appendChild(feed);
  }
  return wrap;
}

function wardrobeCardGrid(it) {
  const card = h('div', { class: 'wcard' });
  const t = thumb(it);
  t.appendChild(h('button', { class: 'fav-btn', onclick: () => store.set({ items: store.state.items.map(x => x.id === it.id ? { ...x, fav: !x.fav } : x) }) }, icon.iconStar(it.fav)));
  t.appendChild(h('div', { class: 'wear-badge' }, 'Worn ' + it.wears + '×'));
  card.appendChild(t);
  const meta = [it.cat, it.sub, it.jtype].filter(Boolean).join(' · ');
  card.appendChild(h('div', { class: 'wcard-body' }, [
    h('div', { class: 'wcard-name' }, it.name),
    h('div', { class: 'wcard-meta' }, meta),
    h('div', { class: 'wcard-foot' }, [
      h('div', { class: 'wcard-mood' }, it.moods.join(' · ')),
      h('div', { class: 'wcard-actions' }, [
        h('button', { onclick: () => store.openEdit(it) }, icon.iconEdit()),
        h('button', { onclick: () => store.del(it) }, icon.iconTrash())
      ])
    ])
  ]));
  return card;
}

function wardrobeCardFeed(it) {
  const card = h('div', { class: 'fcard' });
  const t = thumb(it);
  t.appendChild(h('button', { class: 'fav-btn', style: { width: '44px', height: '44px' }, onclick: () => store.set({ items: store.state.items.map(x => x.id === it.id ? { ...x, fav: !x.fav } : x) }) }, icon.iconStar(it.fav)));
  card.appendChild(t);
  const meta = [it.cat, it.sub, it.jtype].filter(Boolean).join(' · ') + ' · Worn ' + it.wears + '×';
  card.appendChild(h('div', { class: 'fcard-body' }, [
    h('div', { style: { minWidth: 0 } }, [
      h('div', { class: 'fcard-name' }, it.name),
      h('div', { class: 'fcard-meta' }, meta),
      h('div', { class: 'fcard-tags' }, it.moods.map(m => h('span', { class: 'tag-pill' }, m)))
    ]),
    h('div', { style: { display: 'flex', gap: '2px', flex: 'none' } }, [
      iconBtn(icon.iconEdit('#16150F'), () => store.openEdit(it), { lg: true }),
      iconBtn(icon.iconTrash('#16150F'), () => store.del(it), { lg: true })
    ])
  ]));
  return card;
}

function screenIQ() {
  const s = store.state;
  const wrap = h('div', { class: 'screen-pad' });
  wrap.appendChild(eyebrow('Taste engine'));
  wrap.appendChild(h('div', { class: 'title-serif', style: { fontSize: '40px', marginTop: '6px' } }, 'Fashion IQ'));

  const score = store.iqScore();
  const stage = s.history.length < 4 ? 'Just getting to know you' : (s.history.length < 12 ? 'Learning your pairings' : 'Confident on your everyday');
  const panel = h('div', { class: 'iq-panel' });
  panel.appendChild(h('div', { class: 'iq-score-row' }, [
    h('div', { class: 'iq-score' }, String(score)),
    h('div', { style: { paddingBottom: '6px' } }, [h('div', { class: 'eyebrow' }, 'of 100'), h('div', { style: { fontSize: '11.5px', color: '#4B473E', marginTop: '3px' } }, stage)])
  ]));
  panel.appendChild(h('div', { class: 'iq-bar-track' }, h('div', { class: 'iq-bar-fill', style: { width: score + '%' } })));
  const accuracy = s.history.length ? Math.round(s.correct / s.history.length * 100) + '%' : '—';
  panel.appendChild(h('div', { class: 'iq-stats' }, [
    ['Ratings', s.history.length], ['Predicted right', accuracy], ['Coverage', store.ratedTypes().size + '/' + PAIRS.length]
  ].map(x => h('div', { class: 'iq-stat' }, [h('div', { style: { fontSize: '8.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A8579' } }, x[0]), h('div', { class: 'iq-stat-val' }, String(x[1]))]))));
  wrap.appendChild(panel);

  store.ensureCard();
  const card = s.iqCard;
  if (card) {
    const a = store.byId(card.aId), b = store.byId(card.bId);
    const c = h('div', { class: 'iq-card' });
    c.appendChild(h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' } }, [
      h('div', { style: { fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#16150F' } }, card.label),
      h('div', { style: { fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: ac() } }, card.reason)
    ]));
    c.appendChild(h('div', { class: 'iq-pair' }, [a, b].map(it => h('div', { class: 'iq-pair-item' }, [thumb(it), h('div', { class: 'iq-pair-name' }, it ? it.name : '')]))));
    c.appendChild(h('div', { style: { marginTop: '14px', fontSize: '10.5px', color: '#6B665B' } }, ['IQ predicts: ', h('strong', { style: { color: '#16150F' } }, card.prediction)]));
    c.appendChild(h('div', { style: { marginTop: '12px', display: 'flex', gap: '8px' } }, [
      h('button', { class: 'btn btn-primary', style: { flex: 1, minHeight: '50px' }, onclick: () => store.answer(true) }, 'Love it'),
      h('button', { class: 'btn btn-outline', style: { flex: 1, minHeight: '50px' }, onclick: () => store.answer(false) }, 'Not for me')
    ]));
    c.appendChild(h('button', { class: 'btn btn-ghost btn-block', style: { marginTop: '8px', minHeight: '36px', fontSize: '10px' }, onclick: () => store.set({ iqCard: null, nonce: s.nonce + 1, lastVerdict: '' }) }, 'Show another pair'));
    if (s.lastVerdict) c.appendChild(h('div', { style: { marginTop: '12px', borderTop: '1px solid rgba(22,21,15,0.1)', paddingTop: '10px', fontSize: '11px', color: '#4B473E' } }, s.lastVerdict));
    wrap.appendChild(c);
  }

  const under = store.underLearned();
  if (under.length > 0) {
    const b = h('div', { style: { marginTop: '22px' } });
    b.appendChild(eyebrow('Blind spots'));
    b.appendChild(h('div', { style: { marginTop: '4px', fontSize: '11.5px', lineHeight: '1.6', color: '#6B665B' } }, under.length + ' of ' + PAIRS.length + ' combination types are unrated. Rating these teaches IQ more than another everyday pair.'));
    b.appendChild(h('div', { style: { marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' } },
      under.slice(0, 6).map(p => h('button', { class: 'blind-chip', onclick: () => store.set({ focusPair: p, iqCard: null }) }, store.pairLabel(p)))));
    wrap.appendChild(b);
  }

  const hist = h('div', { style: { marginTop: '24px' } });
  hist.appendChild(eyebrow('Rating history'));
  if (s.history.length === 0) {
    hist.appendChild(h('div', { style: { marginTop: '10px', fontSize: '11.5px', lineHeight: '1.6', color: '#6B665B' } }, 'Nothing rated yet. Each verdict teaches the engine which pairs to reach for when you pull an outfit.'));
  }
  s.history.slice(0, 8).forEach(hh => {
    const a = store.byId(hh.aId), b = store.byId(hh.bId);
    const mark = hh.love ? ac() : '#8A8579';
    hist.appendChild(h('div', { class: 'history-row' }, [
      h('div', { class: 'history-mark', style: { background: mark } }),
      h('div', { style: { flex: 1, minWidth: 0 } }, [
        h('div', { class: 'history-pair' }, (a ? a.name : '—') + ' + ' + (b ? b.name : '—')),
        h('div', { class: 'history-meta' }, hh.key + ' · IQ ' + (hh.correct ? 'right' : 'wrong') + ' · ' + new Date(hh.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
      ]),
      h('div', { class: 'history-answer', style: { color: mark } }, hh.love ? 'Love' : 'Pass')
    ]));
  });
  wrap.appendChild(hist);
  return wrap;
}
function screenPlanned() {
  const s = store.state;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const wrap = h('div', { class: 'screen-pad' });
  wrap.appendChild(eyebrow('Fashion calendar'));
  wrap.appendChild(h('div', { class: 'title-serif', style: { fontSize: '40px', marginTop: '6px' } }, 'Planned outfits'));
  wrap.appendChild(h('button', { class: 'btn btn-primary btn-block', style: { marginTop: '18px', letterSpacing: '0.18em' }, onclick: () => store.wizStart() }, 'Plan an outfit'));

  if (s.events.length === 0) {
    wrap.appendChild(emptyBox('No events planned.', 'Plan an outfit for a date and it will sit here with a countdown until you mark it worn.'));
    return wrap;
  }

  s.events.forEach(e => {
    const days = Math.round((new Date(e.date + 'T00:00:00') - today) / 86400000);
    const uniq = Array.from(new Set(e.itemIds));
    const countdown = e.worn ? 'Worn' : (days < 0 ? Math.abs(days) + 'd ago' : (days === 0 ? 'Today' : 'In ' + days + 'd'));
    const badgeBg = e.worn ? '#16150F' : (days <= 3 ? ac() : 'rgba(22,21,15,0.08)');
    const badgeFg = (e.worn || days <= 3) ? '#F6F4EF' : '#4B473E';
    const card = h('div', { class: 'event-card' });
    card.appendChild(h('div', { class: 'event-head' }, [
      h('div', { style: { minWidth: 0 } }, [h('div', { class: 'event-name' }, e.name), h('div', { class: 'event-meta' }, fmt(e.date) + ' · ' + e.vibe)]),
      h('div', { class: 'event-badge', style: { background: badgeBg, color: badgeFg } }, countdown)
    ]));
    card.appendChild(h('div', { class: 'event-thumbs' }, uniq.slice(0, 6).map(id => thumb(store.byId(id)))));
    card.appendChild(h('div', { class: 'event-actions' }, [
      h('button', { class: 'btn', style: { flex: 1, minHeight: '44px', fontSize: '10.5px', letterSpacing: '0.14em', border: '1px solid rgba(22,21,15,0.16)', background: e.worn ? '#16150F' : 'transparent', color: e.worn ? '#F6F4EF' : '#16150F' }, onclick: () => store.eventWorn(e) }, [icon.iconCheck(), h('span', {}, e.worn ? 'Worn · Undo' : 'Mark this outfit worn')]),
      iconBtn(icon.iconEdit('#16150F'), () => store.editEvent(e), { lg: true, title: 'Edit' }),
      iconBtn(icon.iconTrash('#16150F'), () => store.removeEvent(e), { lg: true, title: 'Remove' })
    ]));
    wrap.appendChild(card);
  });
  return wrap;
}

function screenSettings() {
  const s = store.state;
  const wrap = h('div', { class: 'screen-pad' });
  wrap.appendChild(eyebrow('Taxonomy & data'));
  wrap.appendChild(h('div', { class: 'title-serif', style: { fontSize: '40px', marginTop: '6px' } }, 'Settings'));

  // categories
  const catCard = h('div', { class: 'settings-card' });
  catCard.appendChild(h('div', { class: 'settings-card-head' }, [
    h('div', { class: 'settings-card-title' }, 'Wardrobe categories'),
    h('button', { class: 'btn btn-ghost', style: { minHeight: '32px', padding: '0 4px', minWidth: 0, color: s.catEdit ? ac() : '#8A8579', fontSize: '9.5px', letterSpacing: '0.14em' }, onclick: () => store.set({ catEdit: !s.catEdit }) }, s.catEdit ? 'Done' : 'Edit')
  ]));
  if (!s.catEdit) {
    catCard.appendChild(h('div', { style: { marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' } },
      store.allCats().map(c => h('span', { class: 'removable-chip', style: { paddingRight: '11px' } }, c))));
  } else {
    const rows = h('div', { style: { marginTop: '10px', display: 'flex', flexDirection: 'column' } });
    store.allCats().forEach(c => {
      const n = s.items.filter(i => i.cat === c).length;
      rows.appendChild(h('div', { class: 'cat-row' }, [
        textField({ value: c, focusKey: 'cat-' + c, onInput: v => store.renameCat(c, v) }),
        h('div', { style: { flex: 'none', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8579', width: '58px', textAlign: 'right' } }, n + (n === 1 ? ' piece' : ' pieces')),
        iconBtn(icon.iconTrash('#16150F'), () => store.removeCat(c, n))
      ]));
    });
    rows.appendChild(h('div', { style: { marginTop: '9px', fontSize: '10.5px', lineHeight: '1.55', color: '#8A8579' } }, "Renaming a category moves every piece and subcategory with it. A category holding pieces can't be deleted."));
    catCard.appendChild(rows);
  }
  catCard.appendChild(h('div', { class: 'field-row' }, [
    textField({ value: s.newCat, placeholder: 'Swimwear, Co-ords…', focusKey: 'new-cat', onInput: v => store.mutate(st => { st.newCat = v; }), onEnter: addCat }),
    h('button', { class: 'btn btn-primary', onclick: addCat }, 'Add')
  ]));
  function addCat() { const v = store.state.newCat.trim(); if (!v) return; store.set({ customCats: store.state.customCats.concat([v]), subs: { ...store.state.subs, [v]: [] }, newCat: '' }); store.flash('Category added.'); }
  wrap.appendChild(catCard);

  // subcategories
  const subCard = h('div', { class: 'settings-card' });
  subCard.appendChild(h('div', { class: 'settings-card-title' }, 'Subcategories'));
  subCard.appendChild(h('div', { class: 'chip-row', style: { marginTop: '10px' } }, store.allCats().map(c => chip(c, s.settingsParent === c, () => store.set({ settingsParent: c }), 'chip-sm'))));
  subCard.appendChild(h('div', { style: { marginTop: '11px', display: 'flex', flexWrap: 'wrap', gap: '5px' } },
    (s.subs[s.settingsParent] || []).map((x, xi) => h('span', { class: 'removable-chip' }, [x, h('button', {
      onclick: () => {
        const parent = s.settingsParent;
        store.set({ subs: { ...store.state.subs, [parent]: store.state.subs[parent].filter(y => y !== x) } });
        store.flash(x + ' removed from ' + parent + '.', () => {
          const arr = (store.state.subs[parent] || []).slice(); arr.splice(Math.min(xi, arr.length), 0, x);
          store.set({ subs: { ...store.state.subs, [parent]: arr } });
        });
      }
    }, '×')]))));
  subCard.appendChild(h('div', { class: 'field-row' }, [
    textField({ value: s.newSub, placeholder: 'New subcategory under ' + s.settingsParent, focusKey: 'new-sub', onInput: v => store.mutate(st => { st.newSub = v; }), onEnter: addSub }),
    h('button', { class: 'btn btn-primary', onclick: addSub }, 'Add')
  ]));
  function addSub() { const v = store.state.newSub.trim(); if (!v) return; store.set({ subs: { ...store.state.subs, [store.state.settingsParent]: (store.state.subs[store.state.settingsParent] || []).concat([v]) }, newSub: '' }); }
  wrap.appendChild(subCard);

  // tags
  const tagCard = h('div', { class: 'settings-card' });
  tagCard.appendChild(h('div', { class: 'settings-card-title' }, 'Occasion & mood tags'));
  tagCard.appendChild(h('div', { style: { marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' } },
    s.tags.map((t, ti) => h('span', { class: 'removable-chip' }, [t, h('button', {
      onclick: () => {
        store.set({ tags: store.state.tags.filter(x => x !== t) });
        store.flash('Tag "' + t + '" removed.', () => { const arr = store.state.tags.slice(); arr.splice(Math.min(ti, arr.length), 0, t); store.set({ tags: arr }); });
      }
    }, '×')]))));
  tagCard.appendChild(h('div', { class: 'field-row' }, [
    textField({ value: s.newTag, placeholder: 'Temple, Brunch, Travel…', focusKey: 'new-tag', onInput: v => store.mutate(st => { st.newTag = v; }), onEnter: addTag }),
    h('button', { class: 'btn btn-primary', onclick: addTag }, 'Add')
  ]));
  function addTag() { const v = store.state.newTag.trim(); if (!v) return; store.set({ tags: store.state.tags.concat([v]), newTag: '' }); }
  wrap.appendChild(tagCard);

  // data
  const dataCard = h('div', { class: 'settings-card' });
  dataCard.appendChild(h('div', { class: 'settings-card-title' }, 'Wardrobe data'));
  dataCard.appendChild(h('div', { style: { marginTop: '10px', fontSize: '11.5px', lineHeight: '1.6', color: '#6B665B' } },
    s.items.length + ' pieces · ' + s.events.length + ' planned outfits · ' + s.history.length + ' IQ ratings · all stored on this device.'));
  dataCard.appendChild(h('div', { class: 'eyebrow', style: { marginTop: '12px' } }, 'Recently deleted'));
  if (s.deleted.length === 0) dataCard.appendChild(h('div', { style: { marginTop: '7px', fontSize: '11.5px', color: '#8A8579' } }, 'Empty.'));
  s.deleted.forEach(it => dataCard.appendChild(h('div', { class: 'deleted-row' }, [
    thumb(it, 'deleted-thumb'),
    h('div', { class: 'deleted-name' }, it.name),
    h('button', { class: 'btn btn-outline', style: { flex: 'none', minHeight: '36px', padding: '0 12px', fontSize: '9.5px', letterSpacing: '0.12em' }, onclick: () => store.restore(it) }, 'Restore')
  ])));
  dataCard.appendChild(h('div', { style: { marginTop: '14px', display: 'flex', gap: '6px' } }, [
    h('button', { class: 'btn btn-outline', style: { flex: 1, minHeight: '44px', fontSize: '10px' }, onclick: () => exportBackup() }, 'Export backup'),
    h('button', { class: 'btn btn-outline', style: { flex: 1, minHeight: '44px', fontSize: '10px' }, onclick: () => document.getElementById('backup-import').click() }, 'Import backup')
  ]));
  if (s.dataNote) dataCard.appendChild(h('div', { style: { marginTop: '10px', fontSize: '11px', color: ac() } }, s.dataNote));
  wrap.appendChild(dataCard);

  return wrap;
}

// ── sheet (add/edit piece) ───────────────────────────────────────────
function renderSheet() {
  const s = store.state;
  if (!s.sheet) return null;
  const sh = s.sheet;
  const overlay = h('div', { class: 'sheet-overlay' });
  overlay.appendChild(h('div', { class: 'sheet-scrim', onclick: () => store.setOverlay({ sheet: null }) }));
  const sheet = h('div', { class: 'sheet' });
  sheet.appendChild(h('div', { class: 'sheet-head' }, [
    h('div', { class: 'sheet-title' }, sh.id ? 'Edit piece' : 'Add a piece'),
    h('button', { class: 'btn btn-ghost', style: { minHeight: '36px', padding: '0 6px', minWidth: 0, fontSize: '10px', letterSpacing: '0.14em' }, onclick: () => store.setOverlay({ sheet: null }) }, 'Cancel')
  ]));

  const photoRow = h('div', { class: 'photo-row' });
  const previewItem = { cat: sh.cat, sub: sh.sub, jtype: sh.jtype, photoId: sh.photoId };
  let thumbEl;
  if (sh.photoPreviewUrl) {
    thumbEl = h('div', { class: 'thumb', style: { width: '96px', flex: 'none', aspectRatio: '3/4', border: '1px solid rgba(22,21,15,0.14)' } }, h('img', { src: sh.photoPreviewUrl, alt: '' }));
  } else {
    thumbEl = thumb(previewItem);
    thumbEl.style.width = '96px'; thumbEl.style.flex = 'none'; thumbEl.style.border = '1px solid rgba(22,21,15,0.14)';
  }
  photoRow.appendChild(thumbEl);
  photoRow.appendChild(h('div', { class: 'photo-actions' }, [
    h('button', { class: 'btn btn-outline', onclick: () => document.getElementById('photo-choose').click() }, 'Choose photo'),
    h('button', { class: 'btn btn-outline', onclick: () => document.getElementById('photo-capture').click() }, 'Take photo'),
    h('div', { class: 'photo-hint' }, 'Stored locally on this device.')
  ]));
  sheet.appendChild(photoRow);

  sheet.appendChild(h('div', { class: 'sheet-field-label' }, 'Item name'));
  sheet.appendChild(textField({ value: sh.name, placeholder: 'Ivory Kanjivaram', focusKey: 'sheet-name', onInput: v => store.mutate(st => { st.sheet.name = v; }) }));

  sheet.appendChild(h('div', { class: 'sheet-field-label' }, 'Category'));
  sheet.appendChild(h('div', { class: 'sheet-chip-row' }, store.allCats().map(c => h('button', { class: 'sheet-chip' + (sh.cat === c ? ' active' : ''), onclick: () => store.setOverlay({ sheet: { ...store.state.sheet, cat: c, sub: null, jtype: null } }) }, c))));

  const sheetSubList = sh.cat === 'Jewellery' ? JTYPES : (s.subs[sh.cat] || []);
  if (sh.cat !== 'Jewellery' && sheetSubList.length) {
    sheet.appendChild(h('div', { class: 'sheet-field-label' }, 'Subcategory'));
    sheet.appendChild(h('div', { class: 'sheet-chip-row' }, sheetSubList.map(x => h('button', { class: 'sheet-chip' + (sh.sub === x ? ' active' : ''), onclick: () => store.setOverlay({ sheet: { ...store.state.sheet, sub: store.state.sheet.sub === x ? null : x } }) }, x))));
  }
  if (sh.cat === 'Jewellery') {
    sheet.appendChild(h('div', { class: 'sheet-field-label' }, 'Jewellery type'));
    sheet.appendChild(h('div', { class: 'sheet-chip-row' }, JTYPES.map(x => h('button', { class: 'sheet-chip' + (sh.jtype === x ? ' active' : ''), onclick: () => store.setOverlay({ sheet: { ...store.state.sheet, jtype: store.state.sheet.jtype === x ? null : x } }) }, x))));
  }

  sheet.appendChild(h('div', { class: 'sheet-field-label' }, 'Mood & occasion'));
  sheet.appendChild(h('div', { class: 'sheet-chip-row' }, BASE_MOODS.concat(s.tags).map(m => {
    const has = sh.moods.includes(m);
    return h('button', { class: 'sheet-chip' + (has ? ' active' : ''), onclick: () => { const cur = store.state.sheet; const nowHas = cur.moods.includes(m); store.setOverlay({ sheet: { ...cur, moods: nowHas ? cur.moods.filter(x => x !== m) : cur.moods.concat([m]) } }); } }, m);
  })));

  sheet.appendChild(h('button', { class: 'btn btn-primary btn-block', style: { marginTop: '20px', letterSpacing: '0.18em' }, onclick: () => store.saveSheet() }, sh.id ? 'Save changes' : 'Save to closet'));

  overlay.appendChild(sheet);
  return overlay;
}

// ── wizard ────────────────────────────────────────────────────────────
function renderWizard() {
  const s = store.state;
  const w = s.wiz;
  if (!w) return null;
  const steps = store.wizSteps(w);
  const curStep = steps[w.step];
  const overlay = h('div', { class: 'wizard' });
  const inner = h('div', { class: 'wizard-inner' });

  const head = h('div', { class: 'wiz-head' });
  head.appendChild(h('div', { class: 'wiz-head-row' }, [
    h('div', { class: 'eyebrow' }, 'Step ' + (w.step + 1) + ' of ' + steps.length),
    h('button', { class: 'btn btn-ghost', style: { minHeight: '36px', padding: '0 6px', minWidth: 0, fontSize: '10px', letterSpacing: '0.14em' }, onclick: () => store.setOverlay({ wiz: null }) }, 'Close')
  ]));
  head.appendChild(h('div', { class: 'wiz-title' }, curStep.t));
  head.appendChild(h('div', { class: 'wiz-dots' }, steps.map((x, i) => h('div', { class: 'wiz-dot' + (i <= w.step ? ' active' : '') }))));
  inner.appendChild(head);

  const body = h('div', { class: 'wiz-body' });
  const isJewelleryStep = curStep.k.indexOf('jewellery:') === 0;
  if (['base', 'blouse', 'footwear'].includes(curStep.k) || isJewelleryStep) {
    let list = [];
    if (curStep.k === 'base') list = s.items.filter(i => ['Sarees', 'Lehenga', 'Dresses', 'Suits', 'Jumpsuit', 'Tops'].includes(i.cat) && (!w.vibe || i.moods.includes(w.vibe)));
    if (curStep.k === 'blouse') list = s.items.filter(i => i.cat === 'Blouse');
    if (curStep.k === 'footwear') list = s.items.filter(i => i.cat === 'Footwear');
    if (isJewelleryStep) { const jt = curStep.k.slice('jewellery:'.length); list = s.items.filter(i => i.cat === 'Jewellery' && i.jtype === jt); }
    const selectedId = ({ base: w.baseId, blouse: w.blouseId, footwear: w.shoeId })[curStep.k];
    if (list.length === 0) {
      body.appendChild(h('div', { style: { fontSize: '12px', lineHeight: '1.6', color: '#6B665B' } }, 'Nothing in the wardrobe fits this step yet. Skip it, or add a piece from the Closet first.'));
    } else {
      const grid = h('div', { class: 'wiz-grid' });
      list.forEach(it => {
        const isSel = isJewelleryStep ? w.jewelIds.includes(it.id) : selectedId === it.id;
        const opt = h('button', { class: 'wiz-option' + (isSel ? ' selected' : ''), onclick: () => store.wizSelect(curStep.k, it.id) });
        opt.appendChild(thumb(it));
        opt.appendChild(h('div', { class: 'wiz-option-body' }, [h('div', { class: 'wiz-option-name' }, it.name), h('div', { class: 'wiz-option-meta' }, it.sub || it.jtype || it.cat)]));
        grid.appendChild(opt);
      });
      body.appendChild(grid);
    }
  } else if (curStep.k === 'vibe') {
    const list = h('div', { class: 'wiz-vibe-list' });
    BASE_MOODS.concat(s.tags).forEach(v => {
      const sel = w.vibe === v;
      const note = v === 'Ethnic' ? 'Sarees, lehengas, kurta sets' : (v === 'Work' ? 'Suits and separates' : (v === 'Dressy' ? 'Evening and occasion' : 'Everyday'));
      list.appendChild(h('button', { class: 'wiz-vibe' + (sel ? ' selected' : ''), onclick: () => { store.setOverlay({ wiz: { ...store.state.wiz, vibe: v } }); store.wizNextSoft(); } }, [
        h('div', {}, [h('div', { class: 'wiz-vibe-label' }, v), h('div', { class: 'wiz-vibe-note' }, note)]),
        h('div', { style: { fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: ac() } }, sel ? 'Chosen' : '')
      ]));
    });
    body.appendChild(list);
  } else if (curStep.k === 'details') {
    body.appendChild(h('div', { class: 'sheet-field-label' }, 'Event name'));
    body.appendChild(textField({ value: w.name, placeholder: "Anjali's mehndi", focusKey: 'wiz-name', onInput: v => store.mutate(st => { st.wiz.name = v; }) }));
    body.appendChild(h('div', { class: 'sheet-field-label' }, 'Date'));
    body.appendChild(textField({ type: 'date', value: w.date, focusKey: 'wiz-date', onInput: v => store.setOverlay({ wiz: { ...store.state.wiz, date: v } }) }));
  } else if (curStep.k === 'review') {
    const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    body.appendChild(h('div', { class: 'wiz-review-name' }, w.name.trim() || 'Untitled event'));
    body.appendChild(h('div', { class: 'wiz-review-meta' }, fmt(w.date) + ' · ' + (w.vibe || '—')));
    const roles = [['Base', w.baseId], ['Blouse', w.blouseId], ['Footwear', w.shoeId]].concat(w.jewelIds.map(id => { const it = store.byId(id); return [it && it.jtype ? it.jtype : 'Jewellery', id]; }));
    const list = h('div', { style: { marginTop: '14px', display: 'flex', flexDirection: 'column' } });
    roles.filter(r => r[1]).forEach(r => {
      const it = store.byId(r[1]);
      list.appendChild(h('div', { class: 'wiz-review-row' }, [thumb(it), h('div', { style: { flex: 1, minWidth: 0 } }, [h('div', { style: { fontSize: '8.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8A8579' } }, r[0]), h('div', { style: { fontFamily: "'Instrument Serif',Georgia,serif", fontSize: '17px', color: '#16150F', marginTop: '2px' } }, it ? it.name : '')])]));
    });
    body.appendChild(list);
    body.appendChild(h('div', { style: { marginTop: '12px', fontSize: '11px', lineHeight: '1.6', color: '#6B665B' } }, 'Each unique piece appears once. Marking this worn increments every piece exactly one time.'));
  }
  inner.appendChild(body);

  const nextLabel = curStep.k === 'review' ? (w.editId ? 'Save changes' : 'Save planned outfit') : 'Continue';
  inner.appendChild(h('div', { class: 'wiz-foot' }, [
    h('button', { class: 'btn btn-outline', style: { flex: 'none', minHeight: '50px', padding: '0 18px' }, onclick: () => store.wizBack() }, 'Back'),
    h('button', { class: 'btn btn-primary', style: { flex: 1, minHeight: '50px' }, onclick: () => store.wizNext() }, nextLabel)
  ]));

  overlay.appendChild(inner);
  return overlay;
}

function renderToast() {
  const s = store.state;
  if (!s.toast) return null;
  const t = h('div', { class: 'toast' }, [
    h('div', { class: 'toast-dot' }),
    h('div', { class: 'toast-msg' }, s.toast)
  ]);
  if (s.undoFn) t.appendChild(h('button', { class: 'toast-undo', onclick: () => { const f = store.state.undoFn; store.setOverlay({ toast: '', undoFn: null }); if (f) f(); } }, 'Undo'));
  t.appendChild(h('button', { class: 'toast-close', onclick: () => store.setOverlay({ toast: '', undoFn: null }) }, icon.iconClose()));
  return t;
}

function navButtons(activeKey) {
  return NAV.map(n => {
    const active = activeKey === n.key;
    const btn_ = h('button', { class: 'nav-btn' + (active ? ' active' : ''), onclick: () => store.set({ screen: n.key }) });
    btn_.appendChild(h('div', { class: 'nav-bar' }));
    btn_.appendChild(icon.iconNav(NAV_ICONS[n.key], active ? ac() : '#8A8579', active ? 1.9 : 1.4));
    btn_.appendChild(h('span', {}, n.label));
    return btn_;
  });
}

const SCREEN_MAP = { put: screenOutfit, closet: screenCloset, iq: screenIQ, planned: screenPlanned, settings: screenSettings };

// The app shell (nav rails, the .screen scroll container, the bottom nav,
// the overlays host) is built ONCE and kept mounted from then on. Every
// earlier bug report of "the page jumps to the top" (locking/shuffling an
// outfit slot, starring an item, changing a filter, rating an IQ pair —
// anything that re-renders while scrolled down) traced back to the same
// cause: renderApp() used to tear down and recreate the whole DOM tree
// every time, including the .screen div itself, so its scrollTop was
// always a fresh 0. Now a render only replaces the *contents* of the
// existing .screen node when the active tab hasn't changed, which leaves
// its scrollTop untouched; switching tabs still resets to the top, which
// is the one case where that's actually wanted.
let mounted = null;

function buildShell(root) {
  const frame = h('div', { class: 'app-frame' });
  const shell = h('div', { class: 'shell has-side-nav' });

  const sideNav = h('div', { class: 'side-nav' });
  shell.appendChild(sideNav);

  const screenArea = h('div', { class: 'screen-area', style: { display: 'flex', flexDirection: 'column', flex: '1', minWidth: 0, minHeight: 0, position: 'relative' } });
  const screenWrap = h('div', { class: 'screen' });
  screenArea.appendChild(screenWrap);
  const bottomNav = h('div', { class: 'bottom-nav' });
  screenArea.appendChild(bottomNav);
  const overlaysEl = h('div', { class: 'overlays-root' });
  screenArea.appendChild(overlaysEl);

  shell.appendChild(screenArea);
  frame.appendChild(shell);
  root.appendChild(frame);

  mounted = { root, sideNav, screenWrap, bottomNav, overlaysEl, fabEl: null, lastScreen: null };
}

function updateNav() {
  const s = store.state;
  clear(mounted.sideNav);
  mounted.sideNav.appendChild(h('div', { class: 'side-brand' }, 'The Closet'));
  navButtons(s.screen).forEach(b => mounted.sideNav.appendChild(b));
  clear(mounted.bottomNav);
  mounted.bottomNav.appendChild(h('div', { class: 'nav-row' }, navButtons(s.screen)));
}

function updateFab() {
  const s = store.state;
  if (mounted.fabEl) { mounted.fabEl.remove(); mounted.fabEl = null; }
  if (s.screen === 'closet') {
    mounted.fabEl = h('button', { class: 'fab', onclick: () => store.openAdd() }, [icon.iconPlus(), 'Add piece']);
    mounted.bottomNav.parentNode.insertBefore(mounted.fabEl, mounted.bottomNav);
  }
}

function updateScreenContent() {
  const s = store.state;
  const switchedTab = mounted.lastScreen !== s.screen;
  clear(mounted.screenWrap);
  mounted.screenWrap.appendChild((SCREEN_MAP[s.screen] || screenOutfit)());
  if (switchedTab) mounted.screenWrap.scrollTop = 0;
  mounted.lastScreen = s.screen;
}

function renderOverlaysInto(container) {
  clear(container);
  const sheetEl = renderSheet();
  if (sheetEl) container.appendChild(sheetEl);
  const wizEl = renderWizard();
  if (wizEl) container.appendChild(wizEl);
  const toastEl = renderToast();
  if (toastEl) container.appendChild(toastEl);
}

export function renderOverlaysOnly(root) {
  if (!mounted || mounted.root !== root) { renderApp(root); return; }
  renderOverlaysInto(mounted.overlaysEl);
}

export function renderApp(root) {
  document.documentElement.style.setProperty('--accent', ac());
  if (!mounted || mounted.root !== root) {
    clear(root);
    buildShell(root);
  }
  updateNav();
  updateScreenContent();
  updateFab();
  renderOverlaysInto(mounted.overlaysEl);
}
