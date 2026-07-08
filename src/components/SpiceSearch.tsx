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
import { FAMILY_COLORS } from '@/lib/colors';
import { useSelection } from '@/context/SelectionContext';

interface SpiceItem {
  id: string;
  name: string;
  family: string;
}

interface SpiceSearchProps {
  data: SpiceItem[];
}

const MAX_RESULTS = 8;

/** Brief feedback message shown after selecting/deselecting. */
interface Feedback {
  text: string;
  key: number;
}

export default function SpiceSearch({ data }: SpiceSearchProps) {
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

  // Reset active index when results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Focus input when palette opens.
  useEffect(() => {
    if (open) {
      // Small delay so the animation starts before we try to focus.
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    } else {
      setQuery('');
      setFeedback(null);
    }
  }, [open]);

  // Scroll highlighted row into view.
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);

  // Global keyboard listeners: Cmd+K / Ctrl+K and "/" to open; Escape to close.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (!isInput && e.key === '/')) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        closePalette();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closePalette]);

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
      showFeedback(wasSelected ? `✓ removed ${spice.name}` : `✓ added ${spice.name}`);
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
      {/* Trigger button — positioned by parent (absolute top-4 right-[360px]) */}
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search spices"
        className="absolute top-4 right-[360px] max-md:right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white/70 text-[12px] hover:bg-black/80 hover:text-white/90 hover:border-white/20 transition-all duration-150 cursor-pointer select-none"
      >
        <Search size={13} strokeWidth={2} />
        <span>Search</span>
        <span className="ml-0.5 px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-[10px] text-white/45 font-mono leading-none">
          ⌘K
        </span>
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
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              onClick={closePalette}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed z-40 top-[72px] left-1/2 -translate-x-1/2 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-xl bg-neutral-950/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden">
                {/* Input row */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
                  <Search size={15} strokeWidth={2} className="text-white/35 shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search spices…"
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
                    aria-label="Search spices"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="text-white/30 hover:text-white/60 text-xs transition-colors"
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
                      <div className="px-4 py-1.5 text-[11px] text-cyan-400/90 bg-cyan-400/6 border-b border-white/5">
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
                    <li className="px-4 py-4 text-sm text-white/30 text-center">
                      No spices match &ldquo;{query}&rdquo;
                    </li>
                  ) : (
                    results.map((spice, i) => {
                      const isActive = i === activeIndex;
                      const isSelected = selectedSpiceIds.has(spice.id);
                      const color =
                        FAMILY_COLORS[spice.family] ?? 'hsl(0, 0%, 50%)';
                      return (
                        <li
                          key={spice.id}
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => selectItem(spice)}
                          className={[
                            'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-75',
                            isActive
                              ? 'bg-white/6'
                              : 'hover:bg-white/4',
                            isSelected ? 'text-cyan-300' : 'text-white/85',
                          ].join(' ')}
                        >
                          {/* Family color dot */}
                          <span
                            className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/20"
                            style={{ backgroundColor: color }}
                          />

                          {/* Name */}
                          <span className="flex-1 text-sm font-medium truncate">
                            {spice.name}
                          </span>

                          {/* Family label */}
                          <span
                            className="text-[10px] font-medium uppercase tracking-wider shrink-0 opacity-60"
                            style={{ color }}
                          >
                            {spice.family}
                          </span>

                          {/* Selected checkmark */}
                          {isSelected && (
                            <span className="text-cyan-400 text-[11px] shrink-0">✓</span>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>

                {/* Footer hint */}
                <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-white/25">
                  <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                  <span><kbd className="font-mono">↵</kbd> select</span>
                  <span><kbd className="font-mono">Esc</kbd> close</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
