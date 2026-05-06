/**
 * SpeedDialPage.jsx — Redesigned Speed Dial (Chrome-style new-tab).
 *
 * Layout
 * ──────
 *  • Top navbar: [Home tab] [Folder tabs…] ── [📁 New Folder] [+ Add Link]
 *  • Body: centered tile grid (larger tiles, Chrome new-tab style).
 *
 * Navigation
 * ──────────
 *  • Root-level folders → tabs in the navbar.
 *  • Home tab → shows root-level link shortcuts.
 *  • Folder tab → shows that folder's contents (links + sub-folders).
 *  • "New Folder" always creates a root-level folder (new tab).
 *  • "Add Link" creates a link inside the active tab's folder (or root).
 *
 * Storage model is per-user (the backend scopes everything by user_id).
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

// ── tiny helpers ─────────────────────────────────────────────

function getUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('userData') || '{}');
    return u._id || u.id || '';
  } catch {
    return '';
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

function getFavicon(url) {
  const domain = getDomain(url);
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
}

function letterAvatar(title) {
  const ch = (title || '?').trim().charAt(0).toUpperCase() || '?';
  // deterministic colour based on char code
  const palette = [
    '#2563eb', '#0891b2', '#7c3aed', '#db2777',
    '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
    '#0d9488', '#4f46e5',
  ];
  const colour = palette[ch.charCodeAt(0) % palette.length];
  return { ch, colour };
}

// ── Add / Edit modal ─────────────────────────────────────────

function ItemModal({ existing, mode, parentId, onSave, onClose }) {
  // mode: "link" | "folder"
  const isFolder = (existing?.type || mode) === 'folder';
  const [title, setTitle] = useState(existing?.title || '');
  const [url, setUrl] = useState(existing?.url || '');
  const [imageUrl, setImageUrl] = useState(existing?.image_url || '');
  const [imagePreview, setImagePreview] = useState(existing?.image_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setError('Please choose an image file');
      return;
    }
    setError('');
    // local preview
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
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Upload failed');
      }
      const data = await res.json();
      setImageUrl(data.image_url);
    } catch (e) {
      setError('Upload failed: ' + e.message);
      setImagePreview(imageUrl); // revert preview
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!isFolder && !url.trim()) {
      setError('URL is required for links');
      return;
    }

    setSaving(true);
    try {
      const userId = getUserId();
      const payload = {
        title: title.trim(),
      };
      if (!isFolder) {
        const finalUrl = ensureUrl(url);
        payload.url = finalUrl;
        // Only save custom uploaded images; favicon is computed live on the tile
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
      if (!res.ok) throw new Error(await res.text());
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
          <div>
            <label className="text-xs font-semibold text-white/50 mb-1 block">Title *</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={isFolder ? 'e.g. Work tools' : 'e.g. Gmail'}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500"
            />
          </div>

          {!isFolder && (
            <>
              <div>
                <label className="text-xs font-semibold text-white/50 mb-1 block">URL *</label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/50 mb-1 block">Tile image (optional)</label>
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
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={e => handleFile(e.target.files?.[0])}
                    />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => { setImageUrl(''); setImagePreview(''); }}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{error}</div>
          )}
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-sm font-medium text-white/60 hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Large Link Tile (Chrome new-tab style) ───────────────────

function LinkTile({ item, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const [faviconErr, setFaviconErr] = useState(false);
  const url = ensureUrl(item.url);
  const { ch, colour } = letterAvatar(item.title);
  const faviconUrl = url ? getFavicon(url) : '';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative group"
      style={{ width: '160px' }}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-[#161616] border border-white/8 hover:border-blue-500/50 hover:bg-white/5 transition-all cursor-pointer"
        style={{ minHeight: '170px' }}
      >
        {/* Icon */}
        <div className="w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden bg-black flex-shrink-0">
          {item.image_url ? (
            <img src={item.image_url} alt="" className="w-full h-full object-contain p-2" />
          ) : faviconUrl && !faviconErr ? (
            <img
              src={faviconUrl}
              alt=""
              className="w-14 h-14 object-contain"
              onError={() => setFaviconErr(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: colour }}>
              <span className="text-white font-bold text-3xl">{ch}</span>
            </div>
          )}
        </div>
        {/* Title */}
        <div className="text-sm font-semibold text-white/85 text-center leading-tight w-full line-clamp-2" title={item.title}>
          {item.title}
        </div>
      </a>

      {hover && (
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(item); }}
            title="Edit"
            className="p-1.5 rounded-lg bg-black/90 border border-white/10 text-white/50 hover:text-blue-400 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item); }}
            title="Delete"
            className="p-1.5 rounded-lg bg-black/90 border border-white/10 text-white/50 hover:text-red-400 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-folder tile (shown inside a folder tab's contents) ────

function SubFolderTile({ item, childPreview, onOpen, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(item)}
      className="relative group cursor-pointer"
      style={{ width: '160px' }}
    >
      <div
        className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-[#161616] border border-white/8 hover:border-amber-500/50 hover:bg-white/5 transition-all"
        style={{ minHeight: '170px' }}
      >
        <div className="w-24 h-24 rounded-2xl bg-amber-900/20 grid grid-cols-2 grid-rows-2 gap-1 p-2 flex-shrink-0">
          {Array.from({ length: 4 }).map((_, i) => {
            const child = childPreview[i];
            if (!child) return <div key={i} className="rounded bg-white/5" />;
            return (
              <div key={i} className="rounded overflow-hidden bg-black flex items-center justify-center">
                {child.type === 'folder' ? (
                  <span className="text-sm">📁</span>
                ) : child.image_url ? (
                  <img src={child.image_url} alt="" className="w-full h-full object-cover" />
                ) : child.url ? (
                  <img src={getFavicon(child.url)} alt="" className="w-5 h-5" />
                ) : (
                  <span className="text-xs font-bold text-white/60">{(child.title || '?').charAt(0).toUpperCase()}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-sm font-semibold text-white/85 text-center leading-tight w-full line-clamp-2" title={item.title}>
          {item.title}
        </div>
        <div className="text-xs text-amber-400/50">Folder</div>
      </div>

      {hover && (
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            title="Rename"
            className="p-1.5 rounded-lg bg-black/90 border border-white/10 text-white/50 hover:text-blue-400 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
            title="Delete folder"
            className="p-1.5 rounded-lg bg-black/90 border border-white/10 text-white/50 hover:text-red-400 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════

export default function SpeedDialPage() {
  const userId = getUserId();

  // rootItems = every item at root level (parent_id = null)
  const [rootItems, setRootItems] = useState([]);
  // folderItems = items inside the currently-open folder tab
  const [folderItems, setFolderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // activeTab: null = Home; string = folder._id
  const [activeTab, setActiveTab] = useState(null);
  const [modal, setModal] = useState(null); // { mode, existing }

  // sub-folder previews (for SubFolderTile previews inside folder views)
  const [subFolderPreviews, setSubFolderPreviews] = useState({});

  // ── Derived ───────────────────────────────────────────────
  const rootFolders = rootItems.filter(it => it.type === 'folder');
  const homeLinks   = rootItems.filter(it => it.type === 'link');
  // Items displayed in the main grid
  const displayItems = activeTab ? folderItems : homeLinks;

  // ── Data loading ──────────────────────────────────────────

  const loadRoot = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/speed-dial/items?user_id=${userId}`);
      if (!res.ok) throw new Error(await res.text());
      setRootItems(await res.json() || []);
    } catch (e) {
      setError(e.message || 'Failed to load root items');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadFolder = useCallback(async (folderId) => {
    if (!userId || !folderId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/speed-dial/items?user_id=${userId}&parent_id=${folderId}`
      );
      if (!res.ok) throw new Error(await res.text());
      setFolderItems(await res.json() || []);
    } catch (e) {
      setError(e.message || 'Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadSubFolderPreview = useCallback(async (folderId) => {
    if (subFolderPreviews[folderId] !== undefined) return;
    try {
      const res = await fetch(
        `${API_BASE}/speed-dial/items?user_id=${userId}&parent_id=${folderId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setSubFolderPreviews(prev => ({ ...prev, [folderId]: data.slice(0, 4) }));
    } catch { /* ignore */ }
  }, [userId, subFolderPreviews]);

  // Initial load — always load root first
  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  // Load folder items when tab changes (switching tabs)
  useEffect(() => {
    if (activeTab) {
      loadFolder(activeTab);
    }
    // else: home view, loadRoot already handles loading state
  }, [activeTab, loadFolder]);

  // Prefetch sub-folder previews for any sub-folder visible in folder view
  useEffect(() => {
    folderItems.forEach(it => {
      if (it.type === 'folder') loadSubFolderPreview(it._id);
    });
  }, [folderItems, loadSubFolderPreview]);

  // ── Handlers ──────────────────────────────────────────────

  const refreshAll = () => {
    setSubFolderPreviews({});
    if (activeTab) {
      loadFolder(activeTab);
      loadRoot(); // keep tabs updated
    } else {
      loadRoot();
    }
  };

  const handleEdit = (item) => setModal({ mode: item.type, existing: item });

  const handleDelete = async (item) => {
    const msg = item.type === 'folder'
      ? `Delete folder "${item.title}" and all its contents?`
      : `Delete shortcut "${item.title}"?`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`${API_BASE}/speed-dial/items/${item._id}?user_id=${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      refreshAll();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const handleSaved = () => {
    setModal(null);
    refreshAll();
  };

  // When a folder-tab is deleted it may be the active one — go back to Home
  const handleDeleteFolder = async (item) => {
    await handleDelete(item);
    if (activeTab === item._id) setActiveTab(null);
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a]">

      {/* ── Tab Navbar ───────────────────────────────────── */}
      <nav className="bg-[#111] border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center">

          {/* Scrollable tabs */}
          <div className="flex items-stretch flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {/* Home tab */}
            <button
              onClick={() => setActiveTab(null)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === null
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </button>

            {/* Divider */}
            {rootFolders.length > 0 && (
              <div className="w-px bg-white/8 my-2 mx-1 shrink-0" />
            )}

            {/* Folder tabs */}
            {rootFolders.map(folder => (
              <button
                key={folder._id}
                onClick={() => setActiveTab(folder._id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap shrink-0 group ${
                  activeTab === folder._id
                    ? 'border-amber-400 text-white'
                    : 'border-transparent text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <span className="text-base leading-none">📁</span>
                <span className="max-w-[120px] truncate">{folder.title}</span>
              </button>
            ))}
          </div>

          {/* Action buttons — folder only in navbar */}
          <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-l border-white/8 ml-1">
            <button
              onClick={() => setModal({ mode: 'folder', existing: null })}
              title="Create a new folder tab"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs font-medium text-white/60 hover:bg-white/8 hover:text-white/90 transition"
            >
              <span className="text-sm leading-none">📁</span>
              <span>New Folder</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Tile Grid — vertically & horizontally centered ── */}
      <main className="flex flex-col items-center justify-center px-6" style={{ minHeight: 'calc(100vh - 52px)' }}>

        {error && (
          <div className="mb-6 w-full max-w-4xl text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-white/25 text-sm">Loading…</div>
        ) : (
          <div className="flex flex-wrap justify-center gap-5" style={{ maxWidth: '980px' }}>
            {/* Add Link tile — always first */}
            <button
              onClick={() => setModal({ mode: 'link', existing: null })}
              title="Add a shortcut"
              style={{ width: '160px', minHeight: '170px' }}
              className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 border-dashed border-white/12 hover:border-blue-500/60 hover:bg-blue-500/5 transition-all group"
            >
              <div className="w-24 h-24 rounded-2xl bg-white/4 flex items-center justify-center text-white/20 group-hover:text-blue-400/70 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="text-sm font-semibold text-white/30 group-hover:text-blue-400/80 transition-all">Add Shortcut</div>
            </button>

            {/* Link tiles */}
            {displayItems.map(it =>
              it.type === 'folder' ? (
                <SubFolderTile
                  key={it._id}
                  item={it}
                  childPreview={subFolderPreviews[it._id] || []}
                  onOpen={(folder) => setActiveTab(folder._id)}
                  onEdit={handleEdit}
                  onDelete={handleDeleteFolder}
                />
              ) : (
                <LinkTile
                  key={it._id}
                  item={it}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )
            )}


          </div>
        )}
      </main>

      {/* ── Modal ─────────────────────────────────────────── */}
      {modal && (
        <ItemModal
          existing={modal.existing}
          mode={modal.mode}
          // Folders are always created at root (parent_id = null);
          // links go into the current tab's folder (or root on Home).
          parentId={modal.mode === 'folder' ? null : activeTab}
          onClose={() => setModal(null)}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}
