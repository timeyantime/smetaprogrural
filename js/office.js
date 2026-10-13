/* СметаПро — офлайн-экспорт в XLSX (SpreadsheetML 2003) и PNG (SVG→canvas).
   Единый источник истины — src/js/office.js. Этот файл — тонкая ES-модульная
   обёртка: импортирует реализацию и публикует её в глобальную область для
   legacy-скриптов (js/app.js), подключаемых как классические <script>.
   Так генератор Excel не дублируется. */

import { xmlEsc, buildSpreadsheetML, svgToPng } from '../src/js/office.js';

window.xmlEsc = xmlEsc;
window.buildSpreadsheetML = buildSpreadsheetML;
window.svgToPng = svgToPng;

export { xmlEsc, buildSpreadsheetML, svgToPng };
