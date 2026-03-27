import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { GripVertical } from 'lucide-react';

export default function SplitLayout({ showLeft, leftPanel, rightPanel }) {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      {showLeft && (
        <>
          <Panel
            id="document-panel"
            order={1}
            defaultSize={50}
            minSize={30}
            maxSize={70}
          >
            <div className="h-full overflow-hidden">{leftPanel}</div>
          </Panel>
          <PanelResizeHandle className="w-2 bg-[var(--color-border)] hover:bg-[var(--color-accent)] transition-colors relative group flex items-center justify-center">
            <div className="absolute inset-y-0 -left-1 -right-1" />
            <GripVertical className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-white transition-colors" />
          </PanelResizeHandle>
        </>
      )}
      <Panel id="chat-panel" order={2} minSize={30}>
        <div className="h-full overflow-hidden">{rightPanel}</div>
      </Panel>
    </PanelGroup>
  );
}
