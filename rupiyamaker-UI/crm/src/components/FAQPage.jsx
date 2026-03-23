import React, { useState, useEffect, useCallback, useRef } from 'react';
import { isSuperAdmin } from '../utils/permissions';

const API_BASE = '/api';

function getUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('userData') || '{}');
    return u._id || u.id || '';
  } catch {
    return '';
  }
}

function getUserPermissions() {
  try {
    return JSON.parse(localStorage.getItem('userPermissions') || '{}');
  } catch {
    return {};
  }
}

// ── tiny markdown-like renderer (bold, code) ─────────────────
function RenderAnswer({ text }) {
  if (!text) return null;
  // Split by newlines to preserve paragraphs
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {para}
        </p>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ADMIN MODALS
// ══════════════════════════════════════════════════════════════

function CategoryModal({ existing, onSave, onClose }) {
  const [name, setName] = useState(existing?.name || '');
  const [desc, setDesc] = useState(existing?.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const userId = getUserId();
      const url = existing
        ? `${API_BASE}/faq/categories/${existing._id}?user_id=${userId}`
        : `${API_BASE}/faq/categories?user_id=${userId}`;
      const method = existing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSave();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {existing ? 'Edit Category' : 'New Category'}
        </h3>
        <div className="space-y-3">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Category name *"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FAQItemModal({ existing, categories, onSave, onClose }) {
  const [catId, setCatId] = useState(existing?.category_id || categories[0]?._id || '');
  const [question, setQuestion] = useState(existing?.question || '');
  const [answer, setAnswer] = useState(existing?.answer || '');
  const [tags, setTags] = useState((existing?.tags || []).join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!question.trim() || !answer.trim() || !catId) return;
    setSaving(true);
    try {
      const userId = getUserId();
      const url = existing
        ? `${API_BASE}/faq/items/${existing._id}?user_id=${userId}`
        : `${API_BASE}/faq/items?user_id=${userId}`;
      const method = existing ? 'PUT' : 'POST';
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: catId,
          question: question.trim(),
          answer: answer.trim(),
          tags: tagList,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSave();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {existing ? 'Edit FAQ' : 'New FAQ'}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Category *</label>
            <select
              value={catId}
              onChange={e => setCatId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {categories.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Question *</label>
            <input
              autoFocus
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Enter the question…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Answer *</label>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Enter the detailed answer…"
              rows={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Tags (comma separated)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. policy, onboarding, hr"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !question.trim() || !answer.trim() || !catId}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function FAQPage({ user }) {
  const userId = getUserId();
  const perms = getUserPermissions();
  const isAdmin = isSuperAdmin(perms);

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState(null);   // null = All
  const [search, setSearch] = useState('');
  const [openItems, setOpenItems] = useState({});

  // Admin modal states
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const searchTimer = useRef(null);

  // ── Data fetching ─────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/faq/categories?user_id=${userId}&active_only=${!isAdmin}`
      );
      if (!res.ok) return;
      setCategories(await res.json());
    } catch (e) {
      console.error('FAQ categories fetch error:', e);
    }
  }, [userId, isAdmin]);

  const fetchItems = useCallback(async (catId = null, q = '') => {
    try {
      let url = `${API_BASE}/faq/items?user_id=${userId}&active_only=${!isAdmin}`;
      if (catId) url += `&category_id=${catId}`;
      if (q) url += `&search=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      setItems(await res.json());
    } catch (e) {
      console.error('FAQ items fetch error:', e);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchCategories(), fetchItems()]);
      setLoading(false);
    })();
  }, [fetchCategories, fetchItems]);

  // Search debounce
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchItems(activeCat, search);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [search, activeCat, fetchItems]);

  const handleCatSelect = (catId) => {
    setActiveCat(catId);
    fetchItems(catId, search);
    setOpenItems({});
  };

  const toggleItem = (id) => setOpenItems(p => ({ ...p, [id]: !p[id] }));

  // ── Admin actions ─────────────────────────────────────────

  const deleteCategory = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}" and all its FAQs?`)) return;
    await fetch(`${API_BASE}/faq/categories/${cat._id}?user_id=${userId}`, { method: 'DELETE' });
    if (activeCat === cat._id) setActiveCat(null);
    await Promise.all([fetchCategories(), fetchItems(null, search)]);
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete FAQ: "${item.question}"?`)) return;
    await fetch(`${API_BASE}/faq/items/${item._id}?user_id=${userId}`, { method: 'DELETE' });
    fetchItems(activeCat, search);
  };

  const toggleItemActive = async (item) => {
    await fetch(`${API_BASE}/faq/items/${item._id}?user_id=${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    fetchItems(activeCat, search);
  };

  // ── Derived data ──────────────────────────────────────────

  const filteredItems = items;
  const activeCatName = activeCat
    ? categories.find(c => c._id === activeCat)?.name
    : 'All FAQs';

  // Group items by category for "All" view
  const grouped = activeCat
    ? null
    : categories.reduce((acc, cat) => {
        const catItems = filteredItems.filter(i => i.category_id === cat._id);
        if (catItems.length > 0) acc.push({ cat, catItems });
        return acc;
      }, []);

  // Items not matching any category (fallback)
  const uncategorised = activeCat
    ? []
    : filteredItems.filter(i => !categories.find(c => c._id === i.category_id));

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
          <span className="text-sm font-medium">Loading FAQs…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 min-h-screen">
      {/* ── Left sidebar: categories ── */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900 text-base tracking-tight flex items-center gap-2">
            <span className="text-blue-600">❓</span> FAQ
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Frequently Asked Questions</p>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search FAQs…"
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-gray-50"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
        </div>

        {/* Category list */}
        <nav className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => handleCatSelect(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold mb-1 transition-colors ${
              activeCat === null
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            All FAQs ({items.length})
          </button>
          {categories.map(cat => (
            <div key={cat._id} className="group relative mb-0.5">
              <button
                onClick={() => handleCatSelect(cat._id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors pr-14 ${
                  activeCat === cat._id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                } ${!cat.is_active ? 'opacity-50' : ''}`}
              >
                {cat.name}
                <span className={`ml-1 text-[10px] ${activeCat === cat._id ? 'text-blue-200' : 'text-gray-400'}`}>
                  ({items.filter(i => i.category_id === cat._id).length})
                </span>
              </button>
              {isAdmin && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); setEditingCat(cat); setShowCatModal(true); }}
                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                    title="Edit"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.5-6.5a2 2 0 0 1 2.828 2.828L11 16l-4 1 1-4z" />
                    </svg>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteCategory(cat); }}
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                    title="Delete"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add category button (admin only) */}
          {isAdmin && (
            <button
              onClick={() => { setEditingCat(null); setShowCatModal(true); }}
              className="w-full mt-2 px-3 py-2 rounded-lg border-2 border-dashed border-gray-200 text-xs font-semibold text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Category
            </button>
          )}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-gray-900">{activeCatName}</h1>
            <p className="text-xs text-gray-400">{filteredItems.length} question{filteredItems.length !== 1 ? 's' : ''}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setEditingItem(null); setShowItemModal(true); }}
              disabled={categories.length === 0}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add FAQ
            </button>
          )}
        </div>

        <div className="p-6 max-w-4xl mx-auto">
          {filteredItems.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
              <p className="text-sm font-medium">
                {search ? 'No results found for your search.' : 'No FAQs yet.'}
              </p>
              {isAdmin && !search && (
                <button
                  onClick={() => { setEditingItem(null); setShowItemModal(true); }}
                  className="mt-3 text-blue-600 text-xs font-semibold hover:underline"
                >
                  Add the first FAQ
                </button>
              )}
            </div>
          )}

          {/* ── All categories grouped view ── */}
          {!activeCat && grouped && grouped.map(({ cat, catItems }) => (
            <section key={cat._id} className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-black text-sm text-gray-900 uppercase tracking-wide">{cat.name}</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{catItems.length}</span>
                {!cat.is_active && (
                  <span className="text-[10px] bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full">HIDDEN</span>
                )}
              </div>
              <FAQList
                items={catItems}
                openItems={openItems}
                onToggle={toggleItem}
                isAdmin={isAdmin}
                onEdit={item => { setEditingItem(item); setShowItemModal(true); }}
                onDelete={deleteItem}
                onToggleActive={toggleItemActive}
              />
            </section>
          ))}

          {/* uncategorised (edge case) */}
          {!activeCat && uncategorised.length > 0 && (
            <section className="mb-8">
              <h2 className="font-black text-sm text-gray-900 uppercase tracking-wide mb-3">Other</h2>
              <FAQList
                items={uncategorised}
                openItems={openItems}
                onToggle={toggleItem}
                isAdmin={isAdmin}
                onEdit={item => { setEditingItem(item); setShowItemModal(true); }}
                onDelete={deleteItem}
                onToggleActive={toggleItemActive}
              />
            </section>
          )}

          {/* ── Category filtered view ── */}
          {activeCat && filteredItems.length > 0 && (
            <FAQList
              items={filteredItems}
              openItems={openItems}
              onToggle={toggleItem}
              isAdmin={isAdmin}
              onEdit={item => { setEditingItem(item); setShowItemModal(true); }}
              onDelete={deleteItem}
              onToggleActive={toggleItemActive}
            />
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      {showCatModal && (
        <CategoryModal
          existing={editingCat}
          onSave={async () => {
            setShowCatModal(false);
            setEditingCat(null);
            await fetchCategories();
            fetchItems(activeCat, search);
          }}
          onClose={() => { setShowCatModal(false); setEditingCat(null); }}
        />
      )}

      {showItemModal && (
        <FAQItemModal
          existing={editingItem}
          categories={categories.filter(c => c.is_active)}
          onSave={() => {
            setShowItemModal(false);
            setEditingItem(null);
            fetchItems(activeCat, search);
          }}
          onClose={() => { setShowItemModal(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

// ── Accordion list component ──────────────────────────────────

function FAQList({ items, openItems, onToggle, isAdmin, onEdit, onDelete, onToggleActive }) {
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div
          key={item._id}
          className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${
            !item.is_active ? 'opacity-60 border-yellow-200' : 'border-gray-200'
          }`}
        >
          <button
            onClick={() => onToggle(item._id)}
            className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="mt-0.5 text-blue-500 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 leading-snug">{item.question}</p>
                {item.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.tags.map(tag => (
                      <span key={tag} className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-1.5 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!item.is_active && (
                <span className="text-[10px] bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full hidden sm:block">HIDDEN</span>
              )}
              {isAdmin && (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onToggleActive(item)}
                    className={`p-1.5 rounded-lg text-xs ${item.is_active ? 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50' : 'text-yellow-600 hover:bg-yellow-50'}`}
                    title={item.is_active ? 'Hide' : 'Show'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {item.is_active
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.79m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                      }
                    </svg>
                  </button>
                  <button
                    onClick={() => onEdit(item)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.5-6.5a2 2 0 012.828 2.828L11 16l-4 1 1-4z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(item)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
              <svg
                className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${openItems[item._id] ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {openItems[item._id] && (
            <div className="px-5 pb-5 pt-1 border-t border-gray-100 bg-gray-50/60">
              <RenderAnswer text={item.answer} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
