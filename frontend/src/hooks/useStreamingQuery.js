import { useState, useCallback, useRef } from 'react';
import { queryContracts } from '../lib/api';

export function useStreamingQuery() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [response, setResponse] = useState('');
  const [sources, setSources] = useState([]);
  const abortRef = useRef(false);
  const readerRef = useRef(null);

  const stopStreaming = useCallback(() => {
    abortRef.current = true;
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendQuery = useCallback(async (question, conversationId) => {
    abortRef.current = false;
    setIsStreaming(true);
    setResponse('');
    setSources([]);

    try {
      const reader = await queryContracts(question, conversationId);
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (abortRef.current) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = null;

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (currentEvent === 'sources') {
              try {
                const parsed = JSON.parse(data);
                setSources(parsed);
              } catch {
                // ignore parse errors
              }
            } else if (currentEvent === 'text') {
              setResponse((prev) => prev + data);
            } else if (currentEvent === 'done') {
              // Stream complete
            } else if (currentEvent === 'error') {
              try {
                const parsed = JSON.parse(data);
                throw new Error(parsed.message || 'Query failed');
              } catch (e) {
                if (e.message !== 'Query failed') throw e;
              }
            }

            currentEvent = null;
          } else if (line === '') {
            currentEvent = null;
          }
        }
      }
    } catch (err) {
      if (!abortRef.current) {
        setResponse((prev) => prev || `Error: ${err.message}`);
      }
    } finally {
      readerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  return { sendQuery, isStreaming, response, sources, stopStreaming };
}
