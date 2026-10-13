/* СметаПро — правила округления по Методике № 421/пр (п. 58, таблица 22).
   Все расчёты внутри идут с полной точностью; округление применяется только
   к итоговым статьям сметы. Режим «Банковское» — rounding half to even. */

const ROUND_MODES = {
  kopecks: { label: 'Копейки (2 знака)', digits: 2 },
  rubles:  { label: 'Рубли (0 знаков)',  digits: 0 },
};

const ROUND_METHODS = {
  math:     'Математическое (5 и выше — вверх)',
  bank:     'Банковское (до ближайшего чётного)',
  truncate: 'Отбрасывание остатка (вниз)',
};

function roundMoney(value, mode, method) {
  const v = Number(value) || 0;
  if (!isFinite(v)) return 0;
  const digits = ROUND_MODES[mode] ? ROUND_MODES[mode].digits : 2;
  const f = Math.pow(10, digits);
  const scaled = v * f;
  let r;
  switch (method) {
    case 'bank': {
      const floor = Math.floor(scaled);
      const diff = scaled - floor;
      if (Math.abs(diff - 0.5) < 1e-9) {
        r = (floor % 2 === 0 ? floor : floor + 1); // ровно .5 → к ближайшему чётному
      } else {
        r = Math.round(scaled);
      }
      break;
    }
    case 'truncate':
      r = Math.floor(scaled);
      break;
    default: // 'math'
      // корректное математическое округление для отрицательных тоже вверх по модулю
      r = Math.sign(scaled) * Math.round(Math.abs(scaled));
  }
  return r / f;
}

/* Применяется к итоговой строке «Итого по смете» независимо от основного режима. */
function roundGrandTotal(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}
