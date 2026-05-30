/**
 * SpeedDialPage.jsx — Chrome-style speed dial (reference layout).
 *
 * Shared across all employees — any user can add/edit tiles visible to everyone.
 * Navbar: [Home] [Folder tabs…] [+]  ···  [Search] [Settings] [Clock]
 * Body:   minimal shortcut tile grid on pure black background
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const API_BASE = '/api';
const TILE_WIDTH = 230;
const TILE_IMAGE_HEIGHT = 186;
const TILE_ICON_HEIGHT = 162;
const TILE_ICON_INNER = 112;
const TILES_PER_ROW = 5;
const TILE_LABEL_CLASS = 'text-[15px] font-semibold text-white/95 text-center leading-snug w-full line-clamp-2 px-1';
const DROP_TARGET_HOME = '__speed_dial_home__';
const NAV_ROOT_TAB_LABEL = 'Home';
const PAGE_TITLE = 'Speed Dial';

function getUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('userData') || '{}');
    return u._id || u.id || u.user_id || localStorage.getItem('userId') || localStorage.getItem('user_id') || '';
  } catch {
    return localStorage.getItem('userId') || localStorage.getItem('user_id') || '';
  }
}

function ensureUrl(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

function getDomain(url) {
  try {
    return new URL(ensureUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url || '';
  }
}

function titleFromUrl(raw) {
  const domain = getDomain(raw);
  if (!domain) return '';
  const parts = domain.split('.').filter(Boolean);
  if (!parts.length) return '';
  // google.com → Google, mail.google.com → Google
  const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (base === 'www') return parts.length >= 2 ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : 'Shortcut';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function looksLikeUrl(str) {
  if (!str) return false;
  const s = str.trim();
  if (/\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^www\./i.test(s)) return true;
  if (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(s)) return true;
  return false;
}

function displayTitle(item) {
  const title = (item?.title || '').trim();
  const url = (item?.url || '').trim();
  if (title && !looksLikeUrl(title)) return title;
  if (title && looksLikeUrl(title)) {
    const fromTitle = titleFromUrl(title);
    if (fromTitle) return fromTitle;
  }
  if (url) return titleFromUrl(url) || 'Shortcut';
  return 'Shortcut';
}

function normalizeTitleForForm(title, url) {
  const t = (title || '').trim();
  if (t && !looksLikeUrl(t)) return t;
  if (t && looksLikeUrl(t)) return titleFromUrl(t) || '';
  if (url) return titleFromUrl(url) || '';
  return '';
}

function getFavicon(url) {
  const domain = getDomain(url);
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`;
}

function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const m = url.match(/^https?:\/\/crm\.fixyourfinance\.ai(?::\d+)?\/(.*)/);
    if (m) return `/api/${m[1]}`;
    return url;
  }
  if (url.startsWith('/media/')) return `/api${url}`;
  if (url.startsWith('/api/')) return url;
  return url;
}

function letterAvatar(title) {
  const ch = (title || '?').trim().charAt(0).toUpperCase() || '?';
  const palette = ['#374151', '#4b5563', '#52525b', '#57534e', '#44403c'];
  const colour = palette[ch.charCodeAt(0) % palette.length];
  return { ch, colour };
}

async function parseApiError(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.detail || json.message || text;
  } catch {
    return text || `Request failed (${res.status})`;
  }
}

function useLiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      setTime(new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }).format(new Date()));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ── Add / Edit modal ─────────────────────────────────────────

function ItemModal({ existing, mode, parentId, onSave, onClose }) {
  const isFolder = (existing?.type || mode) === 'folder';
  const normalizedExistingTitle = !isFolder
    ? normalizeTitleForForm(existing?.title, existing?.url)
    : (existing?.title || '');
  const [title, setTitle] = useState(normalizedExistingTitle);
  const [url, setUrl] = useState(existing?.url || '');
  const [titleTouched, setTitleTouched] = useState(!!(existing?.title && !looksLikeUrl(existing?.title)));
  const [imageUrl, setImageUrl] = useState(existing?.image_url || '');
  const [imagePreview, setImagePreview] = useState(resolveMediaUrl(existing?.image_url || ''));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleUrlChange = (value) => {
    setUrl(value);
    if (!titleTouched && value.trim()) {
      setTitle(titleFromUrl(value));
    }
  };

  const handleUrlBlur = () => {
    if (!isFolder && url.trim() && !title.trim()) {
      setTitle(titleFromUrl(url));
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setError('Please choose an image file');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target.result);
    reader.readAsDataURL(file);

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('image', file);
      const userId = getUserId();
      const res = await fetch(`${API_BASE}/speed-dial/upload-image?user_id=${userId}`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setImageUrl(data.image_url);
      setImagePreview(resolveMediaUrl(data.image_url));
    } catch (e) {
      setError('Upload failed: ' + e.message);
      setImagePreview(resolveMediaUrl(imageUrl));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    let finalTitle = title.trim();
    if (!isFolder && !finalTitle && url.trim()) {
      finalTitle = titleFromUrl(url);
    }
    if (!finalTitle) {
      setError('Title is required');
      return;
    }
    if (!isFolder && looksLikeUrl(finalTitle)) {
      finalTitle = titleFromUrl(finalTitle) || titleFromUrl(url) || finalTitle;
    }
    if (!isFolder && url.trim() && finalTitle.toLowerCase() === getDomain(url).toLowerCase()) {
      finalTitle = titleFromUrl(url) || finalTitle;
    }
    if (!isFolder && !url.trim()) {
      setError('URL is required for links');
      return;
    }

    setSaving(true);
    try {
      const userId = getUserId();
      const payload = { title: finalTitle };
      if (!isFolder) {
        payload.url = ensureUrl(url);
        payload.image_url = imageUrl || '';
      }
      let res;
      if (existing) {
        res = await fetch(`${API_BASE}/speed-dial/items/${existing._id}?user_id=${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        payload.type = isFolder ? 'folder' : 'link';
        payload.parent_id = parentId || null;
        res = await fetch(`${API_BASE}/speed-dial/items?user_id=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error(await parseApiError(res));
      onSave();
    } catch (e) {
      setError('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">
            {existing ? `Edit ${isFolder ? 'Folder' : 'Shortcut'}` : `Add ${isFolder ? 'Folder' : 'Shortcut'}`}
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="space-y-3">
          {!isFolder && (
            <div>
              <label className="text-xs font-semibold text-white/50 mb-1 block">URL *</label>
              <input
                autoFocus
                value={url}
                onChange={e => handleUrlChange(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://example.com"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-white/50 mb-1 block">Title *</label>
            <input
              autoFocus={isFolder}
              value={title}
              onChange={e => { setTitleTouched(true); setTitle(e.target.value); }}
              placeholder={isFolder ? 'e.g. Work tools' : 'e.g. Gmail'}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
            />
          </div>

          {!isFolder && (
            <div>
              <label className="text-xs font-semibold text-white/50 mb-1 block">Custom image (optional)</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                  ) : url ? (
                    <img src={getFavicon(url)} alt="" className="w-8 h-8" />
                  ) : (
                    <span className="text-white/20 text-2xl">🖼️</span>
                  )}
                </div>
                <label className="cursor-pointer px-3 py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:bg-white/5">
                  {uploading ? 'Uploading…' : (imageUrl ? 'Change image' : 'Upload image')}
                  <input type="file" accept="image/*" hidden onChange={e => handleFile(e.target.files?.[0])} />
                </label>
                {imageUrl && (
                  <button type="button" onClick={() => { setImageUrl(''); setImagePreview(''); }} className="text-xs text-red-400 hover:underline">
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{error}</div>
          )}
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-sm font-medium text-white/60 hover:bg-white/5">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || uploading} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-bold hover:bg-white/90 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContextMenu({ menu, onEdit, onDelete, onClose }) {
  if (!menu) return null;
  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="fixed z-[100] min-w-[140px] bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl py-1 overflow-hidden"
        style={{ left: menu.x, top: menu.y }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => { onEdit(menu.item); onClose(); }}
          className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button
          type="button"
          onClick={() => { onDelete(menu.item); onClose(); }}
          className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
          </svg>
          Delete
        </button>
      </div>
    </>
  );
}

function FolderPreviewGrid({ childPreview, width = TILE_WIDTH, height = TILE_ICON_HEIGHT }) {
  return (
    <div
      className="rounded-sm bg-white/5 border border-white/10 grid grid-cols-2 grid-rows-2 gap-1 p-2 flex-shrink-0"
      style={{ width, height }}
    >
      {Array.from({ length: 4 }).map((_, i) => {
        const child = childPreview[i];
        if (!child) return <div key={i} className="rounded bg-white/5" />;
        return (
          <div key={i} className="rounded overflow-hidden bg-black flex items-center justify-center">
            {child.type === 'folder' ? (
              <span className="text-[10px]">📁</span>
            ) : child.image_url ? (
              <img src={resolveMediaUrl(child.image_url)} alt="" className="w-full h-full object-cover" draggable={false} />
            ) : child.url ? (
              <img src={getFavicon(child.url)} alt="" className="w-4 h-4" draggable={false} />
            ) : (
              <span className="text-[9px] font-bold text-white/60">{(child.title || '?').charAt(0).toUpperCase()}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NavTabDropTarget({
  id,
  title,
  isActive,
  isExpanded,
  isDropHover,
  isReorderHover = false,
  draggable = false,
  childPreview = [],
  onClick,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) {
  if (!isExpanded) {
    return (
      <button
        type="button"
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
        title={title}
        className={`shrink-0 text-sm font-semibold transition-colors px-2 py-1 rounded-md max-w-[220px] truncate ${
          isActive ? 'text-white' : 'text-white/45 hover:text-white/80'
        } ${isDropHover ? 'ring-2 ring-sky-400 bg-sky-500/15 text-white' : ''} ${
          isReorderHover ? 'ring-2 ring-amber-400 bg-amber-500/15 text-white scale-105' : ''
        } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {title}
      </button>
    );
  }

  const isSpeedDialRoot = id === DROP_TARGET_HOME;

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative shrink-0 rounded-xl cursor-pointer transition-all ${
        isDropHover
          ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black bg-sky-500/15 scale-[1.01]'
          : 'ring-2 ring-sky-400/60 ring-offset-2 ring-offset-black bg-sky-500/10'
      }`}
      style={{ width: TILE_WIDTH }}
    >
      <div className="flex flex-col items-center gap-3 px-1 py-1">
        {isSpeedDialRoot ? (
          <div
            className="rounded-sm border border-dashed border-sky-400/40 bg-sky-500/10 flex items-center justify-center text-sky-300/70"
            style={{ width: TILE_WIDTH, height: TILE_ICON_HEIGHT }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
        ) : (
          <FolderPreviewGrid childPreview={childPreview} />
        )}
        <div className={TILE_LABEL_CLASS} title={title}>
          {title}
        </div>
      </div>
    </div>
  );
}

function NavDropPanel({ targetId, title, childPreview, isDropHover, onDragOver, onDrop }) {
  const isSpeedDialRoot = targetId === DROP_TARGET_HOME;
  return (
    <div
      className={`shrink-0 border-b transition-colors ${
        isDropHover ? 'border-sky-400/50 bg-sky-500/10' : 'border-sky-400/25 bg-sky-500/5'
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="px-8 py-6 flex flex-col items-start gap-3">
        <p className="text-xs font-medium text-sky-300/80 uppercase tracking-wide">
          Drop shortcut into {title}
        </p>
        <div
          className={`rounded-xl transition-all ${
            isDropHover ? 'ring-2 ring-sky-400 bg-sky-500/10' : 'ring-2 ring-sky-400/40'
          }`}
          style={{ width: TILE_WIDTH }}
        >
          <div className="flex flex-col items-center gap-3 px-1 py-1 pointer-events-none">
            {isSpeedDialRoot ? (
              <div
                className="rounded-sm border border-dashed border-sky-400/40 bg-sky-500/10 flex items-center justify-center text-sky-300/70"
                style={{ width: TILE_WIDTH, height: TILE_ICON_HEIGHT }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
            ) : (
              <FolderPreviewGrid childPreview={childPreview} />
            )}
            <div className={TILE_LABEL_CLASS}>{title}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkTile({ item, dragging, dragOver, onContextMenu, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [faviconErr, setFaviconErr] = useState(false);
  const url = ensureUrl(item.url);
  const tileTitle = displayTitle(item);
  const { ch, colour } = letterAvatar(tileTitle);
  const faviconUrl = url ? getFavicon(url) : '';
  const customImg = item.image_url ? resolveMediaUrl(item.image_url) : '';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item._id)}
      onDragOver={(e) => onDragOver(e, item._id)}
      onDrop={(e) => onDrop(e, item._id)}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => onContextMenu(e, item)}
      className={`relative cursor-grab active:cursor-grabbing ${dragging === item._id ? 'opacity-40' : ''} ${dragOver === item._id ? 'ring-2 ring-white/30 rounded-xl' : ''}`}
      style={{ width: TILE_WIDTH }}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        className="flex flex-col items-center gap-3 px-1 py-1 hover:opacity-90 transition-opacity"
      >
        <div
          className={`overflow-hidden flex-shrink-0 ${customImg ? 'rounded-sm bg-black/20' : 'rounded-2xl bg-white flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.35)]'}`}
          style={{ width: TILE_WIDTH, height: customImg ? TILE_IMAGE_HEIGHT : TILE_ICON_HEIGHT }}
        >
          {customImg ? (
            <img src={customImg} alt="" className="w-full h-full object-cover" draggable={false} style={{ width: TILE_WIDTH, height: TILE_IMAGE_HEIGHT }} />
          ) : faviconUrl && !faviconErr ? (
            <img
              src={faviconUrl}
              alt=""
              className="object-contain"
              style={{ width: TILE_ICON_INNER, height: TILE_ICON_INNER }}
              onError={() => setFaviconErr(true)}
              draggable={false}
            />
          ) : (
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: TILE_ICON_INNER, height: TILE_ICON_INNER, background: colour }}
            >
              <span className="text-white font-bold text-3xl">{ch}</span>
            </div>
          )}
        </div>
        <div className={TILE_LABEL_CLASS} title={tileTitle}>
          {tileTitle}
        </div>
      </a>
    </div>
  );
}

function FolderTile({ item, childPreview, dragging, dragOverFolder, onOpen, onContextMenu, onDragStart, onDragOverFolder, onDropOnFolder, onDragEnd }) {
  const isDropTarget = dragOverFolder === item._id;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item._id)}
      onDragOver={(e) => onDragOverFolder(e, item._id)}
      onDrop={(e) => onDropOnFolder(e, item._id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(item)}
      onContextMenu={(e) => onContextMenu(e, item)}
      className={`relative cursor-grab active:cursor-grabbing rounded-xl transition-all ${
        dragging === item._id ? 'opacity-40' : ''
      } ${isDropTarget ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black bg-sky-500/10 scale-[1.02]' : ''}`}
      style={{ width: TILE_WIDTH }}
    >
      <div className="flex flex-col items-center gap-3 px-1 py-1 hover:opacity-90 transition-opacity cursor-pointer">
        <FolderPreviewGrid childPreview={childPreview} />
        <div className={TILE_LABEL_CLASS} title={item.title}>
          {item.title}
        </div>
      </div>
    </div>
  );
}

function AddTile({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Add shortcut"
      style={{ width: TILE_WIDTH }}
      className="flex flex-col items-center gap-3 px-1 py-1 group shrink-0"
    >
      <div
        className="rounded-sm border border-dashed border-white/25 flex items-center justify-center text-white/30 group-hover:border-white/45 group-hover:text-white/50 transition-colors"
        style={{ width: TILE_WIDTH, height: TILE_IMAGE_HEIGHT }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <div className="text-[13px] font-semibold text-white/30 group-hover:text-white/50 uppercase tracking-wide transition-colors">
        Add Shortcut
      </div>
    </button>
  );
}

export default function SpeedDialPage() {
  const userId = getUserId();
  const clock = useLiveClock();
  const [rootItems, setRootItems] = useState([]);
  const [folderItems, setFolderItems] = useState([]);
  const [folderPreviews, setFolderPreviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [nestedPath, setNestedPath] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [navExpandedTargetId, setNavExpandedTargetId] = useState(null);
  const [navReorderOverId, setNavReorderOverId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const rootFolders = rootItems.filter(it => it.type === 'folder');
  const homeLinks = rootItems.filter(it => it.type === 'link');
  const currentParentId = activeTab
    ? (nestedPath.length ? nestedPath[nestedPath.length - 1].id : activeTab)
    : null;
  const displayItems = activeTab ? folderItems : homeLinks;

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return displayItems;
    return displayItems.filter(it =>
      (it.title || '').toLowerCase().includes(q) ||
      (it.url || '').toLowerCase().includes(q)
    );
  }, [displayItems, searchQuery]);

  const loadRoot = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setError('');
    try {
      const res = await fetch(`${API_BASE}/speed-dial/items?user_id=${userId}`);
      if (!res.ok) throw new Error(await parseApiError(res));
      setRootItems(await res.json() || []);
    } catch (e) {
      setError(e.message || 'Failed to load shortcuts');
    }
  }, [userId]);

  const loadFolderContent = useCallback(async () => {
    if (!userId || !activeTab) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/speed-dial/items?user_id=${userId}&parent_id=${currentParentId}`
      );
      if (!res.ok) throw new Error(await parseApiError(res));
      setFolderItems(await res.json() || []);
    } catch (e) {
      setError(e.message || 'Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, currentParentId]);

  const fetchFolderPreview = useCallback(async (folderId) => {
    if (folderPreviews[folderId] !== undefined) return;
    try {
      const res = await fetch(`${API_BASE}/speed-dial/items?user_id=${userId}&parent_id=${folderId}`);
      if (!res.ok) return;
      const data = await res.json();
      setFolderPreviews(prev => ({ ...prev, [folderId]: data.slice(0, 4) }));
    } catch { /* ignore */ }
  }, [userId, folderPreviews]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadRoot();
      setLoading(false);
    };
    init();
  }, [loadRoot]);

  useEffect(() => {
    if (activeTab) loadFolderContent();
    else { setFolderItems([]); setNestedPath([]); }
  }, [activeTab, currentParentId, loadFolderContent]);

  useEffect(() => {
    displayItems.forEach(it => {
      if (it.type === 'folder') fetchFolderPreview(it._id);
    });
  }, [displayItems, fetchFolderPreview]);

  useEffect(() => {
    if (navExpandedTargetId && navExpandedTargetId !== DROP_TARGET_HOME) {
      fetchFolderPreview(navExpandedTargetId);
    }
  }, [navExpandedTargetId, fetchFolderPreview]);

  const navExpandedTitle = useMemo(() => {
    if (!navExpandedTargetId) return '';
    if (navExpandedTargetId === DROP_TARGET_HOME) return NAV_ROOT_TAB_LABEL;
    return rootFolders.find(f => f._id === navExpandedTargetId)?.title || 'Folder';
  }, [navExpandedTargetId, rootFolders]);

  const draggingRootFolder = useMemo(
    () => Boolean(draggingId && rootFolders.some(f => f._id === draggingId)),
    [draggingId, rootFolders]
  );

  const isNavDragging = Boolean(draggingId && navExpandedTargetId && !draggingRootFolder);

  const refreshAll = async () => {
    setFolderPreviews({});
    await loadRoot();
    if (activeTab) await loadFolderContent();
  };

  const persistOrder = async (parentId, orderedItems) => {
    const res = await fetch(`${API_BASE}/speed-dial/items/reorder?user_id=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent_id: parentId,
        item_ids: orderedItems.map(it => it._id),
      }),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
  };

  const fetchItemsForParent = async (parentId) => {
    const query = parentId
      ? `${API_BASE}/speed-dial/items?user_id=${userId}&parent_id=${parentId}`
      : `${API_BASE}/speed-dial/items?user_id=${userId}`;
    const res = await fetch(query);
    if (!res.ok) throw new Error(await parseApiError(res));
    return await res.json() || [];
  };

  const moveItemToFolder = async (itemId, targetFolderId) => {
    if (!itemId || itemId === targetFolderId) return;

    const sourceParentId = currentParentId;
    if (sourceParentId === targetFolderId) return;

    const targetItems = await fetchItemsForParent(targetFolderId);
    const targetIds = targetItems.map(it => it._id).filter(id => id !== itemId);
    targetIds.push(itemId);
    await persistOrder(
      targetFolderId,
      targetIds.map(id => ({ _id: id }))
    );

    const sourceItems = displayItems.filter(it => it._id !== itemId);
    if (sourceItems.length !== displayItems.length) {
      await persistOrder(sourceParentId, sourceItems);
    }

    setFolderPreviews({});
    await refreshAll();
  };

  const moveItemToSpeedDial = async (itemId) => {
    if (!itemId) return;
    await moveItemToFolder(itemId, null);
  };

  const reorderRootFolders = async (sourceId, targetId) => {
    const folders = [...rootFolders];
    const fromIdx = folders.findIndex(f => f._id === sourceId);
    const toIdx = folders.findIndex(f => f._id === targetId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const next = [...folders];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    setRootItems(prev => {
      const links = prev.filter(it => it.type === 'link');
      return [...next, ...links];
    });

    try {
      await persistOrder(null, next);
    } catch (err) {
      setError('Folder reorder failed: ' + err.message);
      await refreshAll();
    }
  };

  const reorderDisplayItem = async (sourceId, targetId) => {
    const fromIdx = displayItems.findIndex(it => it._id === sourceId);
    const toIdx = displayItems.findIndex(it => it._id === targetId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const next = [...displayItems];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    if (activeTab) setFolderItems(next);
    else setRootItems(prev => [...next, ...prev.filter(it => it.type === 'folder')]);

    await persistOrder(currentParentId, next);
  };

  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOverLink = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingId || draggingId === id) return;
    const target = displayItems.find(it => it._id === id);
    if (target?.type === 'folder') return;
    setDragOverId(id);
    setDragOverFolderId(null);
    setNavExpandedTargetId(null);
  };

  const handleDragOverFolderTarget = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingId || draggingId === folderId) return;
    setDragOverFolderId(folderId);
    setDragOverId(null);
    setNavExpandedTargetId(null);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragOverNavTarget = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingId || draggingId === folderId) return;

    if (draggingRootFolder) {
      if (folderId === DROP_TARGET_HOME) {
        setNavReorderOverId(null);
        setDragOverFolderId(null);
        return;
      }
      setNavReorderOverId(folderId);
      setDragOverFolderId(null);
      setNavExpandedTargetId(null);
      setDragOverId(null);
      e.dataTransfer.dropEffect = 'move';
      return;
    }

    setDragOverFolderId(folderId);
    setDragOverId(null);
    setNavExpandedTargetId(folderId);
    setNavReorderOverId(null);
    if (folderId !== DROP_TARGET_HOME) fetchFolderPreview(folderId);
    e.dataTransfer.dropEffect = 'move';
  };

  const finishNavDrop = async (sourceId, folderId) => {
    if (folderId === DROP_TARGET_HOME) {
      await moveItemToSpeedDial(sourceId);
      switchTab(null);
    } else {
      await moveItemToFolder(sourceId, folderId);
      switchTab(folderId);
    }
    setNavExpandedTargetId(null);
  };

  const handleDropOnLink = async (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggingId || e.dataTransfer.getData('text/plain');
    setDragOverId(null);
    setDragOverFolderId(null);
    setDraggingId(null);
    if (!sourceId || sourceId === targetId) return;

    const target = displayItems.find(it => it._id === targetId);
    if (target?.type === 'folder') return;

    const fromIdx = displayItems.findIndex(it => it._id === sourceId);
    const toIdx = displayItems.findIndex(it => it._id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...displayItems];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    if (activeTab) setFolderItems(next);
    else setRootItems(prev => [...next, ...prev.filter(it => it.type === 'folder')]);

    try {
      await persistOrder(currentParentId, next);
    } catch (err) {
      setError('Reorder failed: ' + err.message);
      refreshAll();
    }
  };

  const handleDropOnFolder = async (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggingId || e.dataTransfer.getData('text/plain');
    setDragOverFolderId(null);
    setDragOverId(null);
    setDraggingId(null);
    if (!sourceId || sourceId === folderId) return;

    const source = displayItems.find(it => it._id === sourceId);
    const target = displayItems.find(it => it._id === folderId);

    try {
      if (source?.type === 'folder' && target?.type === 'folder') {
        await reorderDisplayItem(sourceId, folderId);
        return;
      }

      const isRootNavFolder = rootFolders.some(f => f._id === folderId);
      await moveItemToFolder(sourceId, folderId);
      if (isRootNavFolder) {
        switchTab(folderId);
        setNavExpandedTargetId(null);
      }
    } catch (err) {
      setError('Move to folder failed: ' + err.message);
      refreshAll();
    }
  };

  const handleDropOnNavTarget = async (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggingId || e.dataTransfer.getData('text/plain');
    const isRootFolderDrag = rootFolders.some(f => f._id === sourceId);
    setDragOverFolderId(null);
    setDragOverId(null);
    setNavReorderOverId(null);
    setDraggingId(null);
    if (!sourceId || sourceId === folderId) return;

    try {
      if (isRootFolderDrag) {
        if (folderId === DROP_TARGET_HOME) return;
        await reorderRootFolders(sourceId, folderId);
        return;
      }
      await finishNavDrop(sourceId, folderId);
    } catch (err) {
      setError('Move failed: ' + err.message);
      refreshAll();
    }
  };

  const handleDropOnSpeedDialTab = async (e) => handleDropOnNavTarget(e, DROP_TARGET_HOME);

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
    setDragOverFolderId(null);
    setNavExpandedTargetId(null);
    setNavReorderOverId(null);
  };

  const openSubFolder = (folder) => {
    setNestedPath(prev => [...prev, { id: folder._id, title: folder.title }]);
    setFolderPreviews({});
  };

  const goToNestedCrumb = (idx) => {
    setNestedPath(prev => prev.slice(0, idx + 1));
    setFolderPreviews({});
  };

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    setNestedPath([]);
    setFolderPreviews({});
    setSearchQuery('');
  };

  const handleEdit = (item) => setModal({ mode: item.type, existing: item });

  const openContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleDelete = async (item) => {
    const msg = item.type === 'folder'
      ? `Delete folder "${item.title}" and all its contents?`
      : `Remove shortcut "${item.title}"?`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`${API_BASE}/speed-dial/items/${item._id}?user_id=${userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await parseApiError(res));
      if (item.type === 'folder' && activeTab === item._id) setActiveTab(null);
      await refreshAll();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const handleSaved = async () => {
    setModal(null);
    await refreshAll();
  };

  const activeFolderTitle = activeTab
    ? rootFolders.find(f => f._id === activeTab)?.title || 'Folder'
    : null;

  useEffect(() => {
    const nestedTitle = nestedPath.length ? nestedPath[nestedPath.length - 1].title : null;
    const section = nestedTitle || activeFolderTitle;
    document.title = section ? `${section} — ${PAGE_TITLE}` : PAGE_TITLE;
  }, [activeFolderTitle, nestedPath]);

  if (!userId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center text-white/50">
          <p className="text-lg font-semibold mb-2">Please log in</p>
          <p className="text-sm">Speed Dial requires an active CRM session.</p>
        </div>
      </div>
    );
  }

  const navExpandedHeight = TILE_ICON_HEIGHT + 72;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* ── Top navbar ── */}
      <nav
        className="sticky top-0 z-30 shrink-0 bg-black border-b border-white/10 transition-[min-height] duration-200"
        style={{ minHeight: isNavDragging ? navExpandedHeight : 72 }}
      >
        <div
          className="flex items-start gap-5 px-7 py-4 transition-[min-height] duration-200"
          style={{ minHeight: isNavDragging ? navExpandedHeight : 72 }}
        >
          {/* Left: folder tabs + add */}
          <div className="flex items-start gap-7 min-w-0 flex-1 overflow-x-auto pt-0.5" style={{ scrollbarWidth: 'none' }}>
            <NavTabDropTarget
              id={DROP_TARGET_HOME}
              title={NAV_ROOT_TAB_LABEL}
              isActive={activeTab === null}
              isExpanded={draggingId && navExpandedTargetId === DROP_TARGET_HOME}
              isDropHover={dragOverFolderId === DROP_TARGET_HOME}
              onClick={() => switchTab(null)}
              onDragOver={(e) => {
                if (!draggingId) return;
                handleDragOverNavTarget(e, DROP_TARGET_HOME);
              }}
              onDrop={handleDropOnSpeedDialTab}
            />

            {rootFolders.map(folder => (
              <NavTabDropTarget
                key={folder._id}
                id={folder._id}
                title={folder.title}
                isActive={activeTab === folder._id}
                isExpanded={draggingId && navExpandedTargetId === folder._id}
                isDropHover={dragOverFolderId === folder._id}
                isReorderHover={navReorderOverId === folder._id}
                draggable
                childPreview={folderPreviews[folder._id] || []}
                onClick={() => switchTab(folder._id)}
                onContextMenu={(e) => openContextMenu(e, folder)}
                onDragStart={(e) => handleDragStart(e, folder._id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => {
                  if (!draggingId) return;
                  handleDragOverNavTarget(e, folder._id);
                }}
                onDrop={(e) => handleDropOnNavTarget(e, folder._id)}
              />
            ))}

            <button
              onClick={() => setModal({ mode: 'folder', existing: null })}
              title="New folder"
              className="shrink-0 text-white/40 hover:text-white/80 text-[1.75rem] leading-none font-light transition-colors px-1"
            >
              +
            </button>
          </div>

          {/* Right: inline search, settings, clock */}
          <div className="flex items-center gap-4 shrink-0">
            {searchOpen && (
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } }}
                placeholder="Search shortcuts…"
                className="w-44 sm:w-56 md:w-64 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
              />
            )}

            <button
              type="button"
              onClick={() => {
                if (searchOpen) setSearchQuery('');
                setSearchOpen(v => !v);
              }}
              className={`transition-colors p-1 ${searchOpen ? 'text-white' : 'text-white/45 hover:text-white'}`}
              title="Search shortcuts"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen(v => !v)}
                className="text-white/45 hover:text-white transition-colors p-1"
                title="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
              {settingsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-48 bg-[#111] border border-white/10 rounded-lg shadow-xl py-1">
                    <button
                      onClick={() => { setSettingsOpen(false); setModal({ mode: 'folder', existing: null }); }}
                      className="w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
                    >
                      New folder
                    </button>
                    <button
                      onClick={() => { setSettingsOpen(false); setModal({ mode: 'link', existing: null }); }}
                      className="w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
                    >
                      Add shortcut
                    </button>
                  </div>
                </>
              )}
            </div>

            <span className="text-sm font-semibold text-white/75 tabular-nums min-w-[72px] text-right">{clock}</span>
          </div>
        </div>
      </nav>

      {isNavDragging && (
        <NavDropPanel
          targetId={navExpandedTargetId}
          title={navExpandedTitle}
          childPreview={navExpandedTargetId === DROP_TARGET_HOME ? [] : (folderPreviews[navExpandedTargetId] || [])}
          isDropHover={dragOverFolderId === navExpandedTargetId}
          onDragOver={(e) => handleDragOverNavTarget(e, navExpandedTargetId)}
          onDrop={(e) => handleDropOnNavTarget(e, navExpandedTargetId)}
        />
      )}

      {/* Sub-folder path inside a tab */}
      {activeTab && nestedPath.length > 0 && (
        <div className="px-6 py-2 border-b border-white/[0.06] shrink-0">
          <div className="text-xs text-white/35 flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setNestedPath([])} className="hover:text-white/70 transition truncate max-w-[140px]" title={activeFolderTitle}>
              {activeFolderTitle}
            </button>
            {nestedPath.map((crumb, i) => (
              <React.Fragment key={crumb.id}>
                <span>/</span>
                <button
                  onClick={() => goToNestedCrumb(i)}
                  className={`hover:text-white/70 transition truncate max-w-[140px] ${i === nestedPath.length - 1 ? 'text-white/60' : ''}`}
                  title={crumb.title}
                >
                  {crumb.title}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ── Shortcut grid ── */}
      <main className="flex-1 flex flex-col items-start justify-start px-8 py-8">
        {error && (
          <div className="mb-6 w-full max-w-4xl text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-white/20 text-sm">Loading…</div>
        ) : (
          <div
            className="grid gap-x-8 gap-y-10 justify-items-start"
            style={{
              gridTemplateColumns: `repeat(${TILES_PER_ROW}, ${TILE_WIDTH}px)`,
            }}
          >
            {filteredItems.map(it =>
              it.type === 'folder' ? (
                <FolderTile
                  key={it._id}
                  item={it}
                  childPreview={folderPreviews[it._id] || []}
                  dragging={draggingId}
                  dragOverFolder={dragOverFolderId}
                  onOpen={openSubFolder}
                  onContextMenu={openContextMenu}
                  onDragStart={handleDragStart}
                  onDragOverFolder={handleDragOverFolderTarget}
                  onDropOnFolder={handleDropOnFolder}
                  onDragEnd={handleDragEnd}
                />
              ) : (
                <LinkTile
                  key={it._id}
                  item={it}
                  dragging={draggingId}
                  dragOver={dragOverId}
                  onContextMenu={openContextMenu}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOverLink}
                  onDrop={handleDropOnLink}
                  onDragEnd={handleDragEnd}
                />
              )
            )}
            <AddTile onClick={() => setModal({ mode: 'link', existing: null })} />
          </div>
        )}

        {!loading && filteredItems.length === 0 && searchQuery && (
          <p className="mt-8 text-white/30 text-sm">No shortcuts match &ldquo;{searchQuery}&rdquo;</p>
        )}
      </main>

      {modal && (
        <ItemModal
          existing={modal.existing}
          mode={modal.mode}
          parentId={modal.mode === 'folder' && !modal.existing ? null : currentParentId}
          onClose={() => setModal(null)}
          onSave={handleSaved}
        />
      )}

      <ContextMenu
        menu={contextMenu}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClose={closeContextMenu}
      />
    </div>
  );
}
