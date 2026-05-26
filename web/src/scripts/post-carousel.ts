import { squareImageSize } from "../lib/media";

/** Serialized per slide for hydrating / updating stacked pictures client-side */
export type PostStackSlidePayload = {
  avif: string;
  webpSrcset: string;
  fallback: string;
};

type StackBootstrap = {
  media: PostStackSlidePayload[];
  meta: { series: string; title: string };
};

type StackPosition = "a" | "b" | "c" | "peel";

let cleanupPrevious: (() => void) | undefined;

function readBootstrap(): StackBootstrap | null {
  const el = document.getElementById("post-stack-bootstrap");
  const raw = el?.textContent?.trim();
  if (!raw) return null;
  try {
    const val = JSON.parse(raw) as StackBootstrap;
    if (!Array.isArray(val.media)) return null;
    return val;
  } catch {
    return null;
  }
}

function fillPicture(
  picture: HTMLPictureElement,
  slide: PostStackSlidePayload | undefined,
  alt: string,
  loading: "eager" | "lazy",
  fetchpriority: "high" | "auto",
) {
  picture.replaceChildren();
  if (!slide) return;

  const sAvif = document.createElement("source");
  sAvif.srcSet = slide.avif;
  sAvif.type = "image/avif";

  const sWebp = document.createElement("source");
  sWebp.srcSet = slide.webpSrcset;
  sWebp.type = "image/webp";
  sWebp.setAttribute("sizes", "(min-width: 980px) 56vw, 94vw");

  const img = document.createElement("img");
  img.src = slide.fallback;
  img.width = squareImageSize;
  img.height = squareImageSize;
  img.alt = alt;
  img.loading = loading;
  img.decoding = "async";
  img.fetchPriority = fetchpriority;

  picture.append(sAvif, sWebp, img);
}

function setDecorativeSlot(slot: HTMLElement | null, slide: PostStackSlidePayload | undefined) {
  if (!slot) return;
  let picture = slot.querySelector<HTMLPictureElement>("picture");

  if (!slide) {
    slot.hidden = true;
    picture?.replaceChildren();
    return;
  }

  if (!picture) {
    picture = document.createElement("picture");
    slot.appendChild(picture);
  }

  slot.hidden = false;
  fillPicture(picture, slide, "", "lazy", "auto");
}

function syncLayers(
  index: number,
  media: PostStackSlidePayload[],
  meta: { series: string; title: string },
  stackRoot: HTMLElement,
) {
  const n = media.length;
  const farSlot = stackRoot.querySelector<HTMLElement>('[data-stack-slot="far"]');
  const nearSlot = stackRoot.querySelector<HTMLElement>('[data-stack-slot="near"]');
  const frontPicture = stackRoot.querySelector<HTMLPictureElement>("picture.post-card-media__front");

  if (!frontPicture || n <= 0) return;

  const altFront = `${meta.series}: ${meta.title}, slide ${index + 1} of ${n}`;

  fillPicture(
    frontPicture,
    media[index],
    altFront,
    index === 0 ? "eager" : "lazy",
    index === 0 ? "high" : "auto",
  );

  setDecorativeSlot(farSlot, index + 2 < n ? media[index + 2] : undefined);
  setDecorativeSlot(nearSlot, index + 1 < n ? media[index + 1] : undefined);
}

const frontTransitionClasses = [
  "post-card-media__front--peel-forward",
  "post-card-media__front--demote-back",
];

const frontStateClasses = [
  ...frontTransitionClasses,
  "post-card-media__front--syncing",
];

const stackStateClasses = [
  "slide-hero-stack--transitioning",
  "slide-hero-stack--syncing",
  "slide-hero-stack--stage-primed",
  "slide-hero-stack--stage-decoded",
  "slide-hero-stack--intro-live",
  "slide-hero-stack--staged",
];

const transientSelectors = [
  ".post-card-media__transition-underlay",
  ".post-card-media__transition-front",
  ".post-card-media__transition-stage",
  ".post-card-media__live-stage",
];

const removeTransientPictures = (el: HTMLElement) => {
  el.querySelectorAll(transientSelectors.join(",")).forEach((node) => node.remove());
};

const stripDeckClasses = (el: HTMLElement) => {
  const frontPicture = el.querySelector<HTMLPictureElement>("picture.post-card-media__front");
  frontPicture?.classList.remove(...frontStateClasses);
  el.classList.remove(...stackStateClasses);
  removeTransientPictures(el);
};

function readInitialIndex(length: number) {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = Number.parseInt(params.get("slide") ?? "", 10);
  const fromHash = Number.parseInt(window.location.hash.replace(/^#slide-/, ""), 10);
  const raw = Number.isFinite(fromQuery) ? fromQuery : fromHash;
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(length - 1, raw - 1));
}

function writeSlideUrl(index: number) {
  const url = new URL(window.location.href);
  if (index === 0) {
    url.searchParams.delete("slide");
  } else {
    url.searchParams.set("slide", String(index + 1));
  }
  url.hash = "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function shouldIgnoreNavigationEvent(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".caption-panel"));
}

function createStageCard(
  slide: PostStackSlidePayload | undefined,
  index: number,
  position: StackPosition,
  hidden: boolean,
) {
  if (!slide) return null;
  const picture = document.createElement("picture");
  picture.className = "post-card-media__stage-card";
  picture.setAttribute("aria-hidden", "true");
  picture.dataset.slideIndex = String(index);
  fillPicture(picture, slide, "", "eager", "auto");
  setStageCardTarget(picture, position, hidden);
  return picture;
}

function setStageCardTarget(
  card: HTMLPictureElement | null,
  position: StackPosition,
  hidden = false,
  keepVisibleWhileHidden = false,
) {
  if (!card) return;
  card.dataset.stackPos = position;
  card.toggleAttribute("data-stack-hidden", hidden);

  const opacity = hidden || position === "peel" ? "0" : "1";
  const transform = position === "peel"
    ? "scale(1.035) translate3d(0, -3.2rem, 0) rotate(2deg)"
    : position === "a"
      ? "none"
      : position === "b"
        ? "translate(calc(cos(var(--stack-dir)) * var(--stack-step) * 1.3), calc(sin(var(--stack-dir)) * var(--stack-step) * 1.3)) rotate(calc(1.85deg + var(--stack-tilt, 0deg)))"
        : "translate(calc(cos(var(--stack-dir)) * var(--stack-step) * 2.45), calc(sin(var(--stack-dir)) * var(--stack-step) * 2.45)) rotate(calc(-2.1deg + var(--stack-tilt, 0deg)))";

  card.style.setProperty("opacity", opacity, "important");
  card.style.setProperty("transform", transform, "important");
  card.style.setProperty(
    "visibility",
    hidden && !keepVisibleWhileHidden ? "hidden" : "visible",
    "important",
  );

  const zIndex = position === "peel"
    ? 6
    : position === "a"
      ? 5
      : position === "b"
        ? 4
        : hidden
          ? 2
          : 3;
  card.style.zIndex = String(zIndex);
}

function getLiveStage(stackRoot: HTMLElement, media: PostStackSlidePayload[]) {
  let stage = stackRoot.querySelector<HTMLElement>(".post-card-media__live-stage");
  if (!stage) {
    stage = document.createElement("span");
    stage.className = "post-card-media__live-stage";
    stage.setAttribute("aria-hidden", "true");
    media.forEach((slide, index) => {
      const card = createStageCard(slide, index, "c", true);
      if (card) stage.appendChild(card);
    });
    stackRoot.appendChild(stage);
  }
  return stage;
}

function getPostCarouselParts(root: ParentNode = document) {
  const shell = root.querySelector<HTMLElement>("[data-carousel]");
  const stackRoot =
    shell?.querySelector<HTMLElement>("[data-post-stack]") ??
    shell?.querySelector<HTMLElement>("[data-slide-hero-stack]");
  const bootstrap = readBootstrap();

  if (!shell || !stackRoot || !bootstrap?.media.length) return null;

  return { shell, stackRoot, bootstrap };
}

function decodeStageImages(stage: HTMLElement) {
  const images = Array.from(stage.querySelectorAll<HTMLImageElement>("img"));
  return Promise.allSettled(
    images.slice(0, 3).map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return typeof img.decode === "function"
        ? img.decode().catch(() => undefined)
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          });
    }),
  );
}

export function primePostCarouselStage(root: ParentNode = document) {
  const parts = getPostCarouselParts(root);
  if (!parts) return;

  const { shell, stackRoot, bootstrap } = parts;
  const liveStage = getLiveStage(stackRoot, bootstrap.media);
  setLiveStageIndex(liveStage, readInitialIndex(bootstrap.media.length));
  stackRoot.classList.add("slide-hero-stack--stage-primed");

  if (shell.classList.contains("post-shell--entry-pending")) {
    stackRoot.classList.add("slide-hero-stack--intro-live");
    liveStage
      .querySelectorAll<HTMLPictureElement>(".post-card-media__stage-card")
      .forEach((card) => {
        card.style.setProperty("opacity", "0", "important");
      });
  }

  void decodeStageImages(liveStage).then(() => {
    stackRoot.classList.add("slide-hero-stack--stage-decoded");
  });
}

function setLiveStageIndex(
  stage: HTMLElement,
  index: number,
) {
  const cards = Array.from(stage.querySelectorAll<HTMLPictureElement>(".post-card-media__stage-card"));

  cards.forEach((card) => {
    const slideIndex = Number.parseInt(card.dataset.slideIndex ?? "", 10);
    if (slideIndex === index) {
      setStageCardTarget(card, "a");
      return;
    }
    if (slideIndex === index + 1) {
      setStageCardTarget(card, "b");
      return;
    }
    if (slideIndex === index + 2) {
      setStageCardTarget(card, "c");
      return;
    }
    setStageCardTarget(card, "c", true);
  });
}

function setLiveStageTransitionName(
  stage: HTMLElement,
  index: number,
  transitionName: string,
) {
  const cards = Array.from(stage.querySelectorAll<HTMLPictureElement>(".post-card-media__stage-card"));
  cards.forEach((card) => {
    const slideIndex = Number.parseInt(card.dataset.slideIndex ?? "", 10);
    card.style.viewTransitionName = slideIndex === index ? transitionName : "none";
  });
}

function primeStageForMove(
  stage: HTMLElement,
  prev: number,
  next: number,
  direction: "forward" | "back",
) {
  setLiveStageIndex(stage, prev);

  const cards = Array.from(stage.querySelectorAll<HTMLPictureElement>(".post-card-media__stage-card"));
  const byIndex = (index: number) => cards.find((card) => card.dataset.slideIndex === String(index)) ?? null;
  const moves: Array<() => void> = [];
  let doneCard: HTMLPictureElement | null = null;

  if (direction === "forward") {
    const outgoing = byIndex(prev);
    const promoted = byIndex(prev + 1);
    const tucked = byIndex(prev + 2);
    const incoming = byIndex(prev + 3);
    setStageCardTarget(incoming, "c", true, true);
    doneCard = promoted;

    moves.push(
      () => setStageCardTarget(outgoing, "peel"),
      () => setStageCardTarget(promoted, "a"),
      () => setStageCardTarget(tucked, "b"),
      () => setStageCardTarget(incoming, "c"),
    );
  } else {
    const incoming = byIndex(next);
    const demoted = byIndex(prev);
    const tucked = byIndex(prev + 1);
    const outgoing = byIndex(prev + 2);
    setStageCardTarget(incoming, "a", true, true);
    doneCard = demoted;

    moves.push(
      () => setStageCardTarget(incoming, "a"),
      () => setStageCardTarget(demoted, "b"),
      () => setStageCardTarget(tucked, "c"),
      () => setStageCardTarget(outgoing, "c", true, true),
    );
  }

  return {
    doneCard,
    play: () => moves.forEach((move) => move()),
  };
}

/** WPRC-style desktop deck: body is locked, wheel/touch/key changes one active card index. */
export function initPostCarousel(root: ParentNode = document) {
  cleanupPrevious?.();
  cleanupPrevious = undefined;

  const shell = root.querySelector<HTMLElement>("[data-carousel]");
  const track = shell?.querySelector<HTMLElement>("[data-carousel-track]");
  const parts = getPostCarouselParts(root);
  const stackRoot = parts?.stackRoot;
  const stackTouchTarget = shell?.querySelector<HTMLElement>(".stack-carousel__viewport");

  const pages = Array.from(shell?.querySelectorAll<HTMLElement>("[data-carousel-scroll-page]") ?? []);
  const simpleCarousel = shell?.querySelector<HTMLElement>("[data-simple-carousel]");
  const simpleSlides = Array.from(shell?.querySelectorAll<HTMLElement>("[data-simple-carousel-slide]") ?? []);
  const dots = Array.from(shell?.querySelectorAll<HTMLAnchorElement>("[data-progress-dot]") ?? []);
  const currentLabel = shell?.querySelector("[data-stack-current-index]");
  const bootstrap = parts?.bootstrap;

  if (!track || !shell || !stackRoot || !bootstrap?.media.length) return;

  const { media, meta } = bootstrap;
  const liveStage = getLiveStage(stackRoot, media);
  const frontPicture = stackRoot.querySelector<HTMLPictureElement>("picture.post-card-media__front");
  const heroTransitionName = frontPicture
    ? getComputedStyle(frontPicture).viewTransitionName
    : "none";
  const mqLockedDeck = window.matchMedia("(min-width: 1024px) and (orientation: landscape)");
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctrl = new AbortController();

  let activeIndex = -1;
  let rafScan = 0;
  let rafSimpleScan = 0;
  let wheelDelta = 0;
  let wheelResetTimer = 0;
  let unlockTimer = 0;
  let transitionTimer = 0;
  let transitionGeneration = 0;
  let locked = false;
  let touchStartY: number | null = null;
  let touchStartX: number | null = null;
  let touchHasAdvanced = false;

  const setDots = (ix: number) => {
    dots.forEach((dot, i) => {
      dot.toggleAttribute("aria-current", i === ix);
    });
  };

  const isLockedDeck = () => mqLockedDeck.matches;
  const isSimpleCarousel = () => !isLockedDeck();

  const setDeckMode = () => {
    const lockedDeck = isLockedDeck();
    document.body.classList.toggle("post-stack-body-lock", lockedDeck);
    document.body.classList.toggle("post-stack-scroll-deck", false);
    document.body.classList.toggle("post-simple-carousel-mode", !lockedDeck);
    stackRoot.classList.add("slide-hero-stack--stage-primed");
    stackRoot.classList.add("slide-hero-stack--staged");
    if (frontPicture && heroTransitionName !== "none") {
      frontPicture.style.viewTransitionName = "none";
    }
    setLiveStageTransitionName(
      liveStage,
      activeIndex >= 0 ? activeIndex : 0,
      lockedDeck ? heroTransitionName : "none",
    );
  };

  const publish = (ix: number, intent: "forward" | "back" | "none" = "none") => {
    const next = Math.max(0, Math.min(media.length - 1, ix));
    if (next === activeIndex) return;

    const prev = activeIndex;
    activeIndex = next;

    const label = String(next + 1).padStart(2, "0");
    if (currentLabel) currentLabel.textContent = label;
    setDots(next);
    writeSlideUrl(next);

    const direction = intent === "none" && prev >= 0
      ? next > prev ? "forward" : "back"
      : intent;

    if (reduceMotion() || prev < 0 || direction === "none") {
      syncLayers(next, media, meta, stackRoot);
      setLiveStageIndex(liveStage, next);
      setLiveStageTransitionName(liveStage, next, isLockedDeck() ? heroTransitionName : "none");
      return;
    }

    locked = true;
    const generation = ++transitionGeneration;
    stackRoot.classList.remove("slide-hero-stack--transitioning", "slide-hero-stack--syncing");
    window.clearTimeout(transitionTimer);
    window.clearTimeout(unlockTimer);

    let settled = false;
    const isAdjacentMove = Math.abs(next - prev) === 1;
    const stageMove = isAdjacentMove
      ? primeStageForMove(liveStage, prev, next, direction)
      : null;

    const finalize = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(transitionTimer);
      syncLayers(next, media, meta, stackRoot);
      setLiveStageIndex(liveStage, next);
      setLiveStageTransitionName(liveStage, next, isLockedDeck() ? heroTransitionName : "none");

      void stackRoot.offsetHeight;
      stackRoot.classList.remove("slide-hero-stack--transitioning");

      window.clearTimeout(unlockTimer);
      window.clearTimeout(wheelResetTimer);
      wheelDelta = 0;
      unlockTimer = window.setTimeout(() => {
        locked = false;
      }, 260);
    };

    if (!stageMove) {
      finalize();
      return;
    }

    if (settled || generation !== transitionGeneration) return;

    const onDone = (event: TransitionEvent) => {
      if (event.target !== stageMove.doneCard || event.propertyName !== "transform") return;
      stageMove.doneCard?.removeEventListener("transitionend", onDone);
      finalize();
    };

    stageMove.doneCard?.addEventListener("transitionend", onDone);
    void stackRoot.offsetHeight;
    stackRoot.classList.add("slide-hero-stack--transitioning");
    void stackRoot.offsetHeight;
    stageMove.play();

    transitionTimer = window.setTimeout(() => {
      stageMove.doneCard?.removeEventListener("transitionend", onDone);
      finalize();
    }, 920);
  };

  const advance = (dir: 1 | -1) => {
    if (locked) return;
    const current = activeIndex >= 0 ? activeIndex : 0;
    const next = Math.max(0, Math.min(media.length - 1, current + dir));
    if (next === current) return;
    publish(next, dir > 0 ? "forward" : "back");
  };

  const scanMobileScroll = () => {
    if (pages.length === 0 || isSimpleCarousel()) return;

    const vc = window.innerHeight * 0.42;
    let bestIx = 0;
    let bestDist = Infinity;

    pages.forEach((page, i) => {
      const er = page.getBoundingClientRect();
      const mid = er.top + er.height * 0.5;
      const d = Math.abs(mid - vc);

      if (d < bestDist) {
        bestDist = d;
        bestIx = i;
      }
    });

    publish(bestIx);
  };

  const scheduleMobileScan = () => {
    cancelAnimationFrame(rafScan);
    rafScan = requestAnimationFrame(scanMobileScroll);
  };

  const scanSimpleCarousel = () => {
    if (!simpleCarousel || simpleSlides.length === 0 || !isSimpleCarousel()) return;

    const carouselRect = simpleCarousel.getBoundingClientRect();
    const center = carouselRect.left + carouselRect.width * 0.5;
    let bestIx = 0;
    let bestDist = Infinity;

    simpleSlides.forEach((slide, i) => {
      const rect = slide.getBoundingClientRect();
      const slideCenter = rect.left + rect.width * 0.5;
      const dist = Math.abs(slideCenter - center);

      if (dist < bestDist) {
        bestDist = dist;
        bestIx = i;
      }
    });

    publish(bestIx, "none");
  };

  const scheduleSimpleScan = () => {
    cancelAnimationFrame(rafSimpleScan);
    rafSimpleScan = requestAnimationFrame(scanSimpleCarousel);
  };

  const scrollSimpleToIndex = (index: number, smooth: boolean) => {
    if (!simpleCarousel || !simpleSlides[index]) return;
    const slide = simpleSlides[index];
    const left = slide.offsetLeft - (simpleCarousel.clientWidth - slide.clientWidth) * 0.5;
    simpleCarousel.scrollTo({
      left,
      behavior: smooth && !reduceMotion() ? "smooth" : "auto",
    });
  };

  const onWheel = (event: WheelEvent) => {
    if (!isLockedDeck() || shouldIgnoreNavigationEvent(event.target)) return;
    event.preventDefault();
    if (locked) return;

    wheelDelta += event.deltaY;
    window.clearTimeout(wheelResetTimer);
    wheelResetTimer = window.setTimeout(() => {
      wheelDelta = 0;
    }, 170);

    if (Math.abs(wheelDelta) < 72) return;
    const dir = wheelDelta > 0 ? 1 : -1;
    wheelDelta = 0;
    advance(dir);
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (!isLockedDeck()) return;
    if (shouldIgnoreNavigationEvent(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      advance(1);
    }
    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      advance(-1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      publish(0, "back");
    }
    if (event.key === "End") {
      event.preventDefault();
      publish(media.length - 1, "forward");
    }
  };

  const onTouchStart = (event: TouchEvent) => {
    if (!isLockedDeck() || shouldIgnoreNavigationEvent(event.target)) return;
    const touch = event.touches[0];
    touchStartY = touch?.clientY ?? null;
    touchStartX = touch?.clientX ?? null;
    touchHasAdvanced = false;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!isLockedDeck() || touchStartY === null || shouldIgnoreNavigationEvent(event.target)) return;

    // In the desktop stack, vertical swipes belong to the deck, not the page.
    event.preventDefault();

    const touch = event.touches[0];
    if (!touch || locked || touchHasAdvanced) return;

    const deltaY = touchStartY - touch.clientY;
    const deltaX = touchStartX === null ? 0 : touchStartX - touch.clientX;
    const verticalIntent = Math.abs(deltaY) > Math.abs(deltaX) * 0.75;

    if (!verticalIntent || Math.abs(deltaY) < 52) return;

    touchHasAdvanced = true;
    touchStartY = touch.clientY;
    touchStartX = touch.clientX;
    advance(deltaY > 0 ? 1 : -1);
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (!isLockedDeck() || touchStartY === null || shouldIgnoreNavigationEvent(event.target)) return;
    if (touchHasAdvanced) {
      touchStartY = null;
      touchStartX = null;
      touchHasAdvanced = false;
      return;
    }

    const endY = event.changedTouches[0]?.clientY ?? touchStartY;
    const delta = touchStartY - endY;
    touchStartY = null;
    touchStartX = null;
    if (Math.abs(delta) < 42) return;
    advance(delta > 0 ? 1 : -1);
  };

  dots.forEach((dot, index) => {
    dot.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        const current = activeIndex >= 0 ? activeIndex : 0;
        if (isSimpleCarousel()) {
          publish(index, "none");
          scrollSimpleToIndex(index, true);
        } else {
          publish(index, index > current ? "forward" : index < current ? "back" : "none");
        }
      },
      { signal: ctrl.signal },
    );
  });

  track.addEventListener("wheel", onWheel, { passive: false, signal: ctrl.signal });
  const touchTarget = stackTouchTarget ?? stackRoot;
  touchTarget.addEventListener("touchstart", onTouchStart, { passive: true, signal: ctrl.signal });
  touchTarget.addEventListener("touchmove", onTouchMove, { passive: false, signal: ctrl.signal });
  touchTarget.addEventListener("touchend", onTouchEnd, { passive: true, signal: ctrl.signal });
  window.addEventListener("keydown", onKeydown, { signal: ctrl.signal });
  window.addEventListener("scroll", scheduleMobileScan, { passive: true, signal: ctrl.signal });
  window.addEventListener("resize", scheduleMobileScan, { passive: true, signal: ctrl.signal });
  window.addEventListener("resize", scheduleSimpleScan, { passive: true, signal: ctrl.signal });
  simpleCarousel?.addEventListener("scroll", scheduleSimpleScan, { passive: true, signal: ctrl.signal });
  document.addEventListener("astro:after-swap", () => cleanupPrevious?.(), {
    signal: ctrl.signal,
    once: true,
  });
  mqLockedDeck.addEventListener("change", () => {
    setDeckMode();
    scheduleMobileScan();
    scheduleSimpleScan();
    if (isSimpleCarousel()) {
      scrollSimpleToIndex(activeIndex >= 0 ? activeIndex : 0, false);
    }
  }, { signal: ctrl.signal });

  setDeckMode();
  publish(readInitialIndex(media.length));
  if (isSimpleCarousel()) {
    scrollSimpleToIndex(activeIndex >= 0 ? activeIndex : 0, false);
  }
  scheduleMobileScan();
  scheduleSimpleScan();

  cleanupPrevious = () => {
    document.body.classList.remove("post-stack-body-lock");
    document.body.classList.remove("post-stack-scroll-deck");
    document.body.classList.remove("post-simple-carousel-mode");
    window.clearTimeout(wheelResetTimer);
    window.clearTimeout(unlockTimer);
    window.clearTimeout(transitionTimer);
    transitionGeneration += 1;
    stripDeckClasses(stackRoot);
    ctrl.abort();
    cancelAnimationFrame(rafScan);
    cancelAnimationFrame(rafSimpleScan);
    cleanupPrevious = undefined;
  };
}
