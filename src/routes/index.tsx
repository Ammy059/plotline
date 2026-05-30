import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Feather,
  Heart,
  Pencil,
  Plus,
  PlusCircle,
  Quote as QuoteIcon,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type Quote = { id: string; text: string; source: string; createdAt: number };
const QUOTES_KEY = "plotline:quotes:v1";
function loadQuotes(): Quote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUOTES_KEY);
    if (!raw) {
      return [
        { id: "q1", text: "We read to know we are not alone.", source: "C.S. Lewis", createdAt: Date.now() - 86400000 },
        { id: "q2", text: "A word after a word after a word is power.", source: "Margaret Atwood", createdAt: Date.now() - 3600000 },
      ];
    }
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Plotline - Living Diary Books" },
      { name: "description", content: "Create public diary books readers can open, experience, and follow chapter by chapter." },
    ],
  }),
});

type Chapter = { title: string; body: string };
type Category = "Journal" | "Travel" | "Memoir" | "Fiction" | "Poetry" | "Notes";
type CollaboratorRole = "Co-writer" | "Editor" | "Reader";
type Collaborator = { id: string; name: string; role: CollaboratorRole; invitedAt: number };
type Book = {
  id: string;
  title: string;
  author: string;
  chapters: Chapter[];
  spine: 1 | 2 | 3 | 4 | 5;
  category: Category;
  collaborators: Collaborator[];
  createdAt: number;
  updatedAt: number;
};

const SPINES = [1, 2, 3, 4, 5] as const;
const CATEGORIES: Category[] = ["Journal", "Travel", "Memoir", "Fiction", "Poetry", "Notes"];
const COLLABORATOR_ROLES: CollaboratorRole[] = ["Co-writer", "Editor", "Reader"];
const STORAGE_KEY = "plotline:v3";
const SHELF_PREFS_KEY = "plotline:shelf-prefs:v1";

type ShelfSort = "newest" | "updated" | "liked";
type ShelfPrefs = { sort: ShelfSort; categoryFilter: Category | "All" };

function loadShelfPrefs(): ShelfPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SHELF_PREFS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ShelfPrefs;
    if (!p || typeof p !== "object") return null;
    return p;
  } catch {
    return null;
  }
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

const SEED: Book[] = [
  {
    id: "seed-1",
    title: "Letters from the Quiet Coast",
    author: "Iris Mendel",
    spine: 1,
    category: "Travel",
    collaborators: [
      { id: "c-seed-1", name: "Mara Vale", role: "Editor", invitedAt: Date.now() - 86400000 },
    ],
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000,
    chapters: [
      { title: "The Lighthouse", body: "The lighthouse kept its slow, patient rhythm long after the village had gone to sleep. I walked the bluff with my coat collar up, listening for the gulls that never came in November.\n\nSomewhere out past the breakwater, a bell answered the wind, and I remembered why I had come back at all.\n\nThe sea has a way of asking the same question every night, and never minding when you forget the answer." },
      { title: "November Gulls", body: "By morning the cliffs were silver with frost. I made coffee on the little stove and watched the harbor wake up.\n\nThe fishermen knew me by my mother's face. They nodded once, the way men do here, and that was enough." },
    ],
  },
  {
    id: "seed-2",
    title: "A Year of Small Mornings",
    author: "Theo Ardent",
    spine: 3,
    category: "Journal",
    collaborators: [],
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000 * 2,
    chapters: [
      { title: "Bitter Coffee", body: "Today the coffee was bitter and the light came in sideways through the kitchen, drawing a long pale rectangle across the floor.\n\nThe cat sat in it the way she always does, as if the sun had been arranged for her. I wrote three sentences and erased two, and decided that was enough." },
    ],
  },
  {
    id: "seed-3",
    title: "Notes Toward a Forest",
    author: "Wren Halloway",
    spine: 5,
    category: "Notes",
    collaborators: [
      { id: "c-seed-2", name: "Elian Moss", role: "Reader", invitedAt: Date.now() - 86400000 * 4 },
    ],
    createdAt: Date.now() - 86400000 * 14,
    updatedAt: Date.now() - 86400000 * 10,
    chapters: [
      { title: "The Forgotten Path", body: "There is a path behind the old paper mill that no map remembers. I followed it until the trees closed overhead and the sound of the road thinned to nothing.\n\nThe moss on the stones was so deep it felt like walking on the back of some sleeping, patient animal." },
    ],
  },
];

function migrateBook(b: Book): Book {
  return {
    ...b,
    category: (b.category as Category) ?? "Journal",
    collaborators: Array.isArray(b.collaborators) ? b.collaborators : [],
    updatedAt: b.updatedAt ?? b.createdAt ?? Date.now(),
  };
}

type Position = { chapterIdx: number; paraIdx: number };
type Persisted = {
  books: Book[];
  liked: Record<string, boolean>;
  positions: Record<string, Position>;
  stored: Record<string, boolean>;
};

function loadState(): Persisted {
  if (typeof window === "undefined") return { books: SEED, liked: {}, positions: {}, stored: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { books: SEED, liked: {}, positions: {}, stored: {} };
    const parsed = JSON.parse(raw) as Persisted;
    if (!Array.isArray(parsed.books)) return { books: SEED, liked: {}, positions: {}, stored: {} };
    return {
      books: parsed.books.map(migrateBook),
      liked: parsed.liked ?? {},
      positions: parsed.positions ?? {},
      stored: parsed.stored ?? {},
    };
  } catch {
    return { books: SEED, liked: {}, positions: {}, stored: {} };
  }
}

function Index() {
  const [hydrated, setHydrated] = useState(false);
  const [books, setBooks] = useState<Book[]>(SEED);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [stored, setStored] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [managing, setManaging] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>("Co-writer");
  const pendingScrollRef = useRef<number | null>(null);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<Category>("Journal");
  const [draftChapters, setDraftChapters] = useState<Chapter[]>([{ title: "Chapter I", body: "" }]);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ShelfSort>(() => loadShelfPrefs()?.sort ?? "updated");
  const [categoryFilter, setCategoryFilter] = useState<Category | "All">(
    () => loadShelfPrefs()?.categoryFilter ?? "All",
  );

  const [progress, setProgress] = useState(0);
  const [currentPara, setCurrentPara] = useState(1);
  const [totalParas, setTotalParas] = useState(0);
  const readerRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const s = loadState();
    setBooks(s.books);
    setLiked(s.liked);
    setPositions(s.positions);
    setStored(s.stored);
    const firstActive = s.books.find((b) => !s.stored[b.id]) ?? s.books[0];
    if (firstActive) {
      setOpenId(firstActive.id);
      const pos = s.positions[firstActive.id];
      if (pos) {
        setChapterIdx(Math.min(pos.chapterIdx, firstActive.chapters.length - 1));
        pendingScrollRef.current = pos.paraIdx;
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ books, liked, positions, stored }));
    } catch {
      // Ignore localStorage quota and privacy-mode failures.
    }
  }, [books, liked, positions, stored, hydrated]);

  useEffect(() => {
    try {
      localStorage.setItem(SHELF_PREFS_KEY, JSON.stringify({ sort, categoryFilter }));
    } catch {
      // Ignore localStorage quota and privacy-mode failures.
    }
  }, [sort, categoryFilter]);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteText, setQuoteText] = useState("");
  const [quoteSource, setQuoteSource] = useState("");
  useEffect(() => { setQuotes(loadQuotes()); }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
    } catch {
      // Ignore localStorage quota and privacy-mode failures.
    }
  }, [quotes, hydrated]);

  const addQuote = () => {
    const t = quoteText.trim();
    if (!t) return;
    setQuotes((qs) => [
      { id: `q-${Date.now()}`, text: t, source: quoteSource.trim() || "Unknown", createdAt: Date.now() },
      ...qs,
    ]);
    setQuoteText("");
    setQuoteSource("");
  };
  const removeQuote = (id: string) => setQuotes((qs) => qs.filter((q) => q.id !== id));

  const openBook = useMemo(() => books.find((b) => b.id === openId) ?? null, [openId, books]);
  const openChapter = openBook?.chapters[chapterIdx] ?? null;

  const prevOpenIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || !openId) return;
    if (prevOpenIdRef.current === openId) return;
    prevOpenIdRef.current = openId;
    const book = books.find((b) => b.id === openId);
    if (!book) return;
    const pos = positions[openId];
    if (pos) {
      setChapterIdx(Math.min(pos.chapterIdx, book.chapters.length - 1));
      pendingScrollRef.current = pos.paraIdx;
    } else {
      setChapterIdx(0);
    }
    setManaging(false);
    setEditingBody(false);
    setInviteName("");
  }, [openId, hydrated, books, positions]);

  useEffect(() => {
    const el = articleRef.current;
    if (!el || !openChapter) return;
    const paras = Array.from(el.querySelectorAll<HTMLParagraphElement>("[data-para]"));
    setTotalParas(paras.length);
    setCurrentPara(paras.length > 0 ? 1 : 0);

    if (pendingScrollRef.current !== null && openId) {
      const idx = Math.min(pendingScrollRef.current, paras.length - 1);
      pendingScrollRef.current = null;
      if (idx > 0 && paras[idx]) {
        requestAnimationFrame(() => {
          paras[idx].scrollIntoView({ behavior: "auto", block: "center" });
        });
      }
    }

    const update = () => {
      const vh = window.innerHeight;
      const start = el.getBoundingClientRect().top;
      const end = el.getBoundingClientRect().bottom;
      const total = end - start;
      const seen = Math.min(Math.max(-start + vh * 0.4, 0), total);
      setProgress(total > 0 ? Math.round((seen / total) * 100) : 0);
      const anchor = vh * 0.35;
      let active = 1;
      for (let i = 0; i < paras.length; i += 1) {
        const r = paras[i].getBoundingClientRect();
        if (r.top <= anchor) active = i + 1;
      }
      setCurrentPara(active);
      if (openId) {
        setPositions((p) => {
          const prev = p[openId];
          const next: Position = { chapterIdx, paraIdx: Math.max(0, active - 1) };
          if (prev && prev.chapterIdx === next.chapterIdx && prev.paraIdx === next.paraIdx) return p;
          return { ...p, [openId]: next };
        });
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [openChapter, openId, chapterIdx]);

  const visibleBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = books.filter((b) => {
      if (stored[b.id]) return false;
      if (categoryFilter !== "All" && b.category !== categoryFilter) return false;
      if (!q) return true;
      return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    });
    if (sort === "newest") list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "updated") list = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
    else list = [...list].sort((a, b) => Number(!!liked[b.id]) - Number(!!liked[a.id]) || b.updatedAt - a.updatedAt);
    return list;
  }, [books, query, sort, liked, categoryFilter, stored]);

  const storedBooks = useMemo(
    () => books.filter((b) => stored[b.id]).sort((a, b) => b.updatedAt - a.updatedAt),
    [books, stored],
  );

  const activeBooks = useMemo(() => books.filter((b) => !stored[b.id]), [books, stored]);
  const collaborativeBooks = useMemo(
    () => activeBooks.filter((b) => b.collaborators.length > 0).sort((a, b) => b.updatedAt - a.updatedAt),
    [activeBooks],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: activeBooks.length };
    for (const c of CATEGORIES) counts[c] = 0;
    for (const b of activeBooks) counts[b.category] = (counts[b.category] ?? 0) + 1;
    return counts;
  }, [activeBooks]);

  const toggleStored = (id: string) => {
    setStored((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
    if (openId === id && !stored[id]) {
      prevOpenIdRef.current = null;
      setOpenId(null);
    }
  };

  const updateDraft = (i: number, patch: Partial<Chapter>) =>
    setDraftChapters((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const handlePublish = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = draftChapters
      .map((c) => ({ title: c.title.trim() || "Untitled Chapter", body: c.body.trim() }))
      .filter((c) => c.body.length > 0);
    if (!title.trim() || !author.trim() || cleaned.length === 0) return;
    const now = Date.now();
    const book: Book = {
      id: `b_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      author: author.trim(),
      chapters: cleaned,
      spine: SPINES[Math.floor(Math.random() * SPINES.length)],
      category,
      collaborators: [],
      createdAt: now,
      updatedAt: now,
    };
    setBooks((b) => [book, ...b]);
    setOpenId(book.id);
    setTitle("");
    setAuthor("");
    setCategory("Journal");
    setDraftChapters([{ title: "Chapter I", body: "" }]);
    setTimeout(() => readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const handleDelete = () => {
    if (!openBook) return;
    if (!confirm("Delete this diary book?")) return;
    const id = openBook.id;
    setBooks((bs) => bs.filter((b) => b.id !== id));
    setLiked((l) => { const { [id]: _drop, ...rest } = l; return rest; });
    setPositions((p) => { const { [id]: _drop, ...rest } = p; return rest; });
    setStored((s) => { const { [id]: _drop, ...rest } = s; return rest; });
    prevOpenIdRef.current = null;
    setOpenId(null);
  };

  const setCategoryOnOpen = (next: Category) => {
    if (!openBook) return;
    setBooks((bs) => bs.map((b) => (b.id === openBook.id ? { ...b, category: next, updatedAt: Date.now() } : b)));
  };

  const addCollaborator = () => {
    if (!openBook) return;
    const name = inviteName.trim();
    if (!name) return;
    const collaborator: Collaborator = {
      id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      role: inviteRole,
      invitedAt: Date.now(),
    };
    setBooks((bs) =>
      bs.map((b) =>
        b.id === openBook.id
          ? { ...b, collaborators: [collaborator, ...b.collaborators], updatedAt: Date.now() }
          : b,
      ),
    );
    setInviteName("");
  };

  const removeCollaborator = (id: string) => {
    if (!openBook) return;
    setBooks((bs) =>
      bs.map((b) =>
        b.id === openBook.id
          ? { ...b, collaborators: b.collaborators.filter((c) => c.id !== id), updatedAt: Date.now() }
          : b,
      ),
    );
  };

  const mutateChapters = (fn: (cs: Chapter[]) => Chapter[]) => {
    if (!openBook) return;
    setBooks((bs) =>
      bs.map((b) => (b.id === openBook.id ? { ...b, chapters: fn(b.chapters), updatedAt: Date.now() } : b)),
    );
  };

  const renameChapter = (i: number, newTitle: string) =>
    mutateChapters((cs) => cs.map((c, idx) => (idx === i ? { ...c, title: newTitle } : c)));

  const updateChapterBody = (i: number, body: string) =>
    mutateChapters((cs) => cs.map((c, idx) => (idx === i ? { ...c, body } : c)));

  const patchPosition = (bookId: string, patch: (p: Position) => Position | null) => {
    setPositions((prev) => {
      const cur = prev[bookId];
      if (!cur) return prev;
      const next = patch(cur);
      if (next === null) {
        const { [bookId]: _drop, ...rest } = prev;
        return rest;
      }
      if (next.chapterIdx === cur.chapterIdx && next.paraIdx === cur.paraIdx) return prev;
      return { ...prev, [bookId]: next };
    });
  };

  const addChapter = () => {
    if (!openBook) return;
    const n = openBook.chapters.length + 1;
    const fresh: Chapter = { title: `Chapter ${n}`, body: "" };
    mutateChapters((cs) => [...cs, fresh]);
    setChapterIdx(n - 1);
    setEditingBody(true);
    setManaging(false);
    setTimeout(() => readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const deleteChapter = (i: number) => {
    if (!openBook) return;
    if (openBook.chapters.length <= 1) {
      alert("A book needs at least one chapter. Delete the whole book instead.");
      return;
    }
    if (!confirm(`Delete chapter "${openBook.chapters[i].title}"?`)) return;
    const bookId = openBook.id;
    mutateChapters((cs) => cs.filter((_, idx) => idx !== i));
    setChapterIdx((curr) => {
      if (i < curr) return curr - 1;
      if (i === curr) return Math.max(0, curr - (curr === openBook.chapters.length - 1 ? 1 : 0));
      return curr;
    });
    patchPosition(bookId, (p) => {
      if (i < p.chapterIdx) return { chapterIdx: p.chapterIdx - 1, paraIdx: p.paraIdx };
      if (i === p.chapterIdx) {
        const newIdx = Math.min(p.chapterIdx, openBook.chapters.length - 2);
        return { chapterIdx: Math.max(0, newIdx), paraIdx: 0 };
      }
      return p;
    });
  };

  const moveChapter = (i: number, dir: -1 | 1) => {
    if (!openBook) return;
    const j = i + dir;
    if (j < 0 || j >= openBook.chapters.length) return;
    const bookId = openBook.id;
    mutateChapters((cs) => {
      const next = cs.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setChapterIdx((curr) => {
      if (curr === i) return j;
      if (curr === j) return i;
      return curr;
    });
    patchPosition(bookId, (p) => {
      if (p.chapterIdx === i) return { ...p, chapterIdx: j };
      if (p.chapterIdx === j) return { ...p, chapterIdx: i };
      return p;
    });
  };

  const totalWords = draftChapters.reduce(
    (n, c) => n + c.body.trim().split(/\s+/).filter(Boolean).length,
    0,
  );

  return (
    <div className="mx-auto min-h-screen max-w-[430px] overflow-hidden border-x border-border/60 bg-background pb-24 shadow-page">
      {openBook && (
        <div className="fixed inset-x-0 top-0 z-40 h-1 bg-border/40">
          <div
            className="h-full bg-gradient-to-r from-gilt to-primary transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-border bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-2">
            <Feather className="h-5 w-5 text-primary" />
            <span className="font-display text-2xl font-semibold tracking-tight text-primary md:text-3xl">Plotline</span>
          </div>
          <nav className="hidden gap-8 text-sm text-ink-muted">
            <a href="#write" className="transition-colors hover:text-foreground">Write</a>
            <a href="#shelf" className="transition-colors hover:text-foreground">The Shelf</a>
            <a href="#quotes" className="transition-colors hover:text-foreground">Quotes</a>
            <a href="#collaboration" className="transition-colors hover:text-foreground">Collaborate</a>
            <a href="#reader" className="transition-colors hover:text-foreground">Reading Room</a>
          </nav>
          <a href="#write" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 md:px-4">
            <Plus className="h-4 w-4" /> New Book
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 pt-12 pb-10 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-paper/60 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-ink-muted">
          <Sparkles className="h-3 w-3 text-gilt" /> Living Public Diaries
        </div>
        <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-foreground">
          A library of <em className="text-primary">unfolding</em> lives.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-muted">
          Plotline is where ordinary days are bound into beautiful little books.
          Write chapter by chapter, place them on the shelf, and let readers wander in.
        </p>
      </section>

      <section id="write" className="mx-auto max-w-3xl px-4 pb-16">
        <form
          onSubmit={handlePublish}
          className="relative overflow-hidden rounded-2xl border border-border bg-paper p-5 shadow-page"
        >
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-gilt/70 via-primary/40 to-transparent" />
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-3xl text-foreground">Begin a new book</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-ink-muted">
              {draftChapters.length} chapter{draftChapters.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
              className="w-full rounded-xl border border-border bg-card/60 px-4 py-3 font-display text-2xl text-foreground placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author"
              className="w-full rounded-xl border border-border bg-card/60 px-4 py-3 text-foreground placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-ink-muted">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/60 text-ink-muted hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {draftChapters.map((ch, i) => (
              <div key={i} className="rounded-xl border border-border bg-card/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-ink-muted">Ch. {i + 1}</span>
                  <input
                    value={ch.title}
                    onChange={(e) => updateDraft(i, { title: e.target.value })}
                    placeholder="Chapter title"
                    className="flex-1 rounded-md border border-border bg-paper/60 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {draftChapters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDraftChapters((cs) => cs.filter((_, idx) => idx !== i))}
                      className="rounded-md p-1.5 text-ink-muted hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove chapter"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <textarea
                  value={ch.body}
                  onChange={(e) => updateDraft(i, { body: e.target.value })}
                  placeholder="The first sentence is always the hardest..."
                  className="min-h-[160px] w-full resize-none rounded-md border border-border bg-paper/60 px-4 py-3 leading-loose text-foreground placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDraftChapters((cs) => [...cs, { title: `Chapter ${cs.length + 1}`, body: "" }])}
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-border bg-card/40 px-4 py-2 text-sm text-ink-muted hover:bg-accent hover:text-foreground"
            >
              <PlusCircle className="h-4 w-4" /> Add chapter
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-ink-muted">
              {totalWords} words across {draftChapters.length} chapter{draftChapters.length === 1 ? "" : "s"}
            </p>
            <button
              type="submit"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-primary-foreground shadow-book transition-transform hover:-translate-y-0.5"
            >
              <BookOpen className="h-4 w-4" /> Publish to the shelf
            </button>
          </div>
        </form>
      </section>

      <section id="shelf" className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-4xl text-foreground">The Shelf</h2>
            <p className="mt-2 text-ink-muted">
              {visibleBooks.length} active - {storedBooks.length} stored
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-3">
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or author"
                className="w-full rounded-full border border-border bg-paper px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:bg-accent"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="inline-flex rounded-full border border-border bg-paper p-1 text-xs">
              {(["updated", "newest", "liked"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={`rounded-full px-3 py-1.5 uppercase tracking-[0.18em] transition-colors ${
                    sort === k ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-foreground"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {(["All", ...CATEGORIES] as const).map((c) => {
            const active = categoryFilter === c;
            const count = categoryCounts[c] ?? 0;
            return (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card/60 text-ink-muted hover:text-foreground"
                }`}
              >
                {c}
                <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-border/60"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {visibleBooks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-paper/50 p-16 text-center text-ink-muted">
            {books.length === 0 ? "The shelf is empty. Write the first chapter above." : "No books match your search."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {visibleBooks.map((book) => (
              <button
                key={book.id}
                onClick={() => {
                  setOpenId(book.id);
                  setTimeout(() => readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
                }}
                className={`book-card group relative h-[245px] overflow-hidden rounded-l-sm rounded-r-md p-4 text-left text-paper shadow-book transition-all duration-300 hover:-translate-y-2 hover:shadow-page ${
                  openId === book.id ? "ring-2 ring-gilt ring-offset-4 ring-offset-background" : ""
                }`}
                style={{ background: `var(--color-spine-${book.spine})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/20" />
                {liked[book.id] && (
                  <Heart className="absolute right-3 top-3 h-4 w-4 fill-paper text-paper drop-shadow" />
                )}
                {book.collaborators.length > 0 && (
                  <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-paper/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-paper backdrop-blur">
                    <Users className="h-3 w-3" />
                    {book.collaborators.length}
                  </span>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Move to storage"
                  title="Move to storage"
                  onClick={(e) => { e.stopPropagation(); toggleStored(book.id); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleStored(book.id);
                    }
                  }}
                  className="absolute bottom-3 right-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-paper/15 text-paper opacity-0 backdrop-blur transition hover:bg-paper/30 group-hover:opacity-100 focus:opacity-100"
                >
                  <Archive className="h-3.5 w-3.5" />
                </span>
                <div className="relative flex h-full flex-col justify-between">
                  <div className="pl-4">
                    <div className="mb-3 h-px w-8 bg-paper/60" />
                    <p className="mb-2 inline-block rounded-full bg-paper/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] backdrop-blur">
                      {book.category}
                    </p>
                    <h3 className="font-display text-2xl leading-tight">{book.title}</h3>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.2em] opacity-70">
                      {book.chapters.length} ch. - upd. {relativeTime(book.updatedAt)}
                    </p>
                  </div>
                  <div className="pl-4">
                    <p className="text-xs uppercase tracking-[0.2em] opacity-70">by</p>
                    <p className="font-display text-lg">{book.author}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div
          className="relative mt-10 overflow-hidden rounded-2xl border border-gilt/30 p-6 shadow-page md:p-8"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--color-spine-2) 35%, hsl(var(--paper))) 0%, color-mix(in oklab, var(--color-spine-1) 25%, hsl(var(--paper))) 100%)",
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-black/25 to-transparent" />
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="mb-1 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gilt">
                <Archive className="h-3 w-3" /> Shelf Archive
              </p>
              <h2 className="font-display text-3xl text-foreground md:text-4xl">Stored Books</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Books moved off the main shelf stay here. Restore any time.
              </p>
            </div>
            <p className="shrink-0 text-xs uppercase tracking-[0.2em] text-ink-muted">
              {storedBooks.length} stored
            </p>
          </div>

          {storedBooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gilt/40 bg-paper/50 px-6 py-10 text-center text-sm text-ink-muted">
              The chest is empty. Hover any book on the shelf and tap the archive icon to store it.
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2 rounded-xl bg-black/10 p-4">
              {storedBooks.map((book) => (
                <div key={book.id} className="group relative">
                  <button
                    onClick={() => {
                      setStored((s) => { const { [book.id]: _d, ...rest } = s; return rest; });
                      setOpenId(book.id);
                      setTimeout(() => readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
                    }}
                    title={`${book.title} - restore & open`}
                    className="relative flex h-32 w-9 flex-col items-center justify-between rounded-sm px-1 py-2 text-paper shadow-book transition-all hover:-translate-y-1 hover:shadow-page"
                    style={{ background: `var(--color-spine-${book.spine})` }}
                  >
                    <div className="absolute inset-0 rounded-sm bg-gradient-to-b from-white/10 to-black/30" />
                    <span className="relative h-px w-4 bg-paper/60" />
                    <span
                      className="relative whitespace-nowrap font-display text-[10px] uppercase tracking-[0.2em] opacity-90"
                      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                    >
                      {book.title}
                    </span>
                    <span className="relative h-px w-4 bg-paper/60" />
                  </button>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Restore to shelf"
                    title="Restore to shelf"
                    onClick={(e) => { e.stopPropagation(); toggleStored(book.id); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleStored(book.id);
                      }
                    }}
                    className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gilt/40 bg-paper text-foreground opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100"
                  >
                    <ArchiveRestore className="h-3 w-3" />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Delete permanently"
                    title="Delete permanently"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirm(`Permanently delete "${book.title}"? This cannot be undone.`)) return;
                      setBooks((bs) => bs.filter((b) => b.id !== book.id));
                      setLiked((l) => { const { [book.id]: _drop, ...rest } = l; return rest; });
                      setPositions((p) => { const { [book.id]: _drop, ...rest } = p; return rest; });
                      setStored((s) => { const { [book.id]: _drop, ...rest } = s; return rest; });
                      if (openId === book.id) {
                        prevOpenIdRef.current = null;
                        setOpenId(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!confirm(`Permanently delete "${book.title}"? This cannot be undone.`)) return;
                        setBooks((bs) => bs.filter((b) => b.id !== book.id));
                        setLiked((l) => { const { [book.id]: _drop, ...rest } = l; return rest; });
                        setPositions((p) => { const { [book.id]: _drop, ...rest } = p; return rest; });
                        setStored((s) => { const { [book.id]: _drop, ...rest } = s; return rest; });
                        if (openId === book.id) {
                          prevOpenIdRef.current = null;
                          setOpenId(null);
                        }
                      }
                    }}
                    className="absolute -bottom-2 -right-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gilt/40 bg-paper text-foreground opacity-0 shadow-sm transition hover:border-destructive/40 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="quotes" className="mx-auto max-w-3xl px-4 pb-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gilt">
              <QuoteIcon className="h-3 w-3" /> Marginalia
            </p>
            <h2 className="font-display text-3xl text-foreground">Quotes Feed</h2>
            <p className="mt-1 text-sm text-ink-muted">Lines worth keeping - yours and others'.</p>
          </div>
          <p className="shrink-0 text-xs uppercase tracking-[0.2em] text-ink-muted">{quotes.length} saved</p>
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-paper p-5 shadow-page">
          <textarea
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
            placeholder="A line that struck you..."
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 font-serif text-base text-foreground placeholder:text-ink-muted/60 focus:outline-none focus:ring-1 focus:ring-gilt/50"
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={quoteSource}
              onChange={(e) => setQuoteSource(e.target.value)}
              placeholder="- Source (author, book, you...)"
              className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-ink-muted/60 focus:outline-none focus:ring-1 focus:ring-gilt/50"
            />
            <button
              type="button"
              onClick={addQuote}
              disabled={!quoteText.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <Plus className="h-4 w-4" /> Save quote
            </button>
          </div>
        </div>

        {quotes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gilt/40 bg-paper/50 px-6 py-10 text-center text-sm text-ink-muted">
            No quotes yet. Add one above to start your feed.
          </div>
        ) : (
          <ul className="space-y-4">
            {quotes.map((q) => (
              <li
                key={q.id}
                className="group relative rounded-xl border border-border bg-paper p-5 shadow-sm transition-shadow hover:shadow-page"
              >
                <QuoteIcon className="absolute left-4 top-4 h-5 w-5 text-gilt/50" />
                <blockquote className="pl-8 font-serif text-lg leading-relaxed text-foreground">
                  {q.text}
                </blockquote>
                <div className="mt-3 flex items-center justify-between pl-8">
                  <cite className="text-xs uppercase tracking-[0.2em] not-italic text-ink-muted">
                    - {q.source}
                  </cite>
                  <button
                    type="button"
                    onClick={() => removeQuote(q.id)}
                    aria-label="Delete quote"
                    className="rounded-full p-1.5 text-ink-muted opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="collaboration" className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gilt">
              <Users className="h-3 w-3" /> Collaboration
            </p>
            <h2 className="font-display text-3xl text-foreground">Shared Writing Rooms</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Invite co-writers, editors, or quiet readers to a book from the Reading Room.
            </p>
          </div>
          <p className="shrink-0 text-xs uppercase tracking-[0.2em] text-ink-muted">
            {collaborativeBooks.length} active
          </p>
        </div>

        {collaborativeBooks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-paper/50 px-6 py-12 text-center text-sm text-ink-muted">
            No collaborators yet. Open a book below and send the first invite.
          </div>
        ) : (
          <div className="grid gap-4">
            {collaborativeBooks.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => {
                  setOpenId(book.id);
                  setTimeout(() => readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
                }}
                className="rounded-xl border border-border bg-paper p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-page"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-gilt">{book.category}</p>
                    <h3 className="mt-1 font-display text-2xl text-foreground">{book.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">by {book.author}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-ink-muted">
                    <Users className="h-3.5 w-3.5" />
                    {book.collaborators.length}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {book.collaborators.map((person) => (
                    <span
                      key={person.id}
                      className="rounded-full bg-accent px-3 py-1 text-xs text-foreground"
                    >
                      {person.name} - {person.role}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section id="reader" ref={readerRef} className="mx-auto max-w-4xl px-4 pb-24">
        {openBook && openChapter ? (
          <article ref={articleRef} className="relative overflow-hidden rounded-2xl border border-border bg-paper p-5 shadow-page">
            <header className="mb-8 border-b border-border/60 pb-8">
              <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gilt">
                Chapter {chapterIdx + 1} of {openBook.chapters.length} - Now Reading
              </p>
              <h2 className="font-display text-4xl leading-tight text-foreground">{openBook.title}</h2>
              <p className="mt-3 text-ink-muted">
                by <span className="text-foreground">{openBook.author}</span>{" - "}
                Started {new Date(openBook.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                {" - "}
                <span className="text-foreground">Updated {relativeTime(openBook.updatedAt)}</span>
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.25em] text-ink-muted">Category</span>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryOnOpen(c)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                      openBook.category === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card/60 text-ink-muted hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {openBook.chapters.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setChapterIdx(i)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      i === chapterIdx
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card/60 text-ink-muted hover:text-foreground"
                    }`}
                  >
                    {i + 1}. {c.title}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={addChapter}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-card/40 px-3 py-1 text-xs text-ink-muted transition-colors hover:border-primary hover:text-primary"
                  aria-label="Add new chapter"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  New chapter
                </button>
                <button
                  type="button"
                  onClick={() => setManaging((m) => !m)}
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                    managing
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/60 text-ink-muted hover:text-foreground"
                  }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {managing ? "Done" : "Manage chapters"}
                </button>
              </div>

              {managing && (
                <ChapterManager
                  chapters={openBook.chapters}
                  currentIdx={chapterIdx}
                  onRename={renameChapter}
                  onDelete={deleteChapter}
                  onMove={moveChapter}
                  onJump={(i) => setChapterIdx(i)}
                  updatedAt={openBook.updatedAt}
                />
              )}
            </header>

            <div className="mb-6 flex items-center gap-3">
              <h3 className="flex-1 font-display text-3xl text-foreground">{openChapter.title}</h3>
              <button
                type="button"
                onClick={() => setEditingBody((e) => !e)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                  editingBody
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card/60 text-ink-muted hover:text-foreground"
                }`}
              >
                <Pencil className="h-3.5 w-3.5" />
                {editingBody ? "Done writing" : "Edit"}
              </button>
            </div>

            {editingBody ? (
              <textarea
                autoFocus
                value={openChapter.body}
                onChange={(e) => updateChapterBody(chapterIdx, e.target.value)}
                placeholder="Begin writing this chapter... Use a blank line to start a new paragraph."
                className="min-h-[420px] w-full resize-y rounded-xl border border-border bg-paper/80 p-5 font-serif-body text-lg leading-[2] text-foreground shadow-inner focus:outline-none focus:ring-2 focus:ring-ring md:text-xl"
              />
            ) : openChapter.body.trim() ? (
              <div className="font-serif-body text-lg leading-[2] text-foreground">
                {openChapter.body.split(/\n\s*\n/).map((p, i) => (
                  <p
                    key={i}
                    data-para
                    className={i === 0 ? "drop-cap mb-6" : "mb-6"}
                  >
                    {p}
                  </p>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-paper/40 p-10 text-center text-ink-muted">
                This chapter is blank. Tap <span className="text-foreground">Edit</span> to start writing.
              </div>
            )}

            <div className="mt-10 flex items-center justify-between gap-3 border-t border-border/60 pt-6">
              <button
                type="button"
                onClick={() => setChapterIdx((i) => Math.max(0, i - 1))}
                disabled={chapterIdx === 0}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-xs uppercase tracking-[0.2em] text-ink-muted">
                Ch. {chapterIdx + 1} / {openBook.chapters.length}
              </span>
              <button
                type="button"
                onClick={() => setChapterIdx((i) => Math.min(openBook.chapters.length - 1, i + 1))}
                disabled={chapterIdx === openBook.chapters.length - 1}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <section className="mt-8 rounded-xl border border-border bg-card/40 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-1 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-gilt">
                    <Users className="h-3 w-3" /> Collaboration
                  </p>
                  <h3 className="font-display text-2xl text-foreground">Invite to this book</h3>
                </div>
                <span className="rounded-full border border-border bg-paper px-3 py-1 text-xs text-ink-muted">
                  {openBook.collaborators.length} collaborator{openBook.collaborators.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-3">
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Collaborator name or email"
                  className="min-w-0 rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="inline-flex rounded-lg border border-border bg-paper p-1 text-xs">
                  {COLLABORATOR_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setInviteRole(role)}
                      className={`rounded-md px-2.5 py-1.5 transition-colors ${
                        inviteRole === role ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-foreground"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addCollaborator}
                  disabled={!inviteName.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <UserPlus className="h-4 w-4" />
                  Invite
                </button>
              </div>

              {openBook.collaborators.length > 0 && (
                <ul className="mt-4 grid gap-2">
                  {openBook.collaborators.map((person) => (
                    <li
                      key={person.id}
                      className="flex items-center gap-3 rounded-lg border border-border/70 bg-paper/70 px-3 py-2"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold uppercase text-primary-foreground">
                        {person.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{person.name}</p>
                        <p className="text-xs text-ink-muted">
                          {person.role} - invited {relativeTime(person.invitedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCollaborator(person.id)}
                        aria-label={`Remove ${person.name}`}
                        className="rounded-md p-1.5 text-ink-muted hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <footer className="mt-8 flex flex-wrap items-center gap-3 border-t border-border/60 pt-8">
              <button
                type="button"
                onClick={() => setLiked((l) => ({ ...l, [openBook.id]: !l[openBook.id] }))}
                className={`inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm transition-colors hover:bg-accent ${
                  liked[openBook.id] ? "text-primary" : "text-foreground"
                }`}
              >
                <Heart className={`h-4 w-4 ${liked[openBook.id] ? "fill-primary" : ""}`} />
                {liked[openBook.id] ? "Loved" : "Love"}
              </button>
              <button type="button" className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm transition-colors hover:bg-accent">
                <Bookmark className="h-4 w-4" /> Save
              </button>
              <button type="button" className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm transition-colors hover:bg-accent">
                <Share2 className="h-4 w-4" /> Share
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/20"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </footer>
          </article>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-paper/50 p-16 text-center text-ink-muted">
            Choose a book from the shelf to begin reading.
          </div>
        )}
      </section>

      {openBook && totalParas > 0 && (
        <div className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-paper/95 px-4 py-2 text-xs shadow-page backdrop-blur">
          <span className="font-semibold text-primary">{progress}%</span>
          <span className="h-3 w-px bg-border" />
          <span className="text-ink-muted">P {currentPara} / {totalParas}</span>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-paper/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-page backdrop-blur-md">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-[10px] font-medium text-ink-muted">
          <a href="#write" className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-accent hover:text-foreground">
            <PlusCircle className="h-5 w-5" />
            Write
          </a>
          <a href="#shelf" className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-accent hover:text-foreground">
            <BookOpen className="h-5 w-5" />
            Shelf
          </a>
          <a href="#quotes" className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-accent hover:text-foreground">
            <QuoteIcon className="h-5 w-5" />
            Quotes
          </a>
          <a href="#collaboration" className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-accent hover:text-foreground">
            <Users className="h-5 w-5" />
            Collab
          </a>
          <a href="#reader" className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-accent hover:text-foreground">
            <Feather className="h-5 w-5" />
            Read
          </a>
        </div>
      </nav>

      <footer className="border-t border-border/60 bg-paper/60 py-10 text-center text-sm text-ink-muted">
        Plotline - Living Public Diaries - Bound by hand, page by page
      </footer>
    </div>
  );
}

function ChapterManager({
  chapters, currentIdx, onRename, onDelete, onMove, onJump, updatedAt,
}: {
  chapters: Chapter[];
  currentIdx: number;
  onRename: (i: number, title: string) => void;
  onDelete: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onJump: (i: number) => void;
  updatedAt: number;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (i: number) => {
    setEditingIdx(i);
    setDraft(chapters[i].title);
  };
  const commit = () => {
    if (editingIdx === null) return;
    const t = draft.trim();
    if (t) onRename(editingIdx, t);
    setEditingIdx(null);
  };

  return (
    <div className="mt-5 rounded-xl border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          Manage chapters
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          Updated {relativeTime(updatedAt)}
        </p>
      </div>
      <ul className="space-y-1.5">
        {chapters.map((c, i) => (
          <li
            key={i}
            className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
              i === currentIdx ? "border-primary/40 bg-paper" : "border-border/60 bg-paper/60"
            }`}
          >
            <span className="w-6 shrink-0 text-center text-xs text-ink-muted">{i + 1}</span>
            {editingIdx === i ? (
              <>
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setEditingIdx(null);
                  }}
                  className="flex-1 rounded-md border border-border bg-paper px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={commit}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                  aria-label="Save name"
                >
                  <Check className="h-3.5 w-3.5" /> Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingIdx(null)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-xs text-ink-muted hover:text-foreground"
                  aria-label="Cancel rename"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  className="flex-1 truncate text-left hover:text-primary"
                  title="Jump to chapter"
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => onMove(i, -1)}
                  disabled={i === 0}
                  className="rounded-md p-1.5 text-ink-muted hover:bg-accent hover:text-foreground disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(i, 1)}
                  disabled={i === chapters.length - 1}
                  className="rounded-md p-1.5 text-ink-muted hover:bg-accent hover:text-foreground disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  className="rounded-md p-1.5 text-ink-muted hover:bg-accent hover:text-foreground"
                  aria-label="Rename"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(i)}
                  className="rounded-md p-1.5 text-ink-muted hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete chapter"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
