/**
 * All DOM listeners of a running match are registered with the match's AbortSignal,
 * so quitting to the menu removes every handler in one go.
 */
let current = new AbortController();
export function newSession(): AbortController { current = new AbortController(); return current; }
export function listen<K extends keyof WindowEventMap>(t: Window, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions): void;
export function listen<K extends keyof HTMLElementEventMap>(t: HTMLElement | Document, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): void;
export function listen(t: EventTarget, type: string, fn: (e: any) => void, opts: AddEventListenerOptions = {}) {
  t.addEventListener(type, fn, { ...opts, signal: current.signal });
}
