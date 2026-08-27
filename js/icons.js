import { svg } from './dom.js?v=11';

const wrap = (w, h_, viewBox, inner, stroke = 'currentColor', strokeWidth = 1.5, fill = 'none') =>
  `<svg width="${w}" height="${h_}" viewBox="${viewBox}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}">${inner}</svg>`;

export const iconSearch = (stroke = '#8A8579') => svg(wrap(15, 15, '0 0 24 24', '<circle cx="11" cy="11" r="6"></circle><path d="M16 16l4 4"></path>', stroke, 1.6));
export const iconPull = () => svg(wrap(16, 16, '0 0 24 24', '<path d="M4 8h12l-3-3M20 16H8l3 3"></path>'));
export const iconLock = (stroke = 'currentColor') => svg(wrap(15, 15, '0 0 24 24', '<rect x="5" y="11" width="14" height="9"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>', stroke));
export const iconShuffle = () => svg(wrap(15, 15, '0 0 24 24', '<path d="M4 7h4l8 10h4M4 17h4l3-3.6M16 7h4M18 5l2 2-2 2M18 15l2 2-2 2"></path>'));
export const iconCheck = (strokeWidth = 1.8) => svg(wrap(15, 15, '0 0 24 24', '<path d="M4 12.5l5 5L20 6.5"></path>', 'currentColor', strokeWidth));
export const iconStar = (filled, stroke = '#16150F') => svg(wrap(15, 15, '0 0 24 24', '<path d="M12 4.5l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.4-.7z"></path>', stroke, 1.4, filled ? '#16150F' : 'none'));
export const iconEdit = (stroke = '#6B665B') => svg(wrap(13, 13, '0 0 24 24', '<path d="M5 19h4l10-10-4-4L5 15z"></path>', stroke));
export const iconTrash = (stroke = '#6B665B') => svg(wrap(13, 13, '0 0 24 24', '<path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"></path>', stroke));
export const iconPlus = () => svg(wrap(15, 15, '0 0 24 24', '<path d="M12 5v14M5 12h14"></path>', 'currentColor', 1.8));
export const iconClose = () => svg(wrap(13, 13, '0 0 24 24', '<path d="M6 6l12 12M18 6L6 18"></path>', 'currentColor', 1.6));
export const iconGrid = () => svg(wrap(14, 14, '0 0 24 24', '<rect x="4" y="4" width="7" height="16"></rect><rect x="13" y="4" width="7" height="16"></rect>', 'currentColor', 1.6));
export const iconFeed = () => svg(wrap(14, 14, '0 0 24 24', '<rect x="4" y="4" width="16" height="7"></rect><rect x="4" y="13" width="16" height="7"></rect>', 'currentColor', 1.6));
export const iconCamera = () => svg(wrap(16, 16, '0 0 24 24', '<path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.4"></circle>', 'currentColor', 1.5));
export const iconNav = (pathD, color, strokeWidth) => svg(`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="square"><path d="${pathD}"></path></svg>`);
