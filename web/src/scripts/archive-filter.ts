let cleanupPrevious: (() => void) | undefined;

const FILTER_MOVE_MS = 520;
const FILTER_FADE_MS = 260;

const filterTimers = new Set<number>();

function schedule(callback: () => void, delay: number) {
  const timer = window.setTimeout(() => {
    filterTimers.delete(timer);
    callback();
  }, delay);
  filterTimers.add(timer);
}

function clearTimers() {
  filterTimers.forEach((timer) => window.clearTimeout(timer));
  filterTimers.clear();
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resetCardStyles(card: HTMLElement) {
  card.getAnimations().forEach((animation) => {
    animation.cancel();
  });
  card.classList.remove(
    "post-card--filter-moving",
    "post-card--filter-entering",
    "post-card--filter-leaving",
    "post-card--filter-prep",
  );
  card.style.removeProperty("position");
  card.style.removeProperty("left");
  card.style.removeProperty("top");
  card.style.removeProperty("width");
  card.style.removeProperty("height");
  card.style.removeProperty("margin");
  card.style.removeProperty("z-index");
  card.style.removeProperty("pointer-events");
  card.style.removeProperty("transform");
  card.style.removeProperty("opacity");
}

function setHistory(normalized: string) {
  const path = window.location.pathname;
  if (normalized === "all") {
    history.replaceState(window.history.state, "", path);
  } else {
    const next = new URLSearchParams();
    next.set("series", normalized);
    history.replaceState(window.history.state, "", `${path}?${next.toString()}`);
  }
}

export function initArchiveFilter(root: ParentNode = document) {
  cleanupPrevious?.();
  cleanupPrevious = undefined;

  const bar = root.querySelector<HTMLElement>("[data-archive-filters]");
  if (!bar) return;

  const grid = root.querySelector<HTMLElement>(".post-grid");
  const chips = Array.from(bar.querySelectorAll<HTMLButtonElement>("[data-filter-series]"));
  const cards = Array.from(root.querySelectorAll<HTMLElement>(".post-card[data-series]"));
  const ctrl = new AbortController();
  let hasAppliedOnce = false;
  let animationRun = 0;

  const readSelection = (): string => {
    const q = new URLSearchParams(window.location.search).get("series");
    if (q) {
      const decoded = decodeURIComponent(q).toLowerCase();
      if (chips.some((c) => (c.dataset.filterSeries ?? "").toLowerCase() === decoded)) {
        return decoded;
      }
    }
    const raw = window.location.hash.replace(/^#/, "");
    if (raw) {
      const hp = new URLSearchParams(raw);
      const hs = hp.get("series");
      if (hs) {
        const hd = decodeURIComponent(hs).toLowerCase();
        if (chips.some((c) => (c.dataset.filterSeries ?? "").toLowerCase() === hd)) {
          return hd;
        }
      }
    }
    return "all";
  };

  const applyStatic = (normalized: string) => {
    grid?.classList.toggle("post-grid--filter-active", normalized !== "all");
    grid?.classList.toggle("post-grid--filtering", normalized !== "all");
    cards.forEach((card) => {
      const s = (card.dataset.series ?? "").toLowerCase();
      const match = normalized === "all" || s === normalized;
      resetCardStyles(card);
      card.classList.toggle("is-filtered-out", !match);
      card.hidden = !match;
      card.classList.remove("post-card--spotlit");
    });
  };

  const apply = (slug: string, animate = hasAppliedOnce) => {
    const normalized = slug.toLowerCase();
    const run = ++animationRun;
    clearTimers();

    chips.forEach((chip) => {
      const v = (chip.dataset.filterSeries ?? "all").toLowerCase();
      const on = v === normalized;
      chip.setAttribute("aria-pressed", on ? "true" : "false");
      chip.classList.toggle("is-active", on);
    });

    if (!grid || prefersReducedMotion() || !animate) {
      applyStatic(normalized);
      setHistory(normalized);
      hasAppliedOnce = true;
      return;
    }

    grid.classList.add("post-grid--filtering");

    const matches = new Map(
      cards.map((card) => {
        const s = (card.dataset.series ?? "").toLowerCase();
        return [card, normalized === "all" || s === normalized] as const;
      }),
    );

    cards.forEach((card) => {
      resetCardStyles(card);
      card.classList.remove("post-card--spotlit");
    });

    const staying = cards.filter((card) => !card.hidden && matches.get(card));
    const leaving = cards.filter((card) => !card.hidden && !matches.get(card));
    const entering = cards.filter((card) => card.hidden && matches.get(card));
    const stayingHidden = cards.filter((card) => card.hidden && !matches.get(card));

    if (leaving.length === 0 && entering.length === 0) {
      setHistory(normalized);
      hasAppliedOnce = true;
      return;
    }

    // Phase 1: fade unwanted posts away in their current grid positions.
    leaving.forEach((card) => {
      card.classList.add("post-card--filter-leaving");
      card.style.pointerEvents = "none";
    });

    staying.forEach((card) => {
      card.classList.remove("is-filtered-out");
    });

    void grid.offsetHeight;

    leaving.forEach((card) => {
      card.style.opacity = "0";
      card.style.transform = "translate3d(0, 0.5rem, 0) scale(0.985)";
    });

    schedule(() => {
      if (run !== animationRun) return;

      // Phase 2: remove faded posts from layout, place newly included posts invisibly,
      // then animate the existing matching posts into the centered filtered layout.
      const firstRects = new Map<HTMLElement, DOMRect>();
      staying.forEach((card) => {
        firstRects.set(card, card.getBoundingClientRect());
      });

      leaving.forEach((card) => {
        resetCardStyles(card);
        card.classList.add("is-filtered-out");
        card.hidden = true;
      });

      stayingHidden.forEach((card) => {
        resetCardStyles(card);
        card.classList.add("is-filtered-out");
        card.hidden = true;
      });

      entering.forEach((card) => {
        resetCardStyles(card);
        card.hidden = false;
        card.classList.remove("is-filtered-out");
        card.classList.add("post-card--filter-entering");
        card.style.opacity = "0";
        card.style.transform = "translate3d(0, 0.65rem, 0) scale(0.985)";
      });

      grid.classList.toggle("post-grid--filter-active", normalized !== "all");

      void grid.offsetHeight;

      const lastRects = new Map<HTMLElement, DOMRect>();
      staying.forEach((card) => lastRects.set(card, card.getBoundingClientRect()));

      staying.forEach((card) => {
        const first = firstRects.get(card);
        const last = lastRects.get(card);
        if (!first || !last) return;
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        card.classList.add("post-card--filter-prep");
        card.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });

      void grid.offsetHeight;

      staying.forEach((card) => {
        card.classList.remove("post-card--filter-prep");
        card.classList.add("post-card--filter-moving");
        card.style.transform = "";
      });

      schedule(() => {
        if (run !== animationRun) return;
        entering.forEach((card) => {
          card.style.opacity = "";
          card.style.transform = "";
        });
      }, 120);

      schedule(() => {
        if (run !== animationRun) return;
        [...staying, ...entering].forEach((card) => {
          resetCardStyles(card);
          card.hidden = false;
          card.classList.remove("is-filtered-out");
        });
      }, FILTER_MOVE_MS + 120);
    }, leaving.length > 0 ? FILTER_FADE_MS : 0);

    setHistory(normalized);
    hasAppliedOnce = true;
  };

  const onPop = () => apply(readSelection());

  chips.forEach((chip) => {
    chip.addEventListener(
      "click",
      () => {
        apply((chip.dataset.filterSeries ?? "all").toLowerCase(), true);
      },
      { signal: ctrl.signal }
    );
  });

  window.addEventListener("popstate", onPop, { signal: ctrl.signal });

  apply(readSelection());

  cleanupPrevious = () => {
    clearTimers();
    cards.forEach(resetCardStyles);
    ctrl.abort();
    cleanupPrevious = undefined;
  };
}
