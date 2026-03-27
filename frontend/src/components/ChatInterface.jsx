import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { parseCitations } from '../lib/citationParser';
import SourceCitation from './SourceCitation';
import SourcesFooter from './SourcesFooter';
import {
  Send,
  Square,
  MessageSquarePlus,
  Loader2,
  Search,
  FileText,
  Scale,
} from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  {
    icon: Search,
    text: 'What are the key termination clauses across all contracts?',
  },
  {
    icon: Scale,
    text: 'Which contracts have indemnification provisions?',
  },
  {
    icon: FileText,
    text: 'Summarize the payment terms in the latest agreement.',
  },
];

function MessageContent({ content, sources, onOpenDocument }) {
  const segments = parseCitations(content);

  return (
    <div className="markdown-content text-sm leading-relaxed">
      {segments.map((segment, i) => {
        if (segment.type === 'citation') {
          const source = sources?.[segment.sourceIndex - 1];
          return (
            <SourceCitation
              key={i}
              sourceIndex={segment.sourceIndex}
              source={source}
              onOpenDocument={onOpenDocument}
            />
          );
        }
        return (
          <ReactMarkdown key={i} rehypePlugins={[rehypeRaw]}>
            {segment.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

export default function ChatInterface({
  messages,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  onNewChat,
  onOpenDocument,
  sources,
}) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSubmit = useCallback(
    (e) => {
      e?.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isStreaming) return;
      setInput('');
      onSendMessage(trimmed);
    },
    [input, isStreaming, onSendMessage]
  );

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-primary)]">
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        {!hasMessages ? (
          <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-light)] flex items-center justify-center mb-4">
              <MessageSquarePlus className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
              Ask about your contracts
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] text-center mb-8">
              Query your indexed documents using natural language. Responses
              include source citations you can click to view the original
              document.
            </p>

            <div className="w-full space-y-2">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(q.text);
                    textareaRef.current?.focus();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-left hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors group"
                >
                  <q.icon className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] flex-shrink-0" />
                  <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]">
                    {q.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[var(--color-accent)] text-white text-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="max-w-[85%]">
                      <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm">
                        <MessageContent
                          content={msg.content}
                          sources={msg.sources}
                          onOpenDocument={onOpenDocument}
                        />
                        {isStreaming && i === messages.length - 1 && (
                          <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] animate-pulse rounded-sm ml-0.5 align-middle" />
                        )}
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <SourcesFooter
                          sources={msg.sources}
                          onOpenDocument={onOpenDocument}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            {hasMessages && (
              <button
                onClick={onNewChat}
                className="flex-shrink-0 p-2.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                title="New chat"
              >
                <MessageSquarePlus className="w-5 h-5" />
              </button>
            )}

            <div className="flex-1 flex items-end rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] focus-within:ring-2 focus-within:ring-[var(--color-border-focus)] focus-within:border-transparent transition-shadow">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your contracts..."
                rows={1}
                className="flex-1 px-4 py-2.5 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] resize-none focus:outline-none max-h-[200px]"
              />
              <div className="flex-shrink-0 p-1.5">
                {isStreaming ? (
                  <button
                    onClick={onStopStreaming}
                    className="p-2 rounded-lg bg-[var(--color-danger)] text-white hover:bg-red-600 transition-colors"
                    title="Stop generating"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                    className="p-2 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-[var(--color-text-muted)] text-center mt-2">
            Responses are generated by AI and may contain inaccuracies. Always
            verify with the source documents.
          </p>
        </div>
      </div>
    </div>
  );
}
