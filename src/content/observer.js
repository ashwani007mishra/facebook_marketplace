/**
 * MutationObserver wrapper tuned for React-based infinite scroll DOM.
 * - Debounced to avoid thrashing during re-renders
 * - Collects added element roots to allow incremental scanning
 */

export class ListingsObserver {
  /**
   * @param {{ onChange: (roots: HTMLElement[]) => void, debounceMs?: number }} opts
   */
  constructor({ onChange, debounceMs = 200 }) {
    this.onChange = onChange;
    this.debounceMs = debounceMs;

    /** @type {MutationObserver|null} */
    this.observer = null;
    /** @type {number|null} */
    this.timer = null;
    /** @type {Set<HTMLElement>} */
    this.pendingRoots = new Set();
  }

  start(root = document.body) {
    if (!root) return;
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n instanceof HTMLElement) this.pendingRoots.add(n);
        }
      }
      this.#scheduleFlush();
    });

    this.observer.observe(root, { childList: true, subtree: true });
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingRoots.clear();
    this.observer?.disconnect();
    this.observer = null;
  }

  flushNow() {
    this.#flush();
  }

  #scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.#flush();
    }, this.debounceMs);
  }

  #flush() {
    if (this.pendingRoots.size === 0) return;
    const roots = Array.from(this.pendingRoots);
    this.pendingRoots.clear();
    try {
      this.onChange(roots);
    } catch (e) {
      console.warn("[FBMP] observer callback failed:", e);
    }
  }
}

