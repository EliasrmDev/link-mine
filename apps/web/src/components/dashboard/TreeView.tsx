"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { TreeNodeData } from '@linkmine/shared'
import { ChevronRight, ExternalLink, FolderOpen } from "lucide-react";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TreeContextValue {
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  focusedId: string | null;
  setFocusedId: (id: string) => void;
}

export const TreeContext = createContext<TreeContextValue>({
  expandedIds: new Set(),
  toggleExpanded: () => {},
  focusedId: null,
  setFocusedId: () => {},
});

export function useTreeContext() {
  return useContext(TreeContext);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectDefaultExpanded(
  nodes: TreeNodeData[],
  acc: Set<string> = new Set()
): Set<string> {
  for (const node of nodes) {
    if (node.defaultExpanded) acc.add(node.id);
    if (node.children) collectDefaultExpanded(node.children, acc);
  }
  return acc;
}

/** Collect all visible (non-collapsed) node ids in order. Used for keyboard nav. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function collectVisible(nodes: TreeNodeData[], expandedIds: Set<string>): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    result.push(node.id);
    if (node.children?.length && expandedIds.has(node.id)) {
      result.push(...collectVisible(node.children, expandedIds));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// TreeView — Client boundary (context + state live here)
// ---------------------------------------------------------------------------

interface TreeViewProps {
  nodes: TreeNodeData[];
  label?: string;
}

export default function TreeView({ nodes, label = "Tree view" }: TreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => collectDefaultExpanded(nodes)
  );
  // Roving tabindex: track which node currently owns tabIndex=0
  const [focusedId, setFocusedId] = useState<string | null>(
    () => nodes[0]?.id ?? null
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  return (
    <TreeContext.Provider
      value={{ expandedIds, toggleExpanded, focusedId, setFocusedId }}
    >
      <ul
        role="tree"
        aria-label={label}
        className="select-none text-sm"
      >
        {nodes.map((node, i) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            depth={0}
            posInSet={i + 1}
            setSize={nodes.length}
            allRootNodes={nodes}
          />
        ))}
      </ul>
    </TreeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// TreeNodeItem
// ---------------------------------------------------------------------------

interface TreeNodeItemProps {
  node: TreeNodeData;
  depth: number;
  posInSet: number;
  setSize: number;
  allRootNodes: TreeNodeData[];
}

function TreeNodeItem({ node, depth, posInSet, setSize, allRootNodes }: TreeNodeItemProps) {
  const { expandedIds, toggleExpanded, focusedId, setFocusedId } =
    useTreeContext();

  const hasChildren = Boolean(node.children?.length);
  const isExpanded = expandedIds.has(node.id);
  const isFocused = focusedId === node.id;

  const itemRef = useRef<HTMLLIElement>(null);

  // ----- keyboard navigation -----

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // Collect all visible treeitem elements in DOM order
      const allItems = (): HTMLElement[] =>
        Array.from(
          document.querySelectorAll<HTMLElement>("[data-treeitem]")
        );

      const currentIdx = () =>
        allItems().findIndex((el) => el.dataset.nodeid === node.id);

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          if (hasChildren && !isExpanded) {
            toggleExpanded(node.id);
          } else if (hasChildren && isExpanded) {
            const items = allItems();
            const next = items[currentIdx() + 1];
            if (next) { next.focus(); setFocusedId(next.dataset.nodeid ?? node.id); }
          }
          break;

        case "ArrowLeft":
          e.preventDefault();
          if (hasChildren && isExpanded) {
            toggleExpanded(node.id);
          } else {
            // Move to parent — find the first item above with smaller depth
            const items = allItems();
            const idx = currentIdx();
            const myDepth = Number(itemRef.current?.dataset.depth ?? depth);
            for (let i = idx - 1; i >= 0; i--) {
              const d = Number(items[i].dataset.depth ?? 0);
              if (d < myDepth) {
                items[i].focus();
                setFocusedId(items[i].dataset.nodeid ?? node.id);
                break;
              }
            }
          }
          break;

        case "ArrowDown":
          e.preventDefault();
          {
            const items = allItems();
            const next = items[currentIdx() + 1];
            if (next) { next.focus(); setFocusedId(next.dataset.nodeid ?? node.id); }
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          {
            const items = allItems();
            const idx = currentIdx();
            if (idx > 0) { items[idx - 1].focus(); setFocusedId(items[idx - 1].dataset.nodeid ?? node.id); }
          }
          break;

        case "Enter":
        case " ":
          e.preventDefault();
          if (hasChildren) {
            toggleExpanded(node.id);
          } else if (node.href) {
            window.open(node.href, '_blank', 'noopener,noreferrer');
          }
          break;

        case "Home":
          e.preventDefault();
          {
            const items = allItems();
            if (items[0]) { items[0].focus(); setFocusedId(items[0].dataset.nodeid ?? node.id); }
          }
          break;

        case "End":
          e.preventDefault();
          {
            const items = allItems();
            const last = items[items.length - 1];
            if (last) { last.focus(); setFocusedId(last.dataset.nodeid ?? node.id); }
          }
          break;
      }
    },
    [depth, hasChildren, isExpanded, node.id, node.href, toggleExpanded, setFocusedId]
  );

  // ---- helpers ----
  const isPathFolder = !node.href && hasChildren;

  // ----- render -----
  const indentPx = depth * 16;

  return (
    <li
      ref={itemRef}
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isFocused}
      aria-level={depth + 1}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      data-treeitem
      data-nodeid={node.id}
      data-depth={depth}
      tabIndex={isFocused ? 0 : -1}
      onFocus={() => setFocusedId(node.id)}
      onKeyDown={handleKeyDown}
      className="list-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset rounded-md"
    >
      {/* ── Row ── */}
      <div
        style={{ paddingLeft: `${8 + indentPx}px` }}
        className={[
          "group flex items-center gap-1.5 pr-2 py-1 rounded-md cursor-pointer",
          "transition-colors duration-100",
          isPathFolder ? "mt-0.5" : "",
          isFocused
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : isPathFolder
            ? "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60",
        ].join(" ")}
        onClick={() => {
          setFocusedId(node.id);
          if (hasChildren) toggleExpanded(node.id);
        }}
      >
        {/* Chevron toggle button — not independently tabbable */}
        {hasChildren ? (
          <button
            tabIndex={-1}
            aria-label={isExpanded ? `Collapse ${node.title}` : `Expand ${node.title}`}
            onClick={(e) => { e.stopPropagation(); setFocusedId(node.id); toggleExpanded(node.id); }}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500"
          >
            {isPathFolder ? (
              <FolderOpen
                className="w-3.5 h-3.5 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <ChevronRight
                className={[
                  "w-3 h-3 shrink-0 transition-transform duration-200",
                  isExpanded ? "rotate-90" : "",
                ].join(" ")}
                aria-hidden="true"
              />
            )}
          </button>
        ) : null}

        {/* Title */}
        <span
          className={[
            "flex-1 min-w-0 leading-5 line-clamp-2 sm:line-clamp-1",
            isPathFolder
              ? "font-mono text-xs font-medium tracking-tight"
              : "text-sm",
          ].join(" ")}
          title={node.title}
        >
          {node.title}
        </span>

        {/* External link — real <a> for semantic correctness, supplemental navigation */}
        {node.href && (
          <a
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open "${node.title}" in new tab`}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className={[
              "shrink-0 p-0.5 rounded",
              "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
              "focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500",
            ].join(" ")}
          >
            <ExternalLink className="w-5 h-5" aria-hidden="true" />
          </a>
        )}
      </div>

      {/* ── Children with smooth CSS grid animation ── */}
      {hasChildren && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: isExpanded ? "1fr" : "0fr",
            transition: "grid-template-rows 200ms ease",
          }}
          aria-hidden={!isExpanded}
        >
          <div style={{ overflow: "hidden" }}>
            <ul
              role="group"
              className="relative ml-5 border-l border-slate-200 dark:border-slate-700/60"
            >
              {node.children!.map((child, i) => (
                <TreeNodeItem
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  posInSet={i + 1}
                  setSize={node.children!.length}
                  allRootNodes={allRootNodes}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}

