/**
 * TOON-кодек — компактный текстовый формат для однородных табличных данных.
 *
 * Вместо JSON-массива объектов:
 *   [{"basis":"ГЭСН 1-1","name":"Работа","unit":"чел.-ч","qty":2,"price":250}, ...]
 * пишем один раз заголовок полей и далее значения через запятую:
 *   [basis,name,unit,qty,price,_]
 *   ГЭСН 1-1,Работа,чел.-ч,2,250
 *
 * Экономия на типовых сметах ~40–60% объёма localStorage против JSON.
 *
 * Правила кодирования ячеек:
 * - number/boolean -> без кавычек; null -> пустая ячейка;
 * - string -> без кавычек, если не содержит спецсимволов ( , " \n \r ), внешних
 *   пробелов и не похожа на число/true/false/null (иначе — в кавычках);
 * - объект/массив в ячейке -> JSON одной строкой в кавычках;
 * - при декодировании: ячейка в кавычках -> всегда строка, без кавычек -> число/bool/null;
 * - пустая строка значений = удалённая запись (null);
 * - поля вне схемы сохраняются в хвостовом столбце `_` (JSON) — строгая обратимость.
 */

/** Ключи localStorage с табличными схемами (авто-детект в encode/decodeValue) */
export const TOON_KEYS = Object.freeze({
  NSB: 'smetapro.nsb.v1',
  RESOURCES: 'smetapro.resources.v1',
  HISTORY: 'smetapro.history.v1',
});

// Табличные схемы по ключам
const TOON_SCHEMAS = {
  [TOON_KEYS.NSB]: [
    'id',
    'basis',
    'name',
    'type',
    'unit',
    'price',
    'note',
    // Каркасный метод v2.0: метаданные расценок (нормы отходов, логистика, ночь/праздник)
    'wasteGroup',
    'perUnit',
    'unitMassT',
    'vehicleCapT',
    'distanceKm',
    'tariffPerKm',
    'supplyFee',
    'kGabarit',
    'manipulatorFlag',
    'unloadMachineHr',
    'unloadHours',
    'moveDistM',
    'moveSpeedMh',
    'perPct',
    'storePct',
    'perOn',
    'storeOn',
    'night',
    'holiday',
  ],
  [TOON_KEYS.RESOURCES]: [
    'id',
    'basis',
    'name',
    'type',
    'unit',
    'code',
    'labor',
    'mach',
    'mat',
    'qty',
    'price',
  ],
  [TOON_KEYS.HISTORY]: ['time', 'text'],
};

/**
 * Схема проекта: соответствует Section.create()/Resource.create() (models/*).
 * sections хранятся в @sections (children — JSON-ячейкой), строки раздела — в блоках @rows:<id>.
 */
export const PROJECT_SCHEMA = {
  top: ['title', 'startDate', 'recalcMode'],
  company: ['customer', 'contractor', 'objectName', 'address', 'basis', 'chief', 'phone', 'date'],
  rates: ['overheadPct', 'overheadBase', 'profitPct', 'profitBase', 'vatPct'],
  rounding: ['mode', 'method'],
  // полные списки полей моделей: значения по умолчанию живут в models/*, не в хранилище
  section: ['id', 'name', 'parentId', 'collapsed', 'children'],
  row: [
    'id',
    'basis',
    'name',
    'type',
    'operator',
    'unit',
    'qty',
    'price',
    'note',
    'days',
    'pred',
    'startAt',
    // Каркасный метод v2.0 (framework.js): метаданные строки
    'wasteGroup',
    'perUnit',
    'unitMassT',
    'vehicleCapT',
    'distanceKm',
    'tariffPerKm',
    'supplyFee',
    'kGabarit',
    'manipulatorFlag',
    'unloadMachineHr',
    'unloadHours',
    'moveDistM',
    'moveSpeedMh',
    'perPct',
    'storePct',
    'perOn',
    'storeOn',
    'night',
    'holiday',
  ],
};

/** Схема настроек каркасного метода (проект.framework). */
export const FRAMEWORK_FIELDS = [
  'enabled',
  'npPct',
  'usnPct',
  'dRyn',
  'vzPct',
  'zuPct',
  'ppPct',
  'garantPct',
  'kNight',
  'fuelPer100',
  'fuelPrice',
  'workerDistanceKm',
  'workDays',
  'rainDays',
  'monthDays',
  'rainKLoss',
  'rainProb',
  'buildMonths',
  'vehicleTaxYear',
  'insuranceYear',
  'scrapPricePerTon',
  'vzLiquidation',
];

const NUM_RE = /^-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;

// ---- экранирование ---------------------------------------------------------

function quoted(inner) {
  return '"' + inner.replace(/[\\"]/g, '\\$&').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
}

function escCell(v) {
  if (v === null || v === undefined) return '';
  const t = typeof v;
  if (t === 'number' || t === 'boolean') return String(v);
  if (t === 'string') {
    if (v === '') return '""';
    const ambiguous = v === 'true' || v === 'false' || v === 'null' || NUM_RE.test(v);
    return /[",\\\n\r]/.test(v) || /^\s|\s$/.test(v) || ambiguous ? quoted(v) : v;
  }
  return quoted(JSON.stringify(v)); // объекты/массивы в ячейке
}

// ---- разбор ----------------------------------------------------------------

/** Разбирает строку в массив {v, q} (значение + была ли ячейка в кавычках) */
function parseCells(line) {
  const cells = [];
  let cur = '';
  let q = false;
  let openQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (openQ) {
      if (ch === '\\' && i + 1 < line.length) {
        const nx = line[++i];
        cur += nx === 'n' ? '\n' : nx === 'r' ? '\r' : nx === 't' ? '\t' : nx;
      } else if (ch === '"') {
        openQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      openQ = true;
      q = true;
    } else if (ch === ',') {
      cells.push({ v: cur, q });
      cur = '';
      q = false;
    } else cur += ch;
  }
  cells.push({ v: cur, q });
  return cells;
}

/** Скаляр из ячейки: кавычки = всегда строка; без кавычек — число/bool/null */
function cellValue(cell) {
  if (!cell) return null;
  if (cell.q) return cell.v;
  if (cell.v === '') return null;
  if (cell.v === 'true') return true;
  if (cell.v === 'false') return false;
  if (NUM_RE.test(cell.v)) return Number(cell.v);
  return cell.v;
}

// ---- таблица ---------------------------------------------------------------

/**
 * Кодирует массив однородных объектов в TOON-таблицу.
 * @param {Array<Object>} arr
 * @param {Array<string>} fields - схема полей
 * @returns {string}
 */
export function encodeTable(arr, fields) {
  const cols = fields.concat(['_']);
  const lines = [`[${cols.join(',')}]`];
  for (const item of arr) {
    if (!item) {
      lines.push('');
      continue;
    }
    const cells = fields.map((f) => escCell(item[f]));
    const rest = {};
    let hasRest = false;
    for (const k of Object.keys(item)) {
      if (!fields.includes(k)) {
        rest[k] = item[k];
        hasRest = true;
      }
    }
    cells.push(hasRest ? escCell(rest) : '');
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

/**
 * Декодирует TOON-таблицу в массив объектов.
 * @param {string} src
 * @param {Array<string>} fields - ожидаемая схема
 * @returns {Array<Object>}
 */
export function decodeTable(src, fields) {
  const text = String(src)
    .replace(/^\ufeff/, '')
    .trim();
  const nl = text.indexOf('\n');
  const m = /^\[(.+)\]$/.exec((nl === -1 ? text : text.slice(0, nl)).trim());
  if (!m) throw new Error('TOON: bad header');
  const cols = parseCells(m[1]).map((c) => c.v);
  const body = nl === -1 ? [] : text.slice(nl + 1).split('\n');
  const out = [];
  for (const line of body) {
    if (line === '') {
      out.push(null);
      continue;
    }
    const cells = parseCells(line);
    const obj = {};
    cells.forEach((cell, i) => {
      const col = cols[i];
      if (col === '_' || col === undefined) {
        if (cell.v && cell.v.startsWith('{')) {
          try {
            Object.assign(obj, JSON.parse(cell.v));
          } catch (e) {
            /* ignore */
          }
        }
        return;
      }
      obj[col] = cellValue(cell);
    });
    for (const f of fields) if (!(f in obj)) obj[f] = null;
    out.push(obj);
  }
  return out;
}

// ---- проект (блочный формат) -----------------------------------------------

/**
 * Блок: @name[field1,field2,...] + строки значений.
 * opts.childField — поле-массив дочерних объектов, сериализуется JSON-ячейкой.
 */
function encodeBlock(
  name: string,
  fields: string[],
  rows: any[],
  opts: { childField?: string; jsonFields?: string[] } = {}
) {
  const cf = opts.childField;
  // поле-массив (дочерние разделы) сериализуем JSON-ячейкой прямо в схеме
  const jsonFields = new Set(opts.jsonFields || (cf ? [cf] : []));
  const allFields = fields.slice();
  if (cf && !allFields.includes(cf)) allFields.push(cf);
  const lines = [`@${name}[${allFields.join(',')}]`];
  for (const item of rows || []) {
    if (!item) {
      lines.push('');
      continue;
    }
    const cells = allFields.map((f) =>
      jsonFields.has(f) ? quoted(JSON.stringify(item[f] || [])) : escCell(item[f])
    );
    const rest = {};
    let hasRest = false;
    for (const k of Object.keys(item)) {
      if (!allFields.includes(k)) {
        rest[k] = item[k];
        hasRest = true;
      }
    }
    while (cells.length && cells[cells.length - 1] === '') cells.pop(); // пустые хвостовые ячейки не пишем
    if (hasRest) cells.push(escCell(rest));
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

/** Значение по умолчанию для поля вне зависимости от схемы */
function defaultFor(f) {
  if (f === 'resources' || f === 'children') return [];
  // vatPct: legacy-поле (каркасный метод v2.0 — «Без НДС»); пустая ячейка → undefined,
  // чтобы старый проект с пропущенным НДС не «восстанавливался» с нулевым процентом.
  if (f === 'qty' || f === 'price' || f === 'overheadPct' || f === 'profitPct') return 0;
  if (f === 'operator' || f === 'collapsed') return false;
  if (f === 'pred' || f === 'note' || f === 'basis' || f === 'name' || f === 'type' || f === 'unit')
    return '';
  return null; // days, startAt, parentId, id...
}

function decodeBlockRows(lines, fields, jsonCols = []) {
  const jc = jsonCols || [];
  const out = [];
  for (const line of lines) {
    if (line === '') {
      out.push(null);
      continue;
    }
    const cells = parseCells(line);
    const obj = {};
    cells.forEach((cell, i) => {
      const f = fields[i];
      if (!f) {
        // хвостовая JSON-ячейка с extra-полями за схемой
        if (cell.v && cell.v.startsWith('{')) {
          try {
            Object.assign(obj, JSON.parse(cell.v));
          } catch (e) {
            /* ignore */
          }
        }
        return;
      }
      if (jc.includes(f)) {
        try {
          obj[f] = JSON.parse(cell.v);
        } catch (e) {
          obj[f] = defaultFor(f);
        }
        return;
      }
      obj[f] = cellValue(cell);
    });
    for (const f of fields) if (!(f in obj)) obj[f] = defaultFor(f);
    out.push(obj);
  }
  return out;
}

/**
 * Кодирует весь проект в компактный блочный TOON-формат ('TOONP1:'...).
 * @param {Object} project
 * @returns {string}
 */
export function encodeProject(project) {
  const S = PROJECT_SCHEMA;
  const parts = [];
  const metaFields = S.top.slice();
  const restMeta = {};
  let hasRestMeta = false;
  for (const k of Object.keys(project)) {
    if (
      k === 'sections' ||
      S.top.includes(k) ||
      ['company', 'rates', 'rounding', 'framework'].includes(k)
    )
      continue;
    restMeta[k] = project[k];
    hasRestMeta = true;
  }
  if (hasRestMeta) metaFields.push('_');
  const metaCells = metaFields.map((f) => escCell(f === '_' ? restMeta : project[f]));
  parts.push(`@meta[${metaFields.join(',')}]\n${metaCells.join(',')}`);
  parts.push(encodeBlock('company', S.company, [project.company || {}]));
  parts.push(encodeBlock('rates', S.rates, [project.rates || {}]));
  parts.push(encodeBlock('rounding', S.rounding, [project.rounding || {}]));
  // framework: скалярные поля по схеме + rainRows/rainMonths и extra — JSON-ячейками
  if (project.framework) {
    const fw = project.framework;
    const cells = FRAMEWORK_FIELDS.map((f) => escCell(fw[f]));
    const jsons = [JSON.stringify(fw.rainRows || []), JSON.stringify(fw.rainMonths || [])].map(
      (j) => quoted(j)
    );
    const restFw = {};
    let hasRestFw = false;
    for (const k of Object.keys(fw)) {
      if (!FRAMEWORK_FIELDS.includes(k) && k !== 'rainRows' && k !== 'rainMonths') {
        restFw[k] = fw[k];
        hasRestFw = true;
      }
    }
    parts.push(
      `@framework[${[...FRAMEWORK_FIELDS, 'rainRows', 'rainMonths', ...(hasRestFw ? ['_'] : [])].join(',')}]`
    );
    parts.push([...cells, ...jsons, ...(hasRestFw ? [escCell(restFw)] : [])].join(','));
  }
  parts.push(
    encodeBlock('sections', S.section, project.sections || [], { jsonFields: ['children'] })
  );
  const allSecs = [];
  for (const sec of project.sections || []) {
    allSecs.push(sec);
    for (const sub of sec.children || []) allSecs.push(sub);
  }
  for (const sec of allSecs) {
    parts.push(encodeBlock(`rows:${sec.id}`, S.row, sec.resources || []));
  }
  return 'TOONP1:' + parts.join('\n');
}

/**
 * Декодирует блочный TOON-формат обратно в объект проекта.
 * @param {string} payload - строка ПОСЛЕ префикса 'TOONP1:'
 * @returns {Object}
 */
export function decodeProject(payload) {
  const S = PROJECT_SCHEMA;
  const blocks = [];
  let cur = null;
  for (const line of payload.split('\n')) {
    if (line.startsWith('@')) {
      cur = { header: line.slice(1), lines: [] };
      blocks.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  // заголовок блока: '@name[cols]' — ищем по точному имени до '['
  const find = (name) =>
    blocks.find((b) => {
      const nm = b.header.slice(0, b.header.indexOf('['));
      return nm === name;
    });
  const project: Record<string, any> = {};
  const metaB = find('meta');
  if (metaB) {
    const m = /^\[(.+)\]$/.exec(metaB.header.slice(4));
    const cols = parseCells(m[1]).map((c) => c.v);
    const cells = parseCells(metaB.lines[0] || '');
    cells.forEach((cell, i) => {
      const col = cols[i];
      if (col === '_') {
        if (cell.v && cell.v.startsWith('{')) {
          try {
            Object.assign(project, JSON.parse(cell.v));
          } catch (e) {
            /* ignore */
          }
        }
      } else {
        project[col] = cellValue(cell);
      }
    });
  }
  const one = (name, fields) => {
    const b = find(name);
    if (!b) return {};
    return decodeBlockRows(b.lines, fields, [])[0] || {};
  };
  project.company = one('company', S.company);
  project.rates = one('rates', S.rates);
  project.rounding = one('rounding', S.rounding);
  // framework-блок (если сохранён)
  {
    const fb = find('framework');
    if (fb) {
      const mFw = /^\[(.+)\]$/.exec(fb.header.slice('framework'.length));
      const cols = parseCells(mFw[1]).map((c) => c.v);
      const cells = parseCells(fb.lines[0] || '');
      const fw = {};
      cells.forEach((cell, i) => {
        const col = cols[i];
        if (!col) return;
        if (col === '_') {
          if (cell.v && cell.v.startsWith('{')) {
            try {
              Object.assign(fw, JSON.parse(cell.v));
            } catch (e) {
              /* ignore */
            }
          }
        } else if (col === 'rainRows' || col === 'rainMonths') {
          try {
            fw[col] = JSON.parse(cell.v);
          } catch (e) {
            fw[col] = [];
          }
        } else {
          fw[col] = cellValue(cell);
        }
      });
      project.framework = fw;
    }
  }
  const secB = find('sections');
  project.sections = (secB ? decodeBlockRows(secB.lines, S.section, ['children']) : []).filter(
    Boolean
  );
  const attach = (sec) => {
    const rb = find(`rows:${sec.id}`);
    sec.resources = rb ? decodeBlockRows(rb.lines, S.row).filter(Boolean) : [];
    for (const sub of sec.children || []) attach(sub);
  };
  for (const sec of project.sections) attach(sec);
  return project;
}

// ---- файлы .toon (экспорт/импорт) ------------------------------------------

/**
 * Сериализует проект в формат файла .toon (префикс 'TOONP1:').
 * @param {Object} project
 * @returns {string}
 */
export function toFile(project) {
  return encodeProject(project);
}

/**
 * Разбирает содержимое файла .toon в объект проекта.
 * Принимает как 'TOONP1:'-строку, так и классический JSON (обратная совместимость).
 * @param {string} text - содержимое файла
 * @returns {Object} проект
 */
export function fromFile(text) {
  const s = String(text).replace(/^\ufeff/, '').trim();
  if (s.startsWith('TOONP1:')) return decodeProject(s.slice('TOONP1:'.length));
  if (s.startsWith('{')) return JSON.parse(s); // legacy: импорт .json всё ещё работает
  throw new Error('TOON: неизвестный формат файла (ожидался .toon с префиксом TOONP1:)');
}

// ---- ключ-ориентированный API (для storage.ts / app.ts) --------------------

/** Возвращает схему для ключа хранилища или null. */
export function schemaFor(key) {
  return TOON_SCHEMAS[key] ? [key, TOON_SCHEMAS[key]] : null;
}

/**
 * Кодирование значения под ключом: табличные схемы -> 'TOON1:'+таблица, иначе JSON.
 * @param {string} key - ключ localStorage
 * @param {any} value
 * @returns {string}
 */
export function encodeValue(key, value) {
  const sc = TOON_SCHEMAS[key];
  if (sc && Array.isArray(value)) return 'TOON1:' + encodeTable(value, sc);
  return JSON.stringify(value);
}

/**
 * Декодирование с автоопределением формата (обратная совместимость с JSON).
 * @param {string} key - ключ localStorage
 * @param {string} raw - содержимое localStorage
 * @returns {any}
 */
export function decodeValue(key, raw) {
  if (raw === null || raw === undefined) return null;
  const sc = TOON_SCHEMAS[key];
  if (sc && typeof raw === 'string' && raw.startsWith('TOON1:')) {
    return decodeTable(raw.slice('TOON1:'.length), sc);
  }
  return JSON.parse(raw);
}

export default {
  encodeTable,
  decodeTable,
  encodeProject,
  decodeProject,
  schemaFor,
  encodeValue,
  decodeValue,
  TOON_KEYS,
  PROJECT_SCHEMA,
};
