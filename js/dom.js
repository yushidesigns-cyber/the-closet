export function h(tag, props, children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v; // trusted static markup only (icons) — never user text
    else if (k === 'checked' || k === 'disabled') { el[k] = !!v; }
    else if (k === 'value') { el.value = v; }
    else el.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : children != null ? [children] : []).forEach(c => append(el, c));
  return el;
}
function append(el, c) {
  if (c == null || c === false) return;
  if (Array.isArray(c)) { c.forEach(x => append(el, x)); return; }
  el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
}

export function svg(markup) {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstChild;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
