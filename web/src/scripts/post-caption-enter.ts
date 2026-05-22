/** After navigation, fan the hero stack the same way the archive card does on hover. */
export function initPostHeroStackExpand() {
  const stack = document.querySelector("[data-slide-hero-stack]");
  if (!(stack instanceof HTMLElement)) return;

  stack.classList.add("slide-hero-stack--expanded");
}

const entryTimers: number[] = [];

function clearEntryTimers() {
  while (entryTimers.length > 0) {
    const timer = entryTimers.pop();
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

function queueEntryStep(callback: () => void, delay: number) {
  entryTimers.push(window.setTimeout(callback, delay));
}

function getBlackout() {
  return document.querySelector<HTMLElement>("[data-route-blackout]");
}

function revealIntroStageCard(index: number) {
  const card = document.querySelector<HTMLPictureElement>(
    `.slide-hero-stack--intro-live .post-card-media__stage-card[data-slide-index="${index}"]`,
  );
  card?.style.setProperty("opacity", "1", "important");
}

function clearPostEntryFlag() {
  try {
    window.sessionStorage.removeItem("rajintalksalot-post-entry");
  } catch {
    // Session storage only marks tailored route entry; the animation can run without it.
  }
}

/** Build the post deck in a/b/c order after the archive has faded to black. */
export function initPostEntranceSequence() {
  const shell = document.querySelector("article.post-shell[data-carousel]");
  if (!(shell instanceof HTMLElement)) return;

  clearEntryTimers();
  clearPostEntryFlag();

  document.body.classList.remove("post-page-caption-visible");
  shell.classList.remove(
    "post-shell--entry-step-a",
    "post-shell--entry-step-b",
    "post-shell--entry-step-c",
    "post-shell--entry-complete",
  );

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    getBlackout()?.classList.remove("route-blackout--visible");
    document.body.classList.remove("site-route-blackout");
    shell.classList.remove("post-shell--entry-pending");
    shell.classList.add("post-shell--entry-complete");
    document.body.classList.add("post-page-caption-visible");
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const blackout = getBlackout();
      const cameFromBlackout =
        document.body.classList.contains("site-route-blackout") ||
        blackout?.classList.contains("route-blackout--visible");
      const firstStepDelay = cameFromBlackout ? 120 : 50;

      queueEntryStep(() => {
        document.body.classList.remove("site-route-blackout");
        blackout?.classList.remove("route-blackout--visible");
      }, cameFromBlackout ? 40 : 0);

      queueEntryStep(() => {
        shell.classList.add("post-shell--entry-step-a");
        revealIntroStageCard(0);
      }, firstStepDelay);

      queueEntryStep(() => {
        shell.classList.add("post-shell--entry-step-b");
        revealIntroStageCard(1);
      }, firstStepDelay + 85);

      queueEntryStep(() => {
        shell.classList.add("post-shell--entry-step-c");
        revealIntroStageCard(2);
      }, firstStepDelay + 170);

      queueEntryStep(() => {
        document.body.classList.add("post-page-caption-visible");
      }, firstStepDelay + 285);

      queueEntryStep(() => {
        shell.classList.remove(
          "post-shell--entry-pending",
          "post-shell--entry-step-a",
          "post-shell--entry-step-b",
          "post-shell--entry-step-c",
        );
        shell.classList.add("post-shell--entry-complete");
      }, firstStepDelay + 650);
    });
  });
}
