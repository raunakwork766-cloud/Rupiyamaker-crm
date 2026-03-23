import React, { useRef, useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import './attachments.css';
import { getISTDateYMD } from '../../utils/dateUtils';

const BASE_URL = '/api';

const EMPLOYEE_DOC_CATEGORIES = [
  { id: 'kyc',        title: 'KYC & IDENTITY',       keywords: ['pan', 'aadhaar', 'aadhar', 'voter', 'driving licen', 'passport', 'kyc', 'id proof', 'identity', 'cibil'] },
  { id: 'employment', title: 'EMPLOYMENT DOCUMENTS',  keywords: ['offer letter', 'employment', 'appointment', 'experience letter', 'form 16', 'salary slip', 'increment', 'joining'] },
  { id: 'financial',  title: 'FINANCIAL DOCUMENTS',   keywords: ['bank statement', 'itr', 'income tax', 'financial', 'account statement'] },
  { id: 'education',  title: 'EDUCATION DOCUMENTS',   keywords: ['degree', 'certificate', 'marksheet', 'diploma', 'education', 'qualification'] },
];

export default function EmployeeAttachmentsNew({ employee }) {
  const getUserId = () => localStorage.getItem('user_id') || localStorage.getItem('userId') || '66b5b5e8e2b49b00122f1db5';
  const currentUserId = getUserId();

  // Core state
  const [notification, setNotification]     = useState(null);
  const [attachmentTypes, setAttachmentTypes] = useState([]);
  const [historicalAttachmentTypes, setHistoricalAttachmentTypes] = useState([]);
  const [loadingTypes, setLoadingTypes]       = useState(true);
  const [dynamicFiles, setDynamicFiles]       = useState({});
  const [dynamicRefs, setDynamicRefs]         = useState({});
  const [dynamicPasswords, setDynamicPasswords] = useState({});
  const [isLoading, setIsLoading]             = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [showTooltip, setShowTooltip]         = useState({});

  // Rename state
  const [editingFileId, setEditingFileId]     = useState(null);
  const [editingFileName, setEditingFileName] = useState('');

  // Drag-to-reorder
  const dragFile = useRef(null);
  const [dragOverKey, setDragOverKey]         = useState(null);

  // Inline viewer
  const [viewerDoc, setViewerDoc]             = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // ── helpers ────────────────────────────────────────────────
  const getDocName = (doc) => doc.original_file_name || doc.filename || doc.file_name || 'Document';

  const getFileIconClass = (name) => {
    const n = (name || '').toLowerCase();
    if (n.endsWith('.pdf'))                       return 'fa-file-pdf text-blue-500';
    if (n.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'fa-file-image text-green-500';
    if (n.match(/\.(doc|docx)$/))                  return 'fa-file-word text-blue-600';
    if (n.match(/\.(xls|xlsx|csv)$/))              return 'fa-file-excel text-emerald-600';
    return 'fa-file text-gray-400';
  };

  const matchDoc = (doc, type) => {
    const tid = type.id || type._id;
    return (
      (doc.attachment_type && String(doc.attachment_type) === String(tid)) ||
      (doc.attachment_type_name === type.name) ||
      (doc.document_type === type.name) ||
      (doc.category === type.name)
    );
  };

  // ── data loading ───────────────────────────────────────────
  const loadAttachmentTypes = async () => {
    try {
      setLoadingTypes(true);
      const [activeRes, allRes] = await Promise.all([
        fetch(`${BASE_URL}/settings/attachment-types?user_id=${currentUserId}&target_type=employees`),
        fetch(`${BASE_URL}/settings/all-attachment-types?user_id=${currentUserId}&target_type=employees`),
      ]);
      if (activeRes.ok && allRes.ok) {
        const activeTypes = await activeRes.json();
        const allTypes    = await allRes.json();
        setAttachmentTypes(activeTypes);
        setHistoricalAttachmentTypes(allTypes);
        const initFiles = {}, initRefs = {}, initPws = {};
        [...activeTypes, ...allTypes].forEach(t => {
          const k = t.name.toLowerCase().replace(/\s+/g, '_');
          initFiles[k] = []; initRefs[k] = React.createRef(); initPws[k] = '';
        });
        setDynamicFiles(initFiles); setDynamicRefs(initRefs); setDynamicPasswords(initPws);
      }
    } catch (e) {
      showNotification('Error loading attachment types', 'error');
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadUploadedDocuments = async () => {
    if (!employee?._id) return;
    try {
      const res = await fetch(`${BASE_URL}/hrms/employees/${employee._id}/attachments?user_id=${currentUserId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setUploadedDocuments(await res.json());
    } catch (e) { console.error('Error loading documents:', e); }
  };

  useEffect(() => { loadAttachmentTypes(); }, []);
  useEffect(() => { if (employee?._id) loadUploadedDocuments(); }, [employee]);

  // ── upload ─────────────────────────────────────────────────
  const handleFileChange = (key) => async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const type = [...attachmentTypes, ...historicalAttachmentTypes].find(t => t.name.toLowerCase().replace(/\s+/g, '_') === key);
    if (!type) { showNotification('Attachment type not found', 'error'); return; }

    // Block duplicates
    const existingNames = uploadedDocuments.filter(d => matchDoc(d, type)).map(d => getDocName(d).toLowerCase().trim());
    const dupes = files.filter(f => existingNames.includes(f.name.toLowerCase().trim()));
    if (dupes.length) { showNotification(`Duplicate file(s): ${dupes.map(f => f.name).join(', ')}`, 'error'); e.target.value = ''; return; }

    setDynamicFiles(prev => ({ ...prev, [key]: files }));
    showNotification(`Uploading ${files.length} file(s)...`, 'info');
    await handleUpload(type, files);
    e.target.value = '';
  };

  const handleUpload = async (type, files) => {
    if (!employee?._id || !files?.length) return;
    setIsLoading(true);
    const typeId = type.id || type._id;
    const key = type.name.toLowerCase().replace(/\s+/g, '_');
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('attachment_type', typeId);
        formData.append('description', '');
        const pw = dynamicPasswords[key] || '';
        formData.append('is_password_protected', pw ? 'true' : 'false');
        if (pw) formData.append('password', pw);
        const res = await fetch(`${BASE_URL}/hrms/employees/${employee._id}/attachments?user_id=${currentUserId}`, {
          method: 'POST', body: formData, headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error(`Upload failed: ${(await res.json()).detail || res.statusText}`);
      }
      showNotification(`${files.length} file(s) uploaded successfully!`, 'success');
      setDynamicFiles(prev => ({ ...prev, [key]: [] }));
      await loadUploadedDocuments();
    } catch (e) {
      showNotification('Upload error: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── download ───────────────────────────────────────────────
  const handleDownload = (docId) => {
    window.open(`${BASE_URL}/hrms/employees/${employee._id}/attachments/${docId}/download?user_id=${currentUserId}`, '_blank');
  };

  // ── delete ─────────────────────────────────────────────────
  const handleDelete = async (docId) => {
    const doc = uploadedDocuments.find(d => d._id === docId);
    if (!doc) return;
    if (!window.confirm(`Delete "${getDocName(doc)}"? This cannot be undone.`)) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/hrms/employees/${employee._id}/attachments/${docId}?user_id=${currentUserId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) { showNotification('Document deleted successfully!', 'success'); loadUploadedDocuments(); }
      else { const e = await res.json(); showNotification(`Delete failed: ${e.detail || 'Unknown error'}`, 'error'); }
    } catch (e) { showNotification('Delete failed: ' + e.message, 'error'); }
    finally { setIsLoading(false); }
  };

  // ── rename ─────────────────────────────────────────────────
  const handleRenameFile = async (docId, newBase, ext) => {
    const trimmed = newBase.trim();
    if (!trimmed) { setEditingFileId(null); setEditingFileName(''); return; }
    const newName = trimmed + ext;
    try {
      const res = await fetch(
        `${BASE_URL}/hrms/employees/${employee._id}/attachments/${docId}?user_id=${currentUserId}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ original_file_name: newName }) }
      );
      if (!res.ok) throw new Error('Server returned ' + res.status);
      setUploadedDocuments(prev => prev.map(d => d._id === docId ? { ...d, original_file_name: newName, filename: newName, file_name: newName } : d));
      showNotification('File renamed successfully', 'success');
    } catch (err) { showNotification('Rename failed: ' + err.message, 'error'); }
    finally { setEditingFileId(null); setEditingFileName(''); }
  };

  // ── viewer ─────────────────────────────────────────────────
  const handleViewFile = async (doc) => {
    const name = getDocName(doc);
    const fname = name.toLowerCase();
    const ext = fname.split('.').pop();
    const isPdf = ext === 'pdf';
    const isImage = ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext);
    const downloadUrl = `${BASE_URL}/hrms/employees/${employee._id}/attachments/${doc._id}/download?user_id=${currentUserId}`;
    setViewerDoc({ blobUrl: null, downloadUrl, name, isPdf, isImage, loading: true, error: null });
    try {
      const res = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const mime = isPdf ? 'application/pdf' : isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/octet-stream';
      const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
      setViewerDoc({ blobUrl, downloadUrl, name, isPdf, isImage, loading: false, error: null });
    } catch (err) {
      setViewerDoc(prev => prev ? { ...prev, loading: false, error: err.message } : null);
    }
  };

  // ── download all ───────────────────────────────────────────
  const handleDownloadAll = async () => {
    if (!uploadedDocuments.length) { showNotification('No documents to download', 'warning'); return; }
    setIsDownloadingAll(true);
    showNotification('Preparing ZIP...', 'info');
    try {
      const zip = new JSZip();
      let count = 0;
      for (const doc of uploadedDocuments) {
        try {
          const res = await fetch(`${BASE_URL}/hrms/employees/${employee._id}/attachments/${doc._id}/download?user_id=${currentUserId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) { zip.file(getDocName(doc), await res.blob()); count++; }
        } catch (e) { console.error('Skip', doc._id, e); }
      }
      if (count > 0) {
        const blob = await zip.generateAsync({ type: 'blob' });
        const empName = employee?.first_name || employee?.name || employee?._id || 'Employee';
        saveAs(blob, `${empName}_Attachments_${getISTDateYMD()}.zip`);
        showNotification(`Downloaded ${count} file(s)`, 'success');
      } else { showNotification('No files could be downloaded', 'error'); }
    } catch (e) { showNotification('Error creating ZIP: ' + e.message, 'error'); }
    finally { setIsDownloadingAll(false); }
  };

  // ── drag-to-reorder ────────────────────────────────────────
  const handleFileDragStart = (e, docType, fromIdx) => {
    dragFile.current = { docType, fromIdx };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', fromIdx);
    setTimeout(() => { if (e.target) e.target.style.opacity = '0.45'; }, 0);
  };
  const handleFileDragOver = (e, docType, toIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
    const k = `${docType}_${toIdx}_${half}`;
    if (dragOverKey !== k) setDragOverKey(k);
  };
  const handleFileDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    setTimeout(() => { dragFile.current = null; }, 50);
    setDragOverKey(null);
  };
  const handleFileDrop = (e, docType, toIdx) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!dragFile.current) return;
    const { docType: fromDocType, fromIdx } = dragFile.current;
    dragFile.current = null;
    if (fromDocType !== docType) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isTopHalf = e.clientY < rect.top + rect.height / 2;
    setUploadedDocuments(prev => {
      const type = attachmentTypes.find(t => t.name === docType) || historicalAttachmentTypes.find(t => t.name === docType);
      if (!type) return prev;
      const typeDocs = prev.filter(d => matchDoc(d, type));
      const otherDocs = prev.filter(d => !matchDoc(d, type));
      const moved = [...typeDocs];
      const item = moved.splice(fromIdx, 1)[0];
      let insertAt = isTopHalf ? (fromIdx < toIdx ? toIdx - 1 : toIdx) : (fromIdx < toIdx ? toIdx : toIdx + 1);
      insertAt = Math.max(0, Math.min(moved.length, insertAt));
      moved.splice(insertAt, 0, item);
      return [...otherDocs, ...moved];
    });
  };

  React.useEffect(() => {
    const stop = e => e.preventDefault();
    window.addEventListener('dragover', stop, false);
    window.addEventListener('drop', stop, false);
    return () => { window.removeEventListener('dragover', stop, false); window.removeEventListener('drop', stop, false); };
  }, []);

  // ── guards ─────────────────────────────────────────────────
  if (loadingTypes) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-center py-10">
          <div className="flex items-center gap-3 text-gray-500">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm font-medium">Loading attachments...</span>
          </div>
        </div>
      </div>
    );
  }

  // Build display list
  const allDisplayTypes = [
    ...attachmentTypes.map(t => ({ ...t, isHistorical: false })),
    ...historicalAttachmentTypes
      .filter(t => !attachmentTypes.some(a => a.name === t.name))
      .filter(t => uploadedDocuments.some(d => matchDoc(d, t)))
      .map(t => ({ ...t, isHistorical: true }))
  ];

  // Group by category
  const grouped = EMPLOYEE_DOC_CATEGORIES.map(cat => ({
    ...cat,
    types: allDisplayTypes.filter(t => cat.keywords.some(kw => t.name.toLowerCase().includes(kw)))
  })).filter(cat => cat.types.length > 0);
  const matchedNames = new Set(grouped.flatMap(g => g.types.map(t => t.name)));
  const otherTypes = allDisplayTypes.filter(t => !matchedNames.has(t.name));
  if (otherTypes.length > 0) grouped.push({ id: 'other', title: 'OTHER DOCUMENTS', types: otherTypes });

  let globalFileIndex = 1;

  // ── render ─────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 w-full">

      {/* Notification */}
      {notification && (
        <div className={`mb-3 px-3 py-2 rounded flex items-center gap-2 text-xs font-medium ${
          notification.type === 'error'   ? 'bg-red-50 border border-red-200 text-red-700' :
          notification.type === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' :
                                            'bg-green-50 border border-green-200 text-green-700'
        }`}>
          <i className={`fa-solid ${notification.type === 'error' ? 'fa-circle-xmark' : notification.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}></i>
          <span className="flex-1">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-auto opacity-60 hover:opacity-100"><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      {/* Header */}
      <div className="mb-2 border-b border-gray-100 pb-2 flex items-center gap-2">
        <button
          onClick={handleDownloadAll}
          disabled={isDownloadingAll || uploadedDocuments.length === 0}
          className="bg-gray-900 border border-gray-900 text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-black transition flex items-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isDownloadingAll
            ? <><i className="fa-solid fa-spinner fa-spin mr-1 text-xs"></i> Zipping…</>
            : <><i className="fa-solid fa-download mr-1 text-xs"></i> DOWNLOAD ALL ({uploadedDocuments.length})</>
          }
        </button>
      </div>

      {/* Document rows */}
      <div className="space-y-3">
        {allDisplayTypes.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
            No attachment types configured. Go to Settings → Others → Attachment Types to add them.
          </div>
        )}

        {grouped.map((cat, catIdx) => (
          <div key={cat.id} className="mb-3 last:mb-0">
            <div className="border-b-2 border-gray-800 pb-1 mb-3">
              <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">{catIdx + 1}. {cat.title}</h3>
            </div>
            <div className="space-y-2.5">
              {cat.types.map((attachmentType) => {
                const key = attachmentType.name.toLowerCase().replace(/\s+/g, '_');
                const inputRef = dynamicRefs[key];
                const typeDocuments = uploadedDocuments.filter(d => matchDoc(d, attachmentType));
                const typeStartGlobal = globalFileIndex;
                globalFileIndex += typeDocuments.length;

                return (
                  <div key={attachmentType.id || attachmentType._id}
                    className="bg-white border border-gray-200 rounded-lg p-2 flex flex-col md:flex-row gap-2.5 items-start md:items-stretch shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-gray-300 hover:shadow-sm transition-colors group/docrow"
                  >
                    {/* LEFT: label */}
                    <div className="w-full md:w-1/4 lg:w-1/5 shrink-0 flex items-start gap-3">
                      <div className="w-8 h-8 rounded bg-[#eff6ff] text-[#2563eb] flex items-center justify-center text-sm shrink-0">
                        <i className="fa-solid fa-file-invoice"></i>
                      </div>
                      <div className="pt-0.5 flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-xs leading-tight pr-1 tracking-tight">
                          {attachmentType.name.toUpperCase()}
                        </h4>
                        {attachmentType.isHistorical && (
                          <span className="inline-block mt-1 px-1 py-0.5 bg-yellow-100 text-yellow-800 text-[8px] font-bold rounded">ARCHIVE</span>
                        )}
                        {attachmentType.description && (
                          <div className="relative mt-1">
                            <div className="w-4 h-4 bg-[#2563eb] rounded-full flex items-center justify-center cursor-help"
                              onMouseEnter={() => setShowTooltip(p => ({ ...p, [attachmentType.id || attachmentType._id]: true }))}
                              onMouseLeave={() => setShowTooltip(p => ({ ...p, [attachmentType.id || attachmentType._id]: false }))}
                            >
                              <span className="text-white text-[9px] font-bold leading-none">i</span>
                            </div>
                            {showTooltip[attachmentType.id || attachmentType._id] && (
                              <div className="absolute z-[9999] p-3 text-xs text-white bg-gray-800 rounded-lg shadow-2xl"
                                style={{ left: '50%', bottom: '100%', transform: 'translateX(-50%)', marginBottom: 8, minWidth: 220, maxWidth: 360, border: '1px solid rgba(255,255,255,0.15)' }}
                              >
                                {attachmentType.description.split(/\r?\n/).map((line, i, arr) => (
                                  <React.Fragment key={i}>{line}{i < arr.length - 1 && <br />}</React.Fragment>
                                ))}
                                <div className="absolute w-0 h-0" style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1f2937' }}></div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* MIDDLE: file list */}
                    <div className="flex-1 w-full bg-slate-50 border border-gray-100 rounded p-1.5 flex flex-col gap-1.5 min-h-[50px]">
                      {typeDocuments.length > 0 ? (
                        <div className="space-y-1 w-full">
                          {typeDocuments.map((doc, fileIdx) => {
                            const displayNum = typeStartGlobal + fileIdx;
                            const fname = getDocName(doc).toUpperCase();
                            const isLocked = doc.has_password || doc.is_password_protected;
                            const overKeyTop    = `${attachmentType.name}_${fileIdx}_top`;
                            const overKeyBottom = `${attachmentType.name}_${fileIdx}_bottom`;
                            const isDraggedOverTop    = dragOverKey === overKeyTop;
                            const isDraggedOverBottom = dragOverKey === overKeyBottom;

                            return (
                              <div key={doc._id}
                                draggable
                                onDragStart={e => handleFileDragStart(e, attachmentType.name, fileIdx)}
                                onDragOver={e => handleFileDragOver(e, attachmentType.name, fileIdx)}
                                onDragEnd={handleFileDragEnd}
                                onDrop={e => handleFileDrop(e, attachmentType.name, fileIdx)}
                                className={`cursor-grab active:cursor-grabbing bg-white border rounded p-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition group/filerow
                                  ${isLocked ? 'border-red-200' : 'border-gray-200'}
                                  ${isDraggedOverTop ? '!border-t-2 !border-t-[#2563eb]' : isDraggedOverBottom ? '!border-b-2 !border-b-[#2563eb]' : 'hover:border-blue-300'}`}
                              >
                                {/* file info */}
                                <div className="flex items-start gap-1.5 min-w-0 pr-2 flex-1 w-full">
                                  <div className="text-[9px] font-black w-4 h-4 bg-gray-100 text-gray-500 rounded flex items-center justify-center shrink-0 mt-0.5 group-hover/filerow:bg-blue-100 group-hover/filerow:text-[#2563eb] transition-colors select-none">
                                    {displayNum}
                                  </div>
                                  <i className="fa-solid fa-grip-vertical text-gray-300 mt-0.5 mr-0.5 text-[10px] shrink-0 cursor-grab select-none"></i>
                                  <i className={`fa-solid ${isLocked ? 'fa-file-shield text-red-500' : getFileIconClass(fname)} text-base shrink-0 mt-0.5 select-none`}></i>
                                  <div className="flex-1 w-full min-w-0">
                                    {editingFileId === doc._id ? (() => {
                                      const origName = getDocName(doc);
                                      const lastDot = origName.lastIndexOf('.');
                                      const ext = lastDot >= 0 ? origName.substring(lastDot) : '';
                                      return (
                                        <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                                          <input autoFocus value={editingFileName}
                                            onChange={e => setEditingFileName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRenameFile(doc._id, editingFileName, ext); } else if (e.key === 'Escape') { setEditingFileId(null); setEditingFileName(''); } }}
                                            onBlur={() => handleRenameFile(doc._id, editingFileName, ext)}
                                            className="text-[11px] font-bold text-gray-800 bg-blue-50 border border-blue-400 rounded px-1 py-0.5 outline-none flex-1 min-w-0"
                                          />
                                          {ext && <span className="text-[11px] text-gray-500 shrink-0">{ext.toUpperCase()}</span>}
                                        </div>
                                      );
                                    })() : (
                                      <span className="text-[12px] font-bold text-gray-800 break-all w-full line-clamp-2 leading-tight select-none" title={fname}>{fname}</span>
                                    )}
                                  </div>
                                </div>

                                {/* action buttons */}
                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto relative z-10">
                                  {isLocked && (
                                    <>
                                      <input type="password" id={`pw_${doc._id}`} placeholder="Password"
                                        className="text-[9px] border border-red-200 px-1 py-0.5 rounded w-20 outline-none focus:border-red-400 text-gray-700 bg-white"
                                        onClick={e => e.stopPropagation()}
                                      />
                                      <button
                                        onClick={() => {
                                          const pw = document.getElementById(`pw_${doc._id}`)?.value;
                                          if (pw) { navigator.clipboard.writeText(pw); showNotification('Password copied!', 'success'); }
                                          else { showNotification('Enter the password first', 'warning'); }
                                        }}
                                        className="bg-gray-800 hover:bg-black text-white text-[9px] font-bold px-2.5 py-1 rounded whitespace-nowrap"
                                      >DECRYPT</button>
                                    </>
                                  )}
                                  {/* Rename */}
                                  <button
                                    onClick={e => { e.stopPropagation(); const n = getDocName(doc); const ld = n.lastIndexOf('.'); setEditingFileId(doc._id); setEditingFileName(ld >= 0 ? n.substring(0, ld) : n); }}
                                    className="bg-gray-50 border border-gray-200 rounded p-1 text-gray-500 hover:text-orange-500 hover:bg-orange-50 transition shadow-sm" title="Rename"
                                  ><i className="fa-solid fa-pencil text-[10px]"></i></button>
                                  {/* View */}
                                  <button
                                    onClick={() => handleViewFile(doc)}
                                    className="bg-gray-50 border border-gray-200 rounded p-1 text-gray-500 hover:text-[#2563eb] hover:bg-white transition shadow-sm" title="View"
                                  ><i className="fa-solid fa-eye text-[10px]"></i></button>
                                  {/* Download */}
                                  <button
                                    onClick={() => handleDownload(doc._id)}
                                    className="bg-gray-50 border border-gray-200 rounded p-1 text-gray-500 hover:text-green-600 hover:bg-white transition shadow-sm" title="Download"
                                  ><i className="fa-solid fa-download text-[10px]"></i></button>
                                  <div className="w-px h-4 bg-gray-200 mx-0.5 hidden sm:block"></div>
                                  {/* Delete */}
                                  <button
                                    onClick={() => handleDelete(doc._id)}
                                    className="bg-red-50 border border-red-100 rounded p-1 text-gray-500 hover:text-red-500 hover:bg-red-100 transition shadow-sm" title="Delete"
                                  ><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-400 font-medium italic py-2 flex items-center justify-center h-full w-full border border-dashed border-gray-300 rounded bg-gray-50/50">
                          No files attached yet. Click "Attach Files".
                        </div>
                      )}
                    </div>

                    {/* RIGHT: upload */}
                    <div className="w-full md:w-32 shrink-0 flex flex-col gap-1.5 items-end justify-center">
                      <div className="relative w-full">
                        <input type="file" multiple ref={inputRef} onChange={handleFileChange(key)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20" disabled={isLoading} title=""
                        />
                        <button className="w-full bg-[#2563eb] hover:bg-blue-700 text-white font-bold py-2 px-2 rounded shadow-sm text-[11px] flex items-center justify-center gap-1.5 transition uppercase pointer-events-none whitespace-nowrap">
                          {isLoading ? <><i className="fa-solid fa-spinner fa-spin"></i> Uploading…</> : <><i className="fa-solid fa-cloud-arrow-up"></i> Attach Files</>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Inline File Viewer Modal */}
      {viewerDoc && (
        <div className="fixed inset-0 z-[99999] flex flex-col bg-black/85" onClick={() => { if (viewerDoc.blobUrl) URL.revokeObjectURL(viewerDoc.blobUrl); setViewerDoc(null); }}>
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-white text-sm font-bold truncate max-w-[55vw]">
              <i className="fa-solid fa-file mr-2 text-blue-400"></i>{viewerDoc.name}
            </span>
            <div className="flex items-center gap-2">
              <a href={viewerDoc.downloadUrl} target="_blank" rel="noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded transition flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <i className="fa-solid fa-download"></i> Download
              </a>
              <button onClick={() => { if (viewerDoc.blobUrl) URL.revokeObjectURL(viewerDoc.blobUrl); setViewerDoc(null); }}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-3 py-1.5 rounded transition flex items-center gap-1.5">
                <i className="fa-solid fa-xmark"></i> Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {viewerDoc.loading ? (
              <div className="flex flex-col items-center gap-3 text-white">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
                <span className="text-sm text-gray-300">Loading file...</span>
              </div>
            ) : viewerDoc.error ? (
              <div className="flex flex-col items-center gap-4 text-white">
                <i className="fa-solid fa-triangle-exclamation text-5xl text-yellow-400"></i>
                <p className="text-sm text-gray-300">Failed to load: {viewerDoc.error}</p>
                <a href={viewerDoc.downloadUrl} target="_blank" rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded transition flex items-center gap-2">
                  <i className="fa-solid fa-download"></i> Download Instead
                </a>
              </div>
            ) : (viewerDoc.isPdf || viewerDoc.isImage) ? (
              <iframe src={viewerDoc.blobUrl} title={viewerDoc.name} className="w-full h-full border-0 bg-white" style={{ display: 'block' }} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white gap-5">
                <i className="fa-solid fa-file-lines text-6xl text-gray-400"></i>
                <p className="text-base font-medium text-gray-300">Preview not available for this file type.</p>
                <a href={viewerDoc.downloadUrl} target="_blank" rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded transition flex items-center gap-2">
                  <i className="fa-solid fa-download"></i> Download to View
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
