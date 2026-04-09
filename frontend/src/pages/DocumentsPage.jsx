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
} from 'lucide-react';

const TAG_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
];

function TagPill({ tag, onRemove }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: tag.color + '22', color: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(tag.id); }}
          className="hover:opacity-70 transition-opacity"
        >
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
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
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
              <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                Assigned
              </div>
              {docTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => onRemove(fileId, tag.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-bg-secondary)] transition-colors group"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-[var(--color-text-primary)] truncate">{tag.name}</span>
                  <X className="w-3 h-3 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              {unassigned.length > 0 && (
                <div className="my-1 border-t border-[var(--color-border)]" />
              )}
            </>
          )}
          {unassigned.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                Add tag
              </div>
              {unassigned.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => onAdd(fileId, tag.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-[var(--color-text-primary)] truncate">{tag.name}</span>
                </button>
              ))}
            </>
          )}
          {allTags.length === 0 && (
            <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
              No tags yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState('');
  const [filterTagIds, setFilterTagIds] = useState([]);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [creatingTag, setCreatingTag] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    loadDocuments();
    loadTags();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    setError('');
    try {
      const data = await getDocuments();
      setDocuments(data.documents || data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTags() {
    try {
      const data = await getTags();
      setAllTags(data.tags || []);
    } catch {
      // non-critical
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
      await loadDocuments();
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

  async function handleAddTag(fileId, tagId) {
    try {
      const data = await addTagToDocument(fileId, tagId);
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.file_id === fileId ? { ...doc, tags: data.tags } : doc
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveTag(fileId, tagId) {
    try {
      await removeTagFromDocument(fileId, tagId);
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.file_id === fileId
            ? { ...doc, tags: doc.tags.filter((t) => t.id !== tagId) }
            : doc
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleFilterTag(tagId) {
    setFilterTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const filteredDocuments =
    filterTagIds.length === 0
      ? documents
      : documents.filter((doc) =>
          filterTagIds.every((tid) => doc.tags?.some((t) => t.id === tid))
        );

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
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
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {syncMessage && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
              syncMessage.startsWith('Sync failed') || syncMessage.includes('failed —')
                ? 'bg-red-50 border border-red-200 text-red-700'
                : syncMessage.includes('failed')
                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}
          >
            {syncMessage.includes('failed') ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            {syncMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tag filter bar */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <Tag className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
          {allTags.map((tag) => {
            const active = filterTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleFilterTag(tag.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={
                  active
                    ? { backgroundColor: tag.color + '22', color: tag.color, borderColor: tag.color }
                    : { backgroundColor: 'transparent', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
                {active && <X className="w-2.5 h-2.5 ml-0.5" />}
              </button>
            );
          })}

          {/* Create tag */}
          {showCreateTag ? (
            <form onSubmit={handleCreateTag} className="flex items-center gap-2">
              <input
                autoFocus
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                className="px-2.5 py-1 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] w-28"
              />
              <div className="flex gap-1">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: newTagColor === c ? 'var(--color-text-primary)' : 'transparent',
                    }}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={creatingTag || !newTagName.trim()}
                className="px-2.5 py-1 text-xs rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
              >
                {creatingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateTag(false); setNewTagName(''); }}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowCreateTag(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
            >
              <Plus className="w-3 h-3" />
              New tag
            </button>
          )}

          {filterTagIds.length > 0 && (
            <button
              onClick={() => setFilterTagIds([])}
              className="ml-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] underline"
            >
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
            <p className="text-[var(--color-text-secondary)] font-medium">
              No documents indexed yet
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Click "Sync Now" to index documents from your connected sources.
            </p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-20">
            <Tag className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
            <p className="text-[var(--color-text-secondary)] font-medium">
              No documents match the selected tags
            </p>
            <button
              onClick={() => setFilterTagIds([])}
              className="mt-2 text-sm text-[var(--color-accent)] hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Document
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Chunks
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Last Indexed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredDocuments.map((doc) => {
                  const fileId = doc.file_id || doc.fileId;
                  const docTags = doc.tags || [];
                  return (
                    <tr
                      key={fileId}
                      className="hover:bg-[var(--color-bg-secondary)] transition-colors"
                    >
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
                            <TagPill
                              key={tag.id}
                              tag={tag}
                              onRemove={(tagId) => handleRemoveTag(fileId, tagId)}
                            />
                          ))}
                          <TagPicker
                            fileId={fileId}
                            docTags={docTags}
                            allTags={allTags}
                            onAdd={handleAddTag}
                            onRemove={handleRemoveTag}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                          {doc.chunk_count ?? doc.chunkCount ?? doc.chunks ?? '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-[var(--color-text-muted)]">
                          {formatDate(doc.indexed_at || doc.lastIndexed || doc.indexedAt || doc.updatedAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
