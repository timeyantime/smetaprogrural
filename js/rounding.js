/* СметаПро — правила округления по Методике № 421/пр (п. 58, таблица 22).
   Единый источник истины — src/js/rounding.js. Этот файл — тонкая ES-модульная
   обёртка: импортирует реализацию и публикует её в глобальную область для
   legacy-скриптов (js/app.js), подключаемых как классические <script>.
   Так логика округления не дублируется. */

import { ROUND_MODES, ROUND_METHODS, roundMoney, roundGrandTotal } from '../src/js/rounding.js';

window.ROUND_MODES = ROUND_MODES;
window.ROUND_METHODS = ROUND_METHODS;
window.roundMoney = roundMoney;
window.roundGrandTotal = roundGrandTotal;

export { ROUND_MODES, ROUND_METHODS, roundMoney, roundGrandTotal };
