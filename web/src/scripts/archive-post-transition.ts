import { navigate } from "astro:transitions/client";

const EXIT_DELAY_MS = 190;

function getBlackout() {
  return document.querySelector<HTMLElement>("[data-route-blackout]");
}

function isPlainPrimaryClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function beginBlackoutNavigation(href: string, storageKey: string, storageValue = "1") {
  try {
    window.sessionStorage.setItem(storageKey, storageValue);
  } catch {
    // The transition still works without sessionStorage; it only loses the tailored enter state.
  }

  document.body.classList.add("site-route-blackout");
  getBlackout()?.classList.add("route-blackout--visible");
  window.setTimeout(() => {
    navigate(href);
  }, EXIT_DELAY_MS);
}

export function initArchivePostTransition(root: ParentNode = document) {
  const cards = Array.from(root.querySelectorAll<HTMLAnchorElement>('a.post-card[href^="/posts/"]'));
  if (!cards.length) return;

  cards.forEach((card) => {
    if (card.dataset.routeTransitionBound === "true") return;
    card.dataset.routeTransitionBound = "true";

    card.addEventListener("click", (event) => {
      if (!isPlainPrimaryClick(event)) return;
      if (card.target || card.hasAttribute("download")) return;

      const href = new URL(card.href, window.location.href);
      if (href.origin !== window.location.origin) return;

      event.preventDefault();
      if (document.body.classList.contains("site-route-blackout")) return;

      const slug = href.pathname.split("/").filter(Boolean).at(-1) ?? "";
      beginBlackoutNavigation(href.href, "rajintalksalot-post-entry", slug);
    });
  });

  if (readAndClearSessionFlag("rajintalksalot-archive-entry")) {
    document.body.classList.add("archive-return-entering");
    requestAnimationFrame(() => {
      document.body.classList.remove("site-route-blackout");
      getBlackout()?.classList.remove("route-blackout--visible");
      document.body.classList.add("archive-return-visible");
      window.setTimeout(() => {
        document.body.classList.remove("archive-return-entering", "archive-return-visible");
      }, 420);
    });
  } else {
    document.body.classList.remove("site-route-blackout");
    getBlackout()?.classList.remove("route-blackout--visible");
  }
}

export function initPostBackTransition(root: ParentNode = document) {
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a.back-link[href="/"]'));
  links.forEach((link) => {
    if (link.dataset.routeTransitionBound === "true") return;
    link.dataset.routeTransitionBound = "true";

    link.addEventListener("click", (event) => {
      if (!isPlainPrimaryClick(event)) return;
      if (link.target || link.hasAttribute("download")) return;

      event.preventDefault();
      if (document.body.classList.contains("site-route-blackout")) return;

      beginBlackoutNavigation(new URL(link.href, window.location.href).href, "rajintalksalot-archive-entry");
    });
  });
}

export function readAndClearSessionFlag(key: string) {
  try {
    const value = window.sessionStorage.getItem(key);
    if (value !== null) window.sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}
