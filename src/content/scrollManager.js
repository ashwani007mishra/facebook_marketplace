function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

/** Fixed wait (ms) after each scroll so we do exactly N scrolls and stop. */
const SCROLL_PAGE_WAIT_MS = 1800;

/**
 * Auto-scroll exactly "pages" times.
 *
 * Each iteration: scroll to bottom, fixed wait, then onAfterEach.
 * No long wait for count increase — stops after exactly N scrolls.
 *
 * @param {{
 *   pages: number,
 *   getListingCount: () => number,
 *   onAfterEach?: (info: {iteration: number, loadedNew: boolean}) => void,
 *   signal?: AbortSignal
 * }} opts
 */
export async function autoScroll(opts) {
  const pages = Math.max(0, Math.min(50, Number(opts?.pages ?? 0)));
  const getListingCount = opts.getListingCount;
  const onAfterEach = opts.onAfterEach ?? (() => {});
  const signal = opts.signal;

  for (let i = 0; i < pages; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const prev = getListingCount();

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

    await sleep(900, signal);
    await sleep(SCROLL_PAGE_WAIT_MS, signal);

    const loadedNew = getListingCount() > prev;
    onAfterEach({ iteration: i + 1, loadedNew });

    await sleep(350, signal);
  }
}

