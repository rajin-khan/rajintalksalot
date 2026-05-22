let cleanupPrevious: (() => void) | undefined;

const SPOTLIT_CLASS = "post-card--spotlit";

function pickTitleSide(el: HTMLElement): "right" | "left" | "top" | "bottom" {
  if (typeof window !== "undefined" && window.innerWidth <= 640) {
    return "bottom";
  }
  const r = el.getBoundingClientRect();
  const pad = 24;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceRight = vw - r.right - pad;
  const spaceLeft = r.left - pad;
  const spaceBelow = vh - r.bottom - pad;
  const spaceAbove = r.top - pad;
  const minSide = 260;
  const minVert = 100;

  const horizOk = spaceRight >= minSide || spaceLeft >= minSide;
  if (horizOk) {
    if (spaceRight >= spaceLeft - 16) return "right";
    return "left";
  }
  if (spaceBelow >= minVert && spaceBelow >= spaceAbove - 16) return "bottom";
  return "top";
}

function twoStepSpotlightEnabled(): boolean {
  return (
    window.matchMedia("(hover: none)").matches &&
    window.matchMedia("(max-width: 640px)").matches
  );
}

export function initArchiveSpotlight(root: ParentNode = document) {
  cleanupPrevious?.();
  cleanupPrevious = undefined;

  const cards = root.querySelectorAll<HTMLElement>(".post-card[data-series]");
  if (!cards.length) return;

  const ctrl = new AbortController();
  const { signal } = ctrl;

  const setSide = (card: HTMLElement) => {
    card.dataset.spotlightTitleSide = pickTitleSide(card);
  };

  const clearAllSpotlit = () => {
    for (const c of cards) {
      c.classList.remove(SPOTLIT_CLASS);
    }
  };

  for (const card of cards) {
    card.addEventListener("mouseenter", () => setSide(card), { signal });
    card.addEventListener("focusin", () => setSide(card), { signal });
  }

  const onResize = () => {
    for (const card of cards) {
      if (card.matches(":hover") || card.contains(document.activeElement)) {
        setSide(card);
      }
    }
  };
  window.addEventListener("resize", onResize, { signal });

  const onExitTwoStepMode = () => {
    if (!twoStepSpotlightEnabled()) {
      clearAllSpotlit();
    }
  };

  const mqHoverNone = window.matchMedia("(hover: none)");
  const mqNarrow = window.matchMedia("(max-width: 640px)");
  mqHoverNone.addEventListener("change", onExitTwoStepMode, { signal });
  mqNarrow.addEventListener("change", onExitTwoStepMode, { signal });
  window.addEventListener("resize", onExitTwoStepMode, { signal });

  const onSpotlitCardClick = (e: MouseEvent) => {
    if (!twoStepSpotlightEnabled()) return;
    const card = e.currentTarget as HTMLElement;
    if (card.classList.contains(SPOTLIT_CLASS)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    for (const c of cards) {
      if (c !== card) c.classList.remove(SPOTLIT_CLASS);
    }
    card.classList.add(SPOTLIT_CLASS);
    setSide(card);
  };

  for (const card of cards) {
    card.addEventListener("click", onSpotlitCardClick, { capture: true, signal });
  }

  const onDocumentPointerDown = (e: PointerEvent) => {
    if (!twoStepSpotlightEnabled()) return;
    const t = e.target;
    if (!t || !(t instanceof Element)) return;
    if (t.closest(".post-card")) return;
    clearAllSpotlit();
  };
  document.addEventListener("pointerdown", onDocumentPointerDown, { capture: true, signal });

  const onEscape = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (!twoStepSpotlightEnabled()) return;
    clearAllSpotlit();
  };
  document.addEventListener("keydown", onEscape, { signal });

  cleanupPrevious = () => {
    ctrl.abort();
    cleanupPrevious = undefined;
  };
}
