/* СметаПро — ресурсный метод. Модель данных и логика на Alpine.js. */

const LS_KEY = 'smetapro.v1';

let uidCounter = 0;
const uid = () => `id-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;

function newRow(partial = {}) {
  return {
    id: uid(),
    basis: '',     // Обоснование (шифр расценки)
    name: '',      // Наименование работ и затрат
    type: 'material', // labor | machine | material
    operator: false,   // для machine: оплата труда машинистов (Тмр)
    unit: '',      // Ед. изм.
    qty: 0,        // Кол-во
    price: 0,      // Текущая цена, руб.
    note: '',      // Примечание
    ...partial,
  };
}

function newSection(name = 'Новый раздел') {
  return { id: uid(), name, resources: [newRow()] };
}

function defaultData() {
  return {
    title: 'Локальная смета № 1',
    sections: [
      {
        id: uid(),
        name: 'Земляные работы',
        resources: [
          newRow({
            basis: 'ГЭСН 81-02-01-01-01',
            name: 'Разработка грунта под фундаменты экскаватором',
            type: 'labor',
            unit: 'чел.-ч',
            qty: 10.5,
            price: 250,
            note: 'Слесарь 4 разр.',
          }),
          newRow({
            basis: 'ГЭСНр 81-02-01-01-01',
            name: 'Экскаватор одноковшовый 0,4 м³',
            type: 'machine',
            operator: true,
            unit: 'маш.-ч',
            qty: 5.2,
            price: 1450,
            note: '',
          }),
          newRow({
            basis: '',
            name: 'Песок строительный',
            type: 'material',
            unit: 'т',
            qty: 12,
            price: 890,
            note: 'Прайс поставщика №14',
          }),
        ],
      },
    ],
    rates: {
      overheadPct: 15,
      overheadBase: 'labor', // labor | pz
      profitPct: 10,
      profitBase: 'labor',   // labor | pz
      vatPct: 20,
    },
  };
}

window.smeta = function smeta() {
  return {
    data: loadLocal() || defaultData(),
    filter: '',

    /* ---------- Инициализация / хранение ---------- */

    init() {
      this.$watch('data', () => this.saveLocal(), { deep: true });
    },

    saveLocal() {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.exportable()));
      } catch (e) {
        console.warn('localStorage недоступен', e);
      }
    },

    exportable() {
      // Срезаем служебные id? Оставляем — для корректного импорта/редактирования.
      return JSON.parse(JSON.stringify(this.data));
    },

    /* ---------- Вычисления ---------- */

    rowTotal(row) {
      return (Number(row.qty) || 0) * (Number(row.price) || 0);
    },

    sectionTotal(section) {
      return section.resources.reduce((s, r) => s + this.rowTotal(r), 0);
    },

    globalIndex(si, ri) {
      let n = 0;
      for (let i = 0; i < si; i++) n += this.data.sections[i].resources.length;
      return n + ri + 1;
    },

    get sums() {
      const sums = { labor: 0, machine: 0, operator: 0, material: 0 };
      for (const sec of this.data.sections) {
        for (const r of sec.resources) {
          const t = this.rowTotal(r);
          if (r.type === 'labor') sums.labor += t;
          else if (r.type === 'machine') {
            sums.machine += t;
            if (r.operator) sums.operator += t;
          } else sums.material += t;
        }
      }
      sums.pz = sums.labor + sums.machine + sums.material;

      const rate = this.data.rates;
      const baseFor = (base) => (base === 'pz' ? sums.pz : sums.labor + sums.operator);
      sums.nr = baseFor(rate.overheadBase) * (Number(rate.overheadPct) || 0) / 100;
      sums.sp = baseFor(rate.profitBase) * (Number(rate.profitPct) || 0) / 100;
      sums.vat = (sums.pz + sums.nr + sums.sp) * (Number(rate.vatPct) || 0) / 100;
      sums.grand = sums.pz + sums.nr + sums.sp + sums.vat;
      return sums;
    },

    /* ---------- Фильтр ---------- */

    matchesFilter(row) {
      const f = this.filter.trim().toLowerCase();
      if (!f) return true;
      return (row.name || '').toLowerCase().includes(f)
        || (row.basis || '').toLowerCase().includes(f);
    },

    hiddenCount() {
      let hidden = 0;
      for (const sec of this.data.sections)
        for (const r of sec.resources)
          if (!this.matchesFilter(r)) hidden++;
      return hidden;
    },

    /* ---------- Управление разделами и строками ---------- */

    addSection() {
      this.data.sections.push(newSection());
    },

    removeSection(si) {
      if (confirm(`Удалить раздел «${this.data.sections[si].name}»?`)) {
        this.data.sections.splice(si, 1);
      }
    },

    addRow(si) {
      this.data.sections[si].resources.push(newRow());
    },

    removeRow(si, ri) {
      this.data.sections[si].resources.splice(ri, 1);
    },

    duplicateRow(si, ri) {
      const src = this.data.sections[si].resources[ri];
      const { id, ...rest } = src; // newRow() назначит новый id
      const copy = newRow(rest);
      this.data.sections[si].resources.splice(ri + 1, 0, copy);
    },

    moveRow(si, ri, dir) {
      const arr = this.data.sections[si].resources;
      const j = ri + dir;
      if (j < 0 || j >= arr.length) return;
      [arr[ri], arr[j]] = [arr[j], arr[ri]];
    },

    /* ---------- Экспорт / импорт ---------- */

    download(filename, text, mime) {
      const blob = new Blob([text], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    exportJson() {
      this.download('smeta.json', JSON.stringify(this.exportable(), null, 2), 'application/json');
    },

    importJson(ev) {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          if (!Array.isArray(obj.sections)) throw new Error('нет массива sections');
          // Восстановим id там, где их нет
          obj.sections.forEach((sec) => {
            sec.id = sec.id || uid();
            (sec.resources || []).forEach((r) => { r.id = r.id || uid(); });
          });
          obj.rates = { ...defaultData().rates, ...(obj.rates || {}) };
          this.data = obj;
        } catch (e) {
          alert('Не удалось прочитать JSON: ' + e.message);
        }
      };
      reader.readAsText(file, 'utf-8');
      ev.target.value = '';
    },

    exportCsv() {
      const sep = ';';
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [];
      lines.push(esc(this.data.title));
      lines.push(['№ п/п', 'Обоснование', 'Наименование', 'Тип', 'Ед.изм.',
        'Кол-во', 'Цена', 'Стоимость', 'Примечание'].map(esc).join(sep));
      let n = 0;
      for (const sec of this.data.sections) {
        lines.push([['', '', sec.name.toUpperCase()].map(esc).join(sep)].join(sep));
        for (const r of sec.resources) {
          n++;
          lines.push([
            n, r.basis, r.name, typeName(r), r.unit,
            num(r.qty), num(r.price), num(this.rowTotal(r)), r.note,
          ].map(esc).join(sep));
        }
      }
      const s = this.sums;
      lines.push('', ['', '', 'Итого прямые затраты'].map(esc).join(sep), num(s.pz));
      lines.push(['', '', 'НР'].map(esc).join(sep), num(s.nr));
      lines.push(['', '', 'СП'].map(esc).join(sep), num(s.sp));
      lines.push(['', '', 'НДС'].map(esc).join(sep), num(s.vat));
      lines.push(['', '', 'ИТОГО ПО СМЕТЕ'].map(esc).join(sep), num(s.grand));
      this.download('smeta.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv');

      function typeName(r) {
        if (r.type === 'labor') return 'ЗТ';
        if (r.type === 'machine') return r.operator ? 'ОМ+Тмр' : 'ОМ';
        return 'М';
      }
      function num(v) {
        return Number(v || 0).toFixed(2).replace('.', ',');
      }
    },

    printPage() {
      window.print();
    },
  };
};

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!Array.isArray(obj.sections)) return null;
    obj.sections.forEach((sec) => {
      sec.id = sec.id || uid();
      (sec.resources || []).forEach((r) => { r.id = r.id || uid(); });
    });
    obj.rates = { ...defaultData().rates, ...(obj.rates || {}) };
    return obj;
  } catch (e) {
    return null;
  }
}
