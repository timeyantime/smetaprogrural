(() => {
  // src/ts/money.ts
  document.addEventListener("alpine:init", () => {
    window.Alpine.directive("money", (el, { expression }, { evaluateLater, effect }) => {
      const getVal = evaluateLater(expression);
      effect(() => {
        getVal((v) => {
          const n = Number(v) || 0;
          el.textContent = n.toLocaleString("ru-RU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        });
      });
    });
  });
})();
