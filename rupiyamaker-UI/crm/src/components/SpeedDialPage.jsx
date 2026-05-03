/**
 * SpeedDialPage.jsx — Browser-style "Speed Dial" / bookmark home page.
 *
 * Features
 * ────────
 *  • Tile grid of links and folders (drag-free for now; uses order-by-creation).
 *  • Click a link tile → opens the URL in a new tab.
 *  • Click a folder tile → drills into the folder (breadcrumb navigation).
 *  • "Add" tile (last) → modal to create either a link or a folder.
 *      For links: title (required), URL (required), optional image upload.
 *      For folders: title only.
 *  • Each tile has hover actions: Edit, Delete.
 *  • All edits/deletes call the backend (/speed-dial/*) which is
 *    super-admin-gated. The whole route is also super-admin-gated up front.
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

// ── "Choose type" modal (link vs folder) ─────────────────────

function AddChooserModal({ onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Add to Speed Dial</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onPick('link')}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-white/10 hover:border-blue-500 hover:bg-blue-500/10 transition"
          >
            <span className="text-3xl">🔗</span>
            <span className="text-sm font-semibold text-white">Shortcut</span>
            <span className="text-[10px] text-white/40">Link to a website</span>
          </button>
          <button
            onClick={() => onPick('folder')}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-white/10 hover:border-amber-500 hover:bg-amber-500/10 transition"
          >
            <span className="text-3xl">📁</span>
            <span className="text-sm font-semibold text-white">Folder</span>
            <span className="text-[10px] text-white/40">Group shortcuts</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tile components ──────────────────────────────────────────

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
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#111] border border-white/10 hover:border-blue-500/60 hover:bg-white/5 transition cursor-pointer"
      >
        <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden bg-black">
          {item.image_url ? (
            <img src={item.image_url} alt="" className="w-full h-full object-contain p-1" />
          ) : faviconUrl && !faviconErr ? (
            <img
              src={faviconUrl}
              alt=""
              className="w-10 h-10 object-contain"
              onError={() => setFaviconErr(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: colour }}>
              <span className="text-white font-bold text-2xl">{ch}</span>
            </div>
          )}
        </div>
        <div className="text-xs font-medium text-white/80 text-center truncate w-full" title={item.title}>
          {item.title}
        </div>
        <div className="text-[10px] text-white/30 truncate w-full text-center" title={url}>
          {getDomain(url)}
        </div>
      </a>

      {hover && (
        <div className="absolute top-1 right-1 flex gap-1">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(item); }}
            title="Edit"
            className="p-1 rounded bg-black/90 border border-white/10 text-white/50 hover:text-blue-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item); }}
            title="Delete"
            className="p-1 rounded bg-black/90 border border-white/10 text-white/50 hover:text-red-400"
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

function FolderTile({ item, childPreview, onOpen, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(item)}
      className="relative group cursor-pointer"
    >
      <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#111] border border-white/10 hover:border-amber-500/60 hover:bg-white/5 transition">
        <div className="w-16 h-16 rounded-xl bg-amber-900/20 grid grid-cols-2 grid-rows-2 gap-0.5 p-1.5">
          {Array.from({ length: 4 }).map((_, i) => {
            const child = childPreview[i];
            if (!child) {
              return <div key={i} className="rounded bg-white/5" />;
            }
            return (
              <div key={i} className="rounded overflow-hidden bg-black flex items-center justify-center">
                {child.type === 'folder' ? (
                  <span className="text-xs">📁</span>
                ) : child.image_url ? (
                  <img src={child.image_url} alt="" className="w-full h-full object-cover" />
                ) : child.url ? (
                  <img src={getFavicon(child.url)} alt="" className="w-4 h-4" />
                ) : (
                  <span className="text-[10px] font-bold text-white/60">{(child.title || '?').charAt(0).toUpperCase()}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-xs font-medium text-white/80 text-center truncate w-full" title={item.title}>
          {item.title}
        </div>
        <div className="text-[10px] text-white/30">Folder</div>
      </div>

      {hover && (
        <div className="absolute top-1 right-1 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            title="Rename"
            className="p-1 rounded bg-black/90 border border-white/10 text-white/50 hover:text-blue-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
            title="Delete folder"
            className="p-1 rounded bg-black/90 border border-white/10 text-white/50 hover:text-red-400"
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

function AddTile({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-transparent border-2 border-dashed border-white/10 hover:border-blue-500/60 hover:bg-white/5 transition"
    >
      <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-white/30 text-4xl font-light">
        +
      </div>
      <div className="text-xs font-semibold text-white/40">Add</div>
      <div className="text-[10px] text-white/20">Shortcut / Folder</div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════

export default function SpeedDialPage() {
  const userId = getUserId();

  const [allItems, setAllItems] = useState([]); // every item for this user
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([]); // [{id, title}]
  const [chooserOpen, setChooserOpen] = useState(false);
  const [modal, setModal] = useState(null); // { mode, existing }

  const currentParentId = breadcrumbs.length
    ? breadcrumbs[breadcrumbs.length - 1].id
    : null;

  // Load — we fetch everything for this user once and slice client-side so
  // folder previews work without extra round-trips.
  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      // The list endpoint filters by parent_id, so to grab everything we
      // walk parent_id=null first; folder previews will fetch their own.
      // For simplicity we just call the list endpoint twice on demand.
      const res = await fetch(
        `${API_BASE}/speed-dial/items?user_id=${userId}` +
        (currentParentId ? `&parent_id=${currentParentId}` : '')
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAllItems(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId, currentParentId]);

  // For folder previews we lazily fetch first 4 children of each folder.
  const [folderPreviews, setFolderPreviews] = useState({}); // { folderId: [child,...] }

  const fetchFolderPreview = useCallback(async (folderId) => {
    if (folderPreviews[folderId]) return;
    try {
      const res = await fetch(`${API_BASE}/speed-dial/items?user_id=${userId}&parent_id=${folderId}`);
      if (!res.ok) return;
      const data = await res.json();
      setFolderPreviews(prev => ({ ...prev, [folderId]: data.slice(0, 4) }));
    } catch { /* ignore */ }
  }, [userId, folderPreviews]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // After items load, prefetch previews for any folder visible.
  useEffect(() => {
    allItems.forEach(it => {
      if (it.type === 'folder') fetchFolderPreview(it._id);
    });
  }, [allItems, fetchFolderPreview]);

  // ── handlers ──────────────────────────────────────────────

  const openFolder = (folder) => {
    setBreadcrumbs(prev => [...prev, { id: folder._id, title: folder.title }]);
    setFolderPreviews({}); // invalidate previews after navigation
  };

  const goToCrumb = (idx) => {
    setBreadcrumbs(prev => prev.slice(0, idx + 1));
    setFolderPreviews({});
  };

  const goHome = () => {
    setBreadcrumbs([]);
    setFolderPreviews({});
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
      loadAll();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const handleSaved = () => {
    setModal(null);
    setChooserOpen(false);
    loadAll();
    setFolderPreviews({}); // refresh previews next render
  };

  // ── access guard ──────────────────────────────────────────

  // No access restriction — Speed Dial is available to all authenticated users

  // ── render ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black border-b border-white/10 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 grid place-items-center text-white text-xl">
              ⚡
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Speed Dial</h1>
              <div className="text-xs text-white/30 flex items-center gap-1 flex-wrap">
                <button onClick={goHome} className="hover:text-white/70 transition">Home</button>
                {breadcrumbs.map((b, i) => (
                  <React.Fragment key={b.id}>
                    <span>/</span>
                    <button
                      onClick={() => goToCrumb(i)}
                      className="hover:text-white/70 transition truncate max-w-[140px]"
                      title={b.title}
                    >
                      {b.title}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setChooserOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 flex items-center gap-2 transition"
          >
            <span className="text-lg leading-none">+</span> Add
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-6xl mx-auto p-6">
        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-white/30 text-sm">Loading…</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            <AddTile onClick={() => setChooserOpen(true)} />
            {allItems.map(it => (
              it.type === 'folder' ? (
                <FolderTile
                  key={it._id}
                  item={it}
                  childPreview={folderPreviews[it._id] || []}
                  onOpen={openFolder}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ) : (
                <LinkTile
                  key={it._id}
                  item={it}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )
            ))}
          </div>
        )}

        {!loading && allItems.length === 0 && (
          <div className="text-center mt-8 text-white/30 text-sm">
            No shortcuts yet. Click <span className="text-white/60 font-semibold">Add</span> to
            create your first one.
          </div>
        )}
      </main>

      {chooserOpen && (
        <AddChooserModal
          onClose={() => setChooserOpen(false)}
          onPick={(mode) => {
            setChooserOpen(false);
            setModal({ mode, existing: null });
          }}
        />
      )}

      {modal && (
        <ItemModal
          existing={modal.existing}
          mode={modal.mode}
          parentId={currentParentId}
          onClose={() => setModal(null)}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}
