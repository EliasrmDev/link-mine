"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { TreeNodeData } from '@linkmine/shared'
import { ChevronRight, ExternalLink } from "lucide-react";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TreeContextValue {
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
}

export const TreeContext = createContext<TreeContextValue>({
  expandedIds: new Set(),
  toggleExpanded: () => {},
  selectedId: null,
  setSelectedId: () => {},
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  return (
    <TreeContext.Provider
      value={{ expandedIds, toggleExpanded, selectedId, setSelectedId }}
    >
      <ul
        role="tree"
        aria-label={label}
        className="select-none text-sm"
      >
        {nodes.map((node) => (
          <TreeNodeItem key={node.id} node={node} depth={0} />
        ))}
      </ul>
    </TreeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// TreeNodeItem — co-located so it shares the same "use client" boundary
// without a second file needing its own directive.
// ---------------------------------------------------------------------------

interface TreeNodeItemProps {
  node: TreeNodeData;
  depth: number;
}

function TreeNodeItem({ node, depth }: TreeNodeItemProps) {
  const { expandedIds, toggleExpanded, selectedId, setSelectedId } =
    useTreeContext();

  const hasChildren = Boolean(node.children?.length);
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  const rowRef = useRef<HTMLDivElement>(null);

  // ----- interaction -----

  const handleRowClick = useCallback(() => {
    setSelectedId(node.id);
    if (hasChildren) toggleExpanded(node.id);
  }, [hasChildren, node.id, setSelectedId, toggleExpanded]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // Helpers that query all currently-visible treeitem rows in the DOM
      const allRows = (): HTMLElement[] =>
        Array.from(
          document.querySelectorAll<HTMLElement>("[data-treerow]")
        );

      const currentIndex = () =>
        allRows().findIndex((el) => el.dataset.nodeid === node.id);

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          if (hasChildren && !isExpanded) {
            toggleExpanded(node.id);
          } else if (hasChildren && isExpanded) {
            const rows = allRows();
            rows[currentIndex() + 1]?.focus();
          }
          break;

        case "ArrowLeft":
          e.preventDefault();
          if (hasChildren && isExpanded) {
            toggleExpanded(node.id);
          } else {
            // Jump to closest ancestor treerow (first row before this one at
            // a shallower depth — approximated by scanning backwards for
            // smaller padding-left).
            const rows = allRows();
            const idx = currentIndex();
            const myDepth = Number(rowRef.current?.dataset.depth ?? depth);
            for (let i = idx - 1; i >= 0; i--) {
              const d = Number(rows[i].dataset.depth ?? 0);
              if (d < myDepth) {
                rows[i].focus();
                break;
              }
            }
          }
          break;

        case "ArrowDown":
          e.preventDefault();
          {
            const rows = allRows();
            rows[currentIndex() + 1]?.focus();
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          {
            const rows = allRows();
            rows[Math.max(0, currentIndex() - 1)]?.focus();
          }
          break;

        case "Enter":
        case " ":
          e.preventDefault();
          handleRowClick();
          break;

        case "Home":
          e.preventDefault();
          allRows()[0]?.focus();
          break;

        case "End":
          e.preventDefault();
          {
            const rows = allRows();
            rows[rows.length - 1]?.focus();
          }
          break;
      }
    },
    [depth, hasChildren, isExpanded, node.id, toggleExpanded, handleRowClick]
  );

  // ----- render -----

  const indentPx = depth * 16;

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={hasChildren && isSelected ? true : undefined}
      aria-level={depth + 1}
      className="list-none"
    >
      {/* ── Row ── */}
      <div
        ref={rowRef}
        data-treerow
        data-nodeid={node.id}
        data-depth={depth}
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        style={{ paddingLeft: `${8 + indentPx}px` }}
        className={[
          "group flex items-center gap-1.5 pr-2 py-1 rounded-md cursor-pointer",
          "outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset",
          "transition-colors duration-100",
          hasChildren && isSelected
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60",
        ].join(" ")}
      >
        {/* Chevron — always reserves space so titles align */}
        <span
          className={[
            "flex-shrink-0 w-4 h-4 flex items-center justify-center",
            "text-slate-400 dark:text-slate-500",
            hasChildren
              ? ""
              : "hidden pointer-events-none",
          ].join(" ")}
          aria-hidden="true"
        >
            <ChevronRight
                className={[
                        "w-3 h-3 shrink-0 transition-transform duration-200",
                        isExpanded ? "rotate-90" : "",
                    ].join(" ")
                }
            />
        </span>

        {/* Title — truncates on desktop, clamps on mobile */}
        <span
          className="flex-1 min-w-0 text-sm leading-5 line-clamp-2 sm:line-clamp-1"
          title={node.title}
        >
          {node.title}
        </span>

        {/* External link icon — visible on hover/focus */}
        {node.href && (
          <a
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open "${node.title}" in new tab`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            tabIndex={-1} // navigated to via the row; explicit link is supplemental
            className={[
              "shrink-0 p-0.5 rounded",
              "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
              "focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500",
            ].join(" ")}
          >
            <ExternalLink className="w-5 h-5" />
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
        >
          <div style={{ overflow: "hidden" }}>
            <ul
              role="group"
              className="relative ml-5 border-l border-slate-200 dark:border-slate-700/60"
            >
              {node.children!.map((child: TreeNodeData) => (
                <TreeNodeItem key={child.id} node={child} depth={depth + 1} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}
