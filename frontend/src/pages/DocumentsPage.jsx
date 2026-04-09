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
  MoreHorizontal,
} from 'lucide-react';

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
];

function TagPill({ tag, onRemove }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: tag.color + '22', color: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(tag.id); }} className="hover:opacity-70 transition-opacity">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

function TagPicker({ fileId, docTags, allTags, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const docTagIds = docTags.map((t) => t.id);
  const unassigned = allTags.filter((t) => !docTagIds.includes(t.id));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors"
        title="Manage tags"
      >
        <Plus className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-44 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1">
          {docTags.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">Assigned</div>
              {docTags.map((tag) => (
                <button key={tag.id} onClick={() => onRemove(fileId, tag.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-bg-secondary)] transition-colors group">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-[var(--color-text-primary)] truncate">{tag.name}</span>
                  <X className="w-3 h-3 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              {unassigned.length > 0 && <div className="my-1 border-t border-[var(--color-border)]" />}
            </>
          )}
          {unassigned.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">Add tag</div>
              {unassigned.map((tag) => (
                <button key={tag.id} onClick={() => onAdd(fileId, tag.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-bg-secondary)] transition-colors">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-[var(--color-text-primary)] truncate">{tag.name}</span>
                </button>
              ))}
            </>
          )}
          {allTags.length === 0 && <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No tags yet</div>}
        </div>
      )}
    </div>
  );
}

function FolderPicker({ fileId, currentFolderId, allFolders, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors"
        title="Move to folder"
      >
        <Folder className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1">
          <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">Move to folder</div>
          {currentFolderId && (
            <button
              onClick={() => { onChange(fileId, null); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-bg-secondary)] transition-colors text-[var(--color-text-muted)]"
            >
              <X className="w-3 h-3" />
              Remove from folder
            </button>
          )}
          {allFolders.map((f) => (
            <button
              key={f.id}
              onClick={() => { onChange(fileId, f.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <Folder className="w-3.5 h-3.5 text-[var(--color-accent)] flex-shrink-0" />
              <span className={`flex-1 truncate ${f.id === currentFolderId ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>{f.name}</span>
              {f.id === currentFolderId && <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />}
            </button>
          ))}
          {allFolders.length === 0 && <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No folders yet</div>}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc, allTags, allFolders, onAddTag, onRemoveTag, onSetFolder, onDelete }) {
  const fileId = doc.file_id || doc.fileId;
  const docTags = doc.tags || [];

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <tr className="hover:bg-[var(--color-bg-secondary)] transition-colors group">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <File className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {doc.file_name || doc.name || doc.fileName}
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {docTags.map((tag) => (
            <TagPill key={tag.id} tag={tag} onRemove={(tagId) => onRemoveTag(fileId, tagId)} />
          ))}
          <TagPicker fileId={fileId} docTags={docTags} allTags={allTags} onAdd={onAddTag} onRemove={onRemoveTag} />
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1">
          <FolderPicker fileId={fileId} currentFolderId={doc.folder_id} allFolders={allFolders} onChange={onSetFolder} />
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent-light)] text-[var(--color-accent)]">
          {doc.chunk_count ?? doc.chunkCount ?? '-'}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-sm text-[var(--color-text-muted)]">
          {formatDate(doc.indexed_at || doc.lastIndexed || doc.indexedAt)}
        </span>
      </td>
      <td className="px-3 py-3.5">
        <button
          onClick={() => onDelete(fileId, doc.file_name || doc.fileName)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-red-50 transition-all"
          title="Delete document"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function FolderSection({ folder, docs, allTags, allFolders, onAddTag, onRemoveTag, onSetFolder, onDelete, onDeleteFolder, defaultOpen = true }) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden mb-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors group"
      >
        {expanded
          ? <FolderOpen className="w-4 h-4 text-[var(--color-accent)]" />
          : <Folder className="w-4 h-4 text-[var(--color-accent)]" />
        }
        <span className="flex-1 text-left">{folder ? folder.name : 'Unfiled'}</span>
        <span className="text-xs text-[var(--color-text-muted)] mr-2">{docs.length} doc{docs.length !== 1 ? 's' : ''}</span>
        {folder && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id, folder.name); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-red-50 transition-all mr-1"
            title="Delete folder"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {expanded && docs.length > 0 && (
        <div className="border-t border-[var(--color-border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-5 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Document</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Tags</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Folder</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Chunks</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Last Indexed</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {docs.map((doc) => (
                <DocumentRow
                  key={doc.file_id || doc.fileId}
                  doc={doc}
                  allTags={allTags}
                  allFolders={allFolders}
                  onAddTag={onAddTag}
                  onRemoveTag={onRemoveTag}
                  onSetFolder={onSetFolder}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expanded && docs.length === 0 && (
        <div className="border-t border-[var(--color-border)] px-5 py-4 text-sm text-[var(--color-text-muted)]">
          No documents in this folder
        </div>
      )}
    </div>
  );
}

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
  const [confirmDelete, setConfirmDelete] = useState(null); // { fileId, fileName }
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [docsData, tagsData, foldersData] = await Promise.all([
        getDocuments(),
        getTags(),
        getFolders(),
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
      const failDetails = result.failed?.length
        ? ' — ' + result.failed.map((f) => `${f.name}: ${f.error}`).join('; ')
        : '';
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
      setNewTagName('');
      setNewTagColor(TAG_COLORS[0]);
      setShowCreateTag(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingTag(false);
    }
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const data = await createFolder(newFolderName.trim());
      setAllFolders((prev) => [...prev, data.folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName('');
      setShowCreateFolder(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleDeleteFolder(id, name) {
    if (!window.confirm(`Delete folder "${name}"? Documents inside will become unfiled.`)) return;
    try {
      await deleteFolder(id);
      setAllFolders((prev) => prev.filter((f) => f.id !== id));
      setDocuments((prev) => prev.map((d) => d.folder_id === id ? { ...d, folder_id: null, folder_name: null } : d));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddTag(fileId, tagId) {
    try {
      const data = await addTagToDocument(fileId, tagId);
      setDocuments((prev) => prev.map((doc) => doc.file_id === fileId ? { ...doc, tags: data.tags } : doc));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveTag(fileId, tagId) {
    try {
      await removeTagFromDocument(fileId, tagId);
      setDocuments((prev) => prev.map((doc) =>
        doc.file_id === fileId ? { ...doc, tags: doc.tags.filter((t) => t.id !== tagId) } : doc
      ));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetFolder(fileId, folderId) {
    try {
      await setDocumentFolder(fileId, folderId);
      const folder = allFolders.find((f) => f.id === folderId);
      setDocuments((prev) => prev.map((doc) =>
        doc.file_id === fileId
          ? { ...doc, folder_id: folderId || null, folder_name: folder?.name || null }
          : doc
      ));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteDocument(fileId, fileName) {
    setConfirmDelete({ fileId, fileName });
  }

  async function confirmDeleteDocument() {
    if (!confirmDelete) return;
    try {
      await deleteDocument(confirmDelete.fileId);
      setDocuments((prev) => prev.filter((d) => d.file_id !== confirmDelete.fileId));
      setConfirmDelete(null);
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  }

  function toggleFilterTag(tagId) {
    setFilterTagIds((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);
  }

  // Filter by selected tags
  const filteredDocs = filterTagIds.length === 0
    ? documents
    : documents.filter((doc) => filterTagIds.every((tid) => doc.tags?.some((t) => t.id === tid)));

  // Group documents by folder
  const folderMap = new Map(); // folderId -> docs[]
  const unfiled = [];
  for (const doc of filteredDocs) {
    if (doc.folder_id) {
      if (!folderMap.has(doc.folder_id)) folderMap.set(doc.folder_id, []);
      folderMap.get(doc.folder_id).push(doc);
    } else {
      unfiled.push(doc);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">Delete document?</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              <span className="font-medium">{confirmDelete.fileName}</span> will be removed from the index. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteDocument}
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-danger)] text-white hover:opacity-90 transition-opacity"
              >
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
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="w-px h-5 bg-[var(--color-border)]" />
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--color-accent)]" />
              Indexed Documents
            </h1>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {syncMessage && (
          <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            syncMessage.startsWith('Sync failed') || syncMessage.includes('failed —')
              ? 'bg-red-50 border border-red-200 text-red-700'
              : syncMessage.includes('failed')
              ? 'bg-amber-50 border border-amber-200 text-amber-700'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {syncMessage.includes('failed') ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            {syncMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Toolbar: tag filter + folder create + tag create */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <Tag className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
          {allTags.map((tag) => {
            const active = filterTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleFilterTag(tag.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={active
                  ? { backgroundColor: tag.color + '22', color: tag.color, borderColor: tag.color }
                  : { backgroundColor: 'transparent', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
              >
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
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
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
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
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
          <div>
            {/* Folders with documents */}
            {allFolders.map((folder) => {
              const docs = folderMap.get(folder.id) || [];
              return (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  docs={docs}
                  allTags={allTags}
                  allFolders={allFolders}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                  onSetFolder={handleSetFolder}
                  onDelete={handleDeleteDocument}
                  onDeleteFolder={handleDeleteFolder}
                />
              );
            })}

            {/* Unfiled documents */}
            {unfiled.length > 0 && (
              <FolderSection
                folder={null}
                docs={unfiled}
                allTags={allTags}
                allFolders={allFolders}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                onSetFolder={handleSetFolder}
                onDelete={handleDeleteDocument}
                onDeleteFolder={handleDeleteFolder}
                defaultOpen={true}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
