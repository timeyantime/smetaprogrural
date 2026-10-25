/**
 * Утилита для debounce функций
 * Используется для оптимизации частых операций (автосохранение, поиск и т.д.)
 */

/**
 * Создает debounced версию функции
 * @param {Function} func - Исходная функция
 * @param {number} wait - Время ожидания в миллисекундах
 * @param {Object} options - Опции
 * @param {boolean} options.leading - Вызывать сразу на первом вызове
 * @param {number} options.maxWait - Максимальное время ожидания
 * @returns {Function} Debounced функция
 */
interface DebounceOptions {
  leading?: boolean;
  maxWait?: number;
}

export function debounce(
  func: (...args: any[]) => any,
  wait: number,
  options: DebounceOptions = {}
) {
  let lastArgs: any[] | null = null;
  let lastThis: unknown = null;
  const maxWait = options.maxWait || 0;
  let timerId = null;
  let lastInvokeTime = 0;
  let maxing = false;
  let trailing = true;

  if (typeof func !== 'function') {
    throw new TypeError('Expected a function');
  }

  wait = Number(wait) || 0;

  if (options.leading === false) {
    trailing = true;
  } else if (options.leading === true) {
    trailing = false;
  }

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;
    lastArgs = null;
    lastThis = null;
    lastInvokeTime = time;
    return func.apply(thisArg, args);
  }

  function shouldInvoke(time) {
    const timeSinceLastInvoke = time - lastInvokeTime;
    return lastInvokeTime === 0 || timeSinceLastInvoke >= wait || timeSinceLastInvoke >= maxWait;
  }

  function trailingEdge(time) {
    timerId = null;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = null;
    lastThis = null;
    return null;
  }

  function timerExpired() {
    if (maxing) {
      maxing = false;
      return trailingEdge(Date.now());
    }
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timerId = setTimeout(timerExpired, wait - (time - lastInvokeTime));
    return null;
  }

  function leadingEdge(time) {
    lastInvokeTime = time;
    timerId = setTimeout(timerExpired, wait);
    return invokeFunc(time);
  }

  function remainingWait(time) {
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastInvoke;
    return maxing ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
  }

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- классический паттерн debounce: контекст вызова сохраняется для последующего invokeFunc
    lastThis = this;

    if (isInvoking) {
      if (timerId === null) {
        return leadingEdge(time);
      }
      if (maxing) {
        timerId = setTimeout(timerExpired, remainingWait(time));
        return invokeFunc(time);
      }
    }

    if (timerId === null) {
      timerId = setTimeout(timerExpired, wait);
    }

    if (maxWait && !maxing) {
      const timeUntilMax = maxWait - (time - lastInvokeTime);
      if (timeUntilMax < wait) {
        maxing = true;
        timerId = setTimeout(timerExpired, timeUntilMax);
      }
    }

    return null;
  }

  debounced.cancel = function () {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    lastInvokeTime = 0;
    lastArgs = lastThis = timerId = null;
    maxing = false;
  };

  debounced.flush = function () {
    return timerId === null ? null : trailingEdge(Date.now());
  };

  debounced.pending = function () {
    return timerId !== null;
  };

  return debounced;
}

/**
 * Простая debounce функция (упрощенная версия)
 * @param {Function} fn - Функция
 * @param {number} delay - Задержка в мс
 * @returns {Function} Debounced функция
 */
export function simpleDebounce(fn, delay) {
  let timeout;
  return function (...args) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- контекст пробрасывается в setTimeout колбэк
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn.apply(context, args);
    }, delay);
  };
}

/**
 * Throttle функция
 * @param {Function} func - Исходная функция
 * @param {number} limit - Лимит времени в мс
 * @returns {Function} Throttled функция
 */
export function throttle(func, limit) {
  let lastFunc;
  let lastRan;

  return function (...args) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- контекст пробрасывается в отложенный вызов
    const context = this;

    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (Date.now() - lastRan >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        },
        limit - (Date.now() - lastRan)
      );
    }
  };
}

export default {
  debounce,
  simpleDebounce,
  throttle,
};
