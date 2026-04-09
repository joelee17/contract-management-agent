import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getDocuments,
  triggerSync,
  getTags,
  createTag,
  addTagToDocument,
  removeTagFromDocument,
  deleteDocument,
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  setDocumentFolder,
} from '../lib/api';
import {
  ArrowLeft,
  FileText,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  File,
  Plus,
  X,
  Tag,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Trash2,
  Pencil,
  Check,
} from 'lucide-react';

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
];

/* ─── Tag pill ──────────────────────────────────────────────────────────── */
function TagPill({ tag, onRemove }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: tag.color + '22', color: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(tag.id); }} className="hover:opacity-70">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

/* ─── Dropdown helper ───────────────────────────────────────────────────── */
function Dropdown({ trigger, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function outside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1">
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

/* ─── Tag picker ────────────────────────────────────────────────────────── */
function TagPicker({ fileId, docTags, allTags, onAdd, onRemove }) {
  const docTagIds = docTags.map((t) => t.id);
  const unassigned = allTags.filter((t) => !docTagIds.includes(t.id));
  return (
    <Dropdown trigger={
      <button className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors" title="Manage tags">
        <Plus className="w-3 h-3" />
      </button>
    }>
      {(close) => (
        <>
          {docTags.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">Assigned</div>
              {docTags.map((tag) => (
                <button key={tag.id} onClick={() => { onRemove(fileId, tag.id); close(); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-bg-secondary)] group">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-[var(--color-text-primary)] truncate">{tag.name}</span>
                  <X className="w-3 h-3 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100" />
                </button>
              ))}
              {unassigned.length > 0 && <div className="my-1 border-t border-[var(--color-border)]" />}
            </>
          )}
          {unassigned.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">Add tag</div>
              {unassigned.map((tag) => (
                <button key={tag.id} onClick={() => { onAdd(fileId, tag.id); close(); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-bg-secondary)]">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-[var(--color-text-primary)] truncate">{tag.name}</span>
                </button>
              ))}
            </>
          )}
          {allTags.length === 0 && <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No tags yet</div>}
        </>
      )}
    </Dropdown>
  );
}

/* ─── Folder picker ─────────────────────────────────────────────────────── */
function FolderPicker({ fileId, currentFolderId, allFolders, onChange }) {
  return (
    <Dropdown trigger={
      <button className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors" title="Move to folder">
        <Folder className="w-3 h-3" />
      </button>
    }>
      {(close) => (
        <>
          <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">Move to folder</div>
          {currentFolderId && (
            <button onClick={() => { onChange(fileId, null); close(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
              <X className="w-3 h-3" />Remove from folder
            </button>
          )}
          {allFolders.map((f) => (
            <button key={f.id} onClick={() => { onChange(fileId, f.id); close(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-bg-secondary)]">
              <Folder className="w-3.5 h-3.5 text-[var(--color-accent)] flex-shrink-0" />
              <span className={`flex-1 truncate ${f.id === currentFolderId ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>{f.name}</span>
              {f.id === currentFolderId && <Check className="w-3 h-3 text-[var(--color-accent)]" />}
            </button>
          ))}
          {allFolders.length === 0 && <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No folders yet</div>}
        </>
      )}
    </Dropdown>
  );
}

/* ─── Document tree row ─────────────────────────────────────────────────── */
function DocTreeRow({ doc, isLast, allTags, allFolders, onAddTag, onRemoveTag, onSetFolder, onDelete }) {
  const fileId = doc.file_id;
  const docTags = doc.tags || [];

  function formatDate(s) {
    if (!s) return '-';
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="flex items-start group">
      {/* Tree connectors */}
      <div className="flex-shrink-0 flex flex-col items-center" style={{ width: 32, marginLeft: 16 }}>
        <div className="w-px bg-[var(--color-border)]" style={{ height: 12 }} />
        <div className="flex items-center" style={{ height: 20 }}>
          <div className="w-px bg-[var(--color-border)]" style={{ height: isLast ? 10 : 20, alignSelf: 'flex-start' }} />
          <div className="h-px bg-[var(--color-border)]" style={{ width: 12 }} />
        </div>
        {!isLast && <div className="w-px bg-[var(--color-border)] flex-1" style={{ minHeight: 4 }} />}
      </div>

      {/* Row content */}
      <div className="flex-1 flex items-center gap-3 py-1.5 pr-3 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors min-w-0">
        <File className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />

        {/* File name */}
        <span className="text-sm text-[var(--color-text-primary)] truncate flex-1 min-w-0">
          {doc.file_name}
        </span>

        {/* Tags */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {docTags.map((tag) => (
            <TagPill key={tag.id} tag={tag} onRemove={(tagId) => onRemoveTag(fileId, tagId)} />
          ))}
          <TagPicker fileId={fileId} docTags={docTags} allTags={allTags} onAdd={onAddTag} onRemove={onRemoveTag} />
        </div>

        {/* Chunk count */}
        <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent-light)] text-[var(--color-accent)]">
          {doc.chunk_count ?? '-'} chunks
        </span>

        {/* Date */}
        <span className="flex-shrink-0 text-xs text-[var(--color-text-muted)] w-24 text-right">
          {formatDate(doc.indexed_at)}
        </span>

        {/* Folder picker */}
        <div className="flex-shrink-0">
          <FolderPicker fileId={fileId} currentFolderId={doc.folder_id} allFolders={allFolders} onChange={onSetFolder} />
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(fileId, doc.file_name)}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-red-50 transition-all"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Folder section ────────────────────────────────────────────────────── */
function FolderSection({ folder, docs, allTags, allFolders, onAddTag, onRemoveTag, onSetFolder, onDelete, onRenameFolder, onDeleteFolder }) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder?.name || '');
  const renameRef = useRef(null);

  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  function startRename() {
    setRenameValue(folder.name);
    setRenaming(true);
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) onRenameFolder(folder.id, trimmed);
    setRenaming(false);
  }

  function handleRenameKey(e) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setRenaming(false);
  }

  const FolderIcon = expanded ? FolderOpen : Folder;

  return (
    <div className="mb-2">
      {/* Folder header */}
      <div className="flex items-center gap-1 group/folder px-2 py-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors">
        <button onClick={() => setExpanded((e) => !e)} className="flex items-center gap-2 flex-1 min-w-0">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
          }
          <FolderIcon className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />

          {renaming ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKey}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-sm font-semibold bg-transparent border-b border-[var(--color-accent)] text-[var(--color-text-primary)] focus:outline-none min-w-0"
            />
          ) : (
            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {folder ? folder.name : 'Unfiled'}
            </span>
          )}

          <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0 ml-1">
            {docs.length}
          </span>
        </button>

        {folder && !renaming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity">
            <button onClick={startRename} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors" title="Rename folder">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => onDeleteFolder(folder.id, folder.name)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-red-50 transition-colors" title="Delete folder">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Tree rows */}
      {expanded && (
        <div className="ml-2">
          {docs.length === 0 ? (
            <div className="pl-12 py-2 text-xs text-[var(--color-text-muted)]">Empty folder</div>
          ) : (
            docs.map((doc, i) => (
              <DocTreeRow
                key={doc.file_id}
                doc={doc}
                isLast={i === docs.length - 1}
                allTags={allTags}
                allFolders={allFolders}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                onSetFolder={onSetFolder}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [allFolders, setAllFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState('');
  const [filterTagIds, setFilterTagIds] = useState([]);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [creatingTag, setCreatingTag] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [docsData, tagsData, foldersData] = await Promise.all([
        getDocuments(), getTags(), getFolders(),
      ]);
      setDocuments(docsData.documents || []);
      setAllTags(tagsData.tags || []);
      setAllFolders(foldersData.folders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage('');
    try {
      const result = await triggerSync();
      const parts = [];
      if (result.processed > 0) parts.push(`${result.processed} new`);
      if (result.skipped > 0) parts.push(`${result.skipped} unchanged`);
      if (result.failed?.length > 0) parts.push(`${result.failed.length} failed`);
      const summary = parts.length ? parts.join(', ') : 'nothing to sync';
      const failDetails = result.failed?.length ? ' — ' + result.failed.map((f) => `${f.name}: ${f.error}`).join('; ') : '';
      setSyncMessage(`Sync complete: ${summary}${failDetails}`);
      await loadAll();
    } catch (err) {
      setSyncMessage(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreateTag(e) {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    try {
      const data = await createTag(newTagName.trim(), newTagColor);
      setAllTags((prev) => [...prev, data.tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName(''); setNewTagColor(TAG_COLORS[0]); setShowCreateTag(false);
    } catch (err) { setError(err.message); }
    finally { setCreatingTag(false); }
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const data = await createFolder(newFolderName.trim());
      setAllFolders((prev) => [...prev, data.folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName(''); setShowCreateFolder(false);
    } catch (err) { setError(err.message); }
    finally { setCreatingFolder(false); }
  }

  async function handleRenameFolder(id, name) {
    try {
      const data = await renameFolder(id, name);
      setAllFolders((prev) => prev.map((f) => f.id === id ? data.folder : f).sort((a, b) => a.name.localeCompare(b.name)));
      setDocuments((prev) => prev.map((d) => d.folder_id === id ? { ...d, folder_name: data.folder.name } : d));
    } catch (err) { setError(err.message); }
  }

  async function handleDeleteFolder(id, name) {
    if (!window.confirm(`Delete folder "${name}"? Documents inside will become unfiled.`)) return;
    try {
      await deleteFolder(id);
      setAllFolders((prev) => prev.filter((f) => f.id !== id));
      setDocuments((prev) => prev.map((d) => d.folder_id === id ? { ...d, folder_id: null, folder_name: null } : d));
    } catch (err) { setError(err.message); }
  }

  async function handleAddTag(fileId, tagId) {
    try {
      const data = await addTagToDocument(fileId, tagId);
      setDocuments((prev) => prev.map((d) => d.file_id === fileId ? { ...d, tags: data.tags } : d));
    } catch (err) { setError(err.message); }
  }

  async function handleRemoveTag(fileId, tagId) {
    try {
      await removeTagFromDocument(fileId, tagId);
      setDocuments((prev) => prev.map((d) => d.file_id === fileId ? { ...d, tags: d.tags.filter((t) => t.id !== tagId) } : d));
    } catch (err) { setError(err.message); }
  }

  async function handleSetFolder(fileId, folderId) {
    try {
      await setDocumentFolder(fileId, folderId);
      const folder = allFolders.find((f) => f.id === folderId);
      setDocuments((prev) => prev.map((d) =>
        d.file_id === fileId ? { ...d, folder_id: folderId || null, folder_name: folder?.name || null } : d
      ));
    } catch (err) { setError(err.message); }
  }

  async function confirmDeleteDocument() {
    if (!confirmDelete) return;
    try {
      await deleteDocument(confirmDelete.fileId);
      setDocuments((prev) => prev.filter((d) => d.file_id !== confirmDelete.fileId));
    } catch (err) { setError(err.message); }
    finally { setConfirmDelete(null); }
  }

  // Filter then group
  const filtered = filterTagIds.length === 0
    ? documents
    : documents.filter((d) => filterTagIds.every((tid) => d.tags?.some((t) => t.id === tid)));

  const folderMap = new Map();
  const unfiled = [];
  for (const doc of filtered) {
    if (doc.folder_id) {
      if (!folderMap.has(doc.folder_id)) folderMap.set(doc.folder_id, []);
      folderMap.get(doc.folder_id).push(doc);
    } else {
      unfiled.push(doc);
    }
  }

  const sharedProps = {
    allTags, allFolders,
    onAddTag: handleAddTag,
    onRemoveTag: handleRemoveTag,
    onSetFolder: handleSetFolder,
    onDelete: (fileId, fileName) => setConfirmDelete({ fileId, fileName }),
    onRenameFolder: handleRenameFolder,
    onDeleteFolder: handleDeleteFolder,
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">Delete document?</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              <span className="font-medium">{confirmDelete.fileName}</span> will be removed from the index. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors">
                Cancel
              </button>
              <button onClick={confirmDeleteDocument}
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-danger)] text-white hover:opacity-90 transition-opacity">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
              <ArrowLeft className="w-4 h-4" />Back
            </button>
            <div className="w-px h-5 bg-[var(--color-border)]" />
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--color-accent)]" />
              Indexed Documents
            </h1>
          </div>
          <button onClick={handleSync} disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {syncMessage && (
          <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            syncMessage.startsWith('Sync failed') || syncMessage.includes('failed —') ? 'bg-red-50 border border-red-200 text-red-700'
            : syncMessage.includes('failed') ? 'bg-amber-50 border border-amber-200 text-amber-700'
            : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {syncMessage.includes('failed') ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            {syncMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-5 flex items-center gap-2 flex-wrap">
          <Tag className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
          {allTags.map((tag) => {
            const active = filterTagIds.includes(tag.id);
            return (
              <button key={tag.id} onClick={() => setFilterTagIds((p) => p.includes(tag.id) ? p.filter((id) => id !== tag.id) : [...p, tag.id])}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={active ? { backgroundColor: tag.color + '22', color: tag.color, borderColor: tag.color }
                  : { backgroundColor: 'transparent', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
                {active && <X className="w-2.5 h-2.5 ml-0.5" />}
              </button>
            );
          })}

          {showCreateTag ? (
            <form onSubmit={handleCreateTag} className="flex items-center gap-2">
              <input autoFocus value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name"
                className="px-2.5 py-1 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] w-28" />
              <div className="flex gap-1">
                {TAG_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setNewTagColor(c)}
                    className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: newTagColor === c ? 'var(--color-text-primary)' : 'transparent' }} />
                ))}
              </div>
              <button type="submit" disabled={creatingTag || !newTagName.trim()}
                className="px-2.5 py-1 text-xs rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors">
                {creatingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
              </button>
              <button type="button" onClick={() => { setShowCreateTag(false); setNewTagName(''); }}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-3.5 h-3.5" /></button>
            </form>
          ) : (
            <button onClick={() => setShowCreateTag(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
              <Plus className="w-3 h-3" />New tag
            </button>
          )}

          <div className="w-px h-4 bg-[var(--color-border)] mx-1" />

          {showCreateFolder ? (
            <form onSubmit={handleCreateFolder} className="flex items-center gap-2">
              <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name"
                className="px-2.5 py-1 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] w-32" />
              <button type="submit" disabled={creatingFolder || !newFolderName.trim()}
                className="px-2.5 py-1 text-xs rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors">
                {creatingFolder ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
              </button>
              <button type="button" onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-3.5 h-3.5" /></button>
            </form>
          ) : (
            <button onClick={() => setShowCreateFolder(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
              <FolderPlus className="w-3 h-3" />New folder
            </button>
          )}

          {filterTagIds.length > 0 && (
            <button onClick={() => setFilterTagIds([])} className="ml-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] underline">
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
            <p className="text-[var(--color-text-secondary)] font-medium">No documents indexed yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Click "Sync Now" to index documents from Google Drive.</p>
          </div>
        ) : (
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            {allFolders.map((folder) => (
              <FolderSection key={folder.id} folder={folder} docs={folderMap.get(folder.id) || []} {...sharedProps} />
            ))}
            {unfiled.length > 0 && (
              <FolderSection folder={null} docs={unfiled} {...sharedProps} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
