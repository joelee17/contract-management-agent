import { useState } from 'react';
import { useDocumentViewer } from '../hooks/useDocumentViewer';
import { useStreamingQuery } from '../hooks/useStreamingQuery';
import SplitLayout from '../components/SplitLayout';
import ChatInterface from '../components/ChatInterface';
import DocumentViewer from '../components/DocumentViewer';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { FileText, FolderOpen, LogOut } from 'lucide-react';

export default function QueryPage() {
  const documentViewer = useDocumentViewer();
  const streaming = useStreamingQuery();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);

  async function handleSendMessage(question) {
    const userMessage = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);

    await streaming.sendQuery(question, conversationId);
  }

  function handleNewChat() {
    setMessages([]);
    setConversationId(null);
    streaming.stopStreaming();
  }

  // When streaming completes, add the assistant message
  const allMessages = [...messages];
  if (streaming.response || streaming.isStreaming) {
    allMessages.push({
      role: 'assistant',
      content: streaming.response,
      sources: streaming.sources,
    });
  }

  const showViewer = !!documentViewer.activeFileId;

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent)]">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[var(--color-text-primary)]">
            Contract Agent
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/documents')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Documents
          </button>
          <div className="w-px h-5 bg-[var(--color-border)]" />
          <span className="text-sm text-[var(--color-text-muted)]">
            {user?.name || user?.email}
          </span>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <SplitLayout
          showLeft={showViewer}
          leftPanel={
            <DocumentViewer
              fileId={documentViewer.activeFileId}
              page={documentViewer.activePage}
              highlights={documentViewer.highlights}
              fileName={documentViewer.activeFileName}
              onClose={documentViewer.closeDocument}
            />
          }
          rightPanel={
            <ChatInterface
              messages={allMessages}
              isStreaming={streaming.isStreaming}
              onSendMessage={handleSendMessage}
              onStopStreaming={streaming.stopStreaming}
              onNewChat={handleNewChat}
              onOpenDocument={documentViewer.openDocument}
              sources={streaming.sources}
            />
          }
        />
      </div>
    </div>
  );
}
