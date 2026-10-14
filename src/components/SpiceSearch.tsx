'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { familyLabel } from '@/lib/colors';
import { spiceColor } from '@/lib/spice-colors';
import { useSelection } from '@/context/SelectionContext';

interface SpiceItem {
  id: string;
  name: string;
  family: string;
}

interface SpiceSearchProps {
  data: SpiceItem[];
  inline?: boolean;
}

const MAX_RESULTS = 8;

/** Brief feedback message shown after selecting/deselecting. */
interface Feedback {
  text: string;
  key: number;
}

export default function SpiceSearch({ data, inline = false }: SpiceSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toggleSpice, selectedSpiceIds } = useSelection();

  // Filter results by query (name or family, case-insensitive substring).
  const results = useMemo<SpiceItem[]>(() => {
    if (!query.trim()) return data.slice(0, MAX_RESULTS);
    const lower = query.toLowerCase();
    return data
      .filter(
        (s) =>
          s.name.toLowerCase().includes(lower) ||
          s.family.toLowerCase().includes(lower),
      )
      .slice(0, MAX_RESULTS);
  }, [data, query]);

  // Reset active index when results change (state adjusted during render,
  // not in an effect, so there's no extra cascading render).
  const [prevResults, setPrevResults] = useState(results);
  if (results !== prevResults) {
    setPrevResults(results);
    setActiveIndex(0);
  }

  // Focus input when palette opens.
  useEffect(() => {
    if (!open) return;
    // Small delay so the animation starts before we try to focus.
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [open]);

  // Scroll highlighted row into view.
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const openPalette = useCallback(() => setOpen(true), []);
  // Closing also clears the query and any feedback toast.
  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setFeedback(null);
  }, []);

  // Global keyboard listeners: Cmd+K / Ctrl+K and "/" to open; Escape to close.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (!isInput && e.key === '/')) {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        closePalette();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, openPalette, closePalette]);

  const showFeedback = useCallback((text: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ text, key: Date.now() });
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2000);
  }, []);

  const selectItem = useCallback(
    (spice: SpiceItem) => {
      const wasSelected = selectedSpiceIds.has(spice.id);
      toggleSpice(spice.id);
      setQuery('');
      showFeedback(wasSelected ? `Removed ${spice.name}` : `Added ${spice.name}`);
    },
    [selectedSpiceIds, toggleSpice, showFeedback],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const spice = results[activeIndex];
        if (spice) selectItem(spice);
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        closePalette();
      }
    },
    [results, activeIndex, selectItem, closePalette],
  );

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search spices"
        className={`${inline ? 'relative' : 'absolute right-4 top-4 z-40'} flex h-9 cursor-pointer select-none items-center gap-2 rounded-md bg-board-high px-3 text-small font-medium text-chalk-2 shadow-[inset_0_0_0_1px_rgba(243,239,232,0.14)] transition-[box-shadow,color,background-color] duration-150 hover:bg-[#424950] hover:text-chalk hover:shadow-[inset_0_0_0_1px_rgba(243,239,232,0.28)] md:w-60`}
      >
        <Search size={14} strokeWidth={1.75} aria-hidden />
        <span className="max-sm:sr-only">Find a spice</span>
        <kbd className="ml-auto hidden rounded border border-rule px-1.5 py-0.5 text-micro leading-none text-chalk-3 md:inline">⌘K</kbd>
      </button>

      {/* Command palette overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-board-deep/60"
              onClick={closePalette}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed left-1/2 top-[72px] z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="overflow-hidden rounded-lg border border-rule-strong bg-board-raised shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                {/* Input row */}
                <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
                  <Search size={16} strokeWidth={1.75} className="shrink-0 text-chalk-3" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Cumin, saffron, sumac…"
                    className="flex-1 bg-transparent text-lead text-chalk placeholder:text-chalk-3 outline-none"
                    aria-label="Search spices"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="text-small text-chalk-3 transition-colors hover:text-chalk"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Feedback banner */}
                <AnimatePresence mode="wait">
                  {feedback && (
                    <motion.div
                      key={feedback.key}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="border-b border-rule bg-board-high px-4 py-1.5 text-small text-chalk">
                        {feedback.text}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Results list */}
                <ul
                  ref={listRef}
                  className="max-h-[320px] overflow-y-auto py-1"
                  role="listbox"
                  aria-label="Spice results"
                >
                  {results.length === 0 ? (
                    <li className="px-4 py-4 text-center text-body text-chalk-3">
                      No spices match &ldquo;{query}&rdquo;
                    </li>
                  ) : (
                    results.map((spice, i) => {
                      const isActive = i === activeIndex;
                      const isSelected = selectedSpiceIds.has(spice.id);
                      const color = spiceColor(spice.id, spice.name, spice.family);
                      return (
                        <li
                          key={spice.id}
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => selectItem(spice)}
                          className={[
                            'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-75',
                            isActive ? 'bg-board-high' : '',
                            'text-chalk',
                          ].join(' ')}
                        >
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-rule-strong"
                            style={{ backgroundColor: color }}
                          />

                          {/* Name */}
                          <span className="flex-1 truncate text-body">
                            {spice.name}
                          </span>

                          <span className="shrink-0 text-small text-chalk-3">
                            {familyLabel(spice.family)}
                          </span>

                          {/* Selected checkmark */}
                          {isSelected && (
                            <span className="shrink-0 text-small text-chalk">Selected</span>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>

                {/* Footer hint */}
                <div className="flex items-center gap-4 border-t border-rule px-4 py-2 text-micro text-chalk-3">
                  <span><kbd>↑↓</kbd> move</span>
                  <span><kbd>Enter</kbd> add or remove</span>
                  <span><kbd>Esc</kbd> close</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
