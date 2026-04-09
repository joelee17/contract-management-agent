import { useState, useCallback } from 'react';

export function useDocumentViewer() {
  const [activeFileId, setActiveFileId] = useState(null);
  const [activePage, setActivePage] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [activeFileName, setActiveFileName] = useState('');

  const openDocument = useCallback((fileId, pageNumber, charOffsetStart, charOffsetEnd, fileName, chunkText) => {
    setActiveFileId(fileId);
    setActivePage(pageNumber ? pageNumber - 1 : 0); // Convert to 0-based
    setActiveFileName(fileName || '');
    if (charOffsetStart != null && charOffsetEnd != null) {
      setHighlights([{ pageIndex: (pageNumber || 1) - 1, charOffsetStart, charOffsetEnd, chunkText: chunkText || null }]);
    } else {
      setHighlights([]);
    }
  }, []);

  const closeDocument = useCallback(() => {
    setActiveFileId(null);
    setActivePage(null);
    setHighlights([]);
    setActiveFileName('');
  }, []);

  return {
    activeFileId,
    activePage,
    highlights,
    activeFileName,
    openDocument,
    closeDocument,
  };
}
