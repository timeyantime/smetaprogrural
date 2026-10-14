/**
 * Адаптер для совместимости со старым кодом (тонкая ES-модульная обёртка).
 *
 * РАНЬШЕ этот файл дублировал реализации округления (roundMoney и др.)
 * и SpreadsheetML-генератора (buildSpreadsheetML, xmlEsc, svgToPng).
 * Теперь единый источник истины — src/js/rounding.js и src/js/office.js;
 * здесь только реэкспорт в глобальную область для legacy-скриптов.
 */

import { ROUND_MODES, ROUND_METHODS, roundMoney, roundGrandTotal } from './rounding.js';
import { xmlEsc, buildSpreadsheetML, svgToPng } from './office.js';

// Экспорт для совместимости (используется в index.html и js/app.js)
window.ROUND_MODES = ROUND_MODES;
window.ROUND_METHODS = ROUND_METHODS;
window.roundMoney = roundMoney;
window.roundGrandTotal = roundGrandTotal;

window.xmlEsc = xmlEsc;
window.buildSpreadsheetML = buildSpreadsheetML;
window.svgToPng = svgToPng;

// Глобальные переменные из старого app.js
window.LS_KEY = 'smetapro.v4';
window.LS_MIGRATE_FROM = 'smetapro.v3';
window.LS_NSB_KEY = 'smetapro.nsb.v1';
window.LS_RESOURCES_KEY = 'smetapro.resources.v1';
window.LS_UI_KEY = 'smetapro.ui.v1';
window.LS_HISTORY_KEY = 'smetapro.history.v1';
window.LS_COLS_KEY = 'smetapro.v4.cols';
window.LS_PRINT_KEY = 'smetapro.print.v1';
window.PAGE_SIZE = 50;

console.log('Legacy adapter loaded. New modular code is ready.');
