/**
 * Глобальные объявления окружения после миграции на TypeScript.
 * Alpine.js подключается с CDN как window.Alpine; smeta/ganttLinks — точки входа UI.
 */

interface AlpineDirectiveDetails {
  expression: string;
  modifiers: string[];
  original?: string;
}

interface AlpineDirectiveUtilities {
  evaluateLater: (expression: string) => (callback: (value: unknown) => void) => void;
  effect: (fn: () => void) => void;
  cleanup: (fn: () => void) => void;
  [key: string]: unknown;
}

interface AlpineGlobal {
  directive(
    name: string,
    callback: (
      el: HTMLElement,
      details: AlpineDirectiveDetails,
      utilities: AlpineDirectiveUtilities
    ) => void
  ): void;
  data(name: string, fn: (...args: any[]) => any): void;
  start(): void;
  [key: string]: unknown;
}

declare global {
  interface Window {
    Alpine: AlpineGlobal;
    smeta: (...args: any[]) => any;
    ganttLinks: (...args: any[]) => any;
  }
}

export {};
