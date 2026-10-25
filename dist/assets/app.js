(() => {
  // src/ts/models/Resource.ts
  var Resource = class _Resource {
    /**
     * Создает новый ресурс
     * @param {Object} partial - Частичные данные ресурса
     * @returns {Object} Новый ресурс
     */
    static create(partial = {}) {
      return {
        id: Project.generateId(),
        basis: "",
        // Обоснование (шифр расценки)
        name: "",
        // Наименование работы и затрат
        type: "material",
        // labor | machine | material
        operator: false,
        // Для machine: оплата труда машиниста (Тмр)
        unit: "",
        // Ед. изм.
        qty: 0,
        // Кол-во
        price: 0,
        // Текущая цена, руб.
        note: "",
        // Примечание
        days: null,
        // Длительность, дни (для диаграммы Ганта)
        pred: "",
        // Преемственность: номер записи (для связей в Гант)
        startAt: null,
        // Принудительно начало в днях от старта сметы
        // --- Каркасный метод (framework v2.0): метаданные строки ---
        wasteGroup: "",
        // группа норм отходов (id из WASTE_NORMS), '' = без запаса
        perUnit: 0,
        // p_отп отпускная цена ₽/ед. (0 = использовать price)
        unitMassT: 0,
        // Масса_ед, т (для рейсов доставки и металлолома)
        vehicleCapT: 0,
        // Грузоподъемность_т
        distanceKm: 0,
        // L_км плечо перевозки
        tariffPerKm: 0,
        // C_тариф_км, ₽/км
        supplyFee: 0,
        // C_подачи, ₽
        kGabarit: 1,
        // k_габарит
        manipulatorFlag: false,
        // Флаг_манипулятор (0|1)
        unloadMachineHr: 0,
        // C_маш_ч разгрузки, ₽/ч
        unloadHours: 0,
        // t_час, ч
        moveDistM: 0,
        // S_м перемещение после разгрузки
        moveSpeedMh: 0,
        // V_перем, м/ч
        perPct: 0,
        // П — надбавка, % (1per·П)
        storePct: 0,
        // Х — хранение, % (1hran·Х)
        perOn: true,
        // 1per ∈ {0,1}
        storeOn: false,
        // 1hran ∈ {0,1}
        night: false,
        // работа в ночную смену (k_ночн)
        holiday: false,
        // работа в праздник (k_ночн)
        ...partial
      };
    }
    /**
     * Валидация ресурса
     * @param {Object} resource - Ресурс для валидации
     * @returns {boolean} true если ресурс валиден
     */
    static validate(resource) {
      if (!resource || typeof resource !== "object") {
        return false;
      }
      if (!resource.id || typeof resource.id !== "string") {
        return false;
      }
      if (typeof resource.name !== "string") {
        return false;
      }
      if (!["labor", "machine", "material"].includes(resource.type)) {
        return false;
      }
      if (typeof resource.qty !== "number" || resource.qty < 0) {
        return false;
      }
      if (typeof resource.price !== "number" || resource.price < 0) {
        return false;
      }
      return true;
    }
    /**
     * Рассчитывает стоимость ресурса
     * @param {Object} resource - Ресурс
     * @returns {number} Итоговая стоимость
     */
    static calculateTotal(resource) {
      if (!_Resource.validate(resource)) {
        return 0;
      }
      return resource.qty * resource.price;
    }
    /**
     * Форматирует ресурс для отображения
     * @param {Object} resource - Ресурс
     * @returns {Object} Форматированный ресурс
     */
    static formatForDisplay(resource) {
      if (!_Resource.validate(resource)) {
        return {
          id: "",
          basis: "",
          name: "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 \u0440\u0435\u0441\u0443\u0440\u0441",
          type: "material",
          typeLabel: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B",
          unit: "",
          qty: 0,
          price: 0,
          total: 0,
          note: ""
        };
      }
      const typeLabels = {
        labor: "\u0420\u0430\u0431\u043E\u0442\u0430",
        machine: "\u041C\u0430\u0448\u0438\u043D\u0430",
        material: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B"
      };
      return {
        ...resource,
        typeLabel: typeLabels[resource.type] || resource.type,
        total: _Resource.calculateTotal(resource)
      };
    }
    /**
     * Создает ключ для группировки ресурсов
     * Используется для поиска дубликатов
     * @param {Object} resource - Ресурс
     * @returns {string|null} Ключ для группировки
     */
    static getKey(resource) {
      if (!_Resource.validate(resource)) {
        return null;
      }
      const name = String(resource.name || "").trim().toLowerCase();
      if (!name) {
        return null;
      }
      const type = resource.type === "labor" ? "l" : resource.type === "machine" ? "m" : "c";
      const unit = String(resource.unit || "").trim().toLowerCase();
      return `${type}|${name}|${unit}`;
    }
    /**
     * Создает ресурс из строки (для импорта)
     * @param {string} line - Строка CSV
     * @returns {Object} Ресурс
     */
    static fromCSV(line) {
      const parts = line.split(";");
      return _Resource.create({
        basis: parts[0] || "",
        name: parts[1] || "",
        type: parts[2] || "material",
        unit: parts[3] || "",
        qty: Number(parts[4]) || 0,
        price: Number(parts[5]) || 0,
        note: parts[6] || ""
      });
    }
    /**
     * Конвертирует ресурс в строку CSV
     * @param {Object} resource - Ресурс
     * @returns {string} Строка CSV
     */
    static toCSV(resource) {
      if (!_Resource.validate(resource)) {
        return "";
      }
      const escape = (str) => {
        if (typeof str !== "string") return "";
        return str.includes(";") ? `"${str}"` : str;
      };
      return [
        escape(resource.basis),
        escape(resource.name),
        resource.type,
        escape(resource.unit),
        resource.qty,
        resource.price,
        escape(resource.note)
      ].join(";");
    }
  };

  // src/ts/models/Section.ts
  var Section = class _Section {
    /**
     * Создает новый раздел
     * @param {string} name - Наименование раздела
     * @returns {Object} Новый раздел
     */
    static create(name = "\u041D\u043E\u0432\u044B\u0439 \u0440\u0430\u0437\u0434\u0435\u043B") {
      return {
        id: Project.generateId(),
        name,
        parentId: null,
        collapsed: false,
        resources: [],
        children: []
        // подразделы (главы), см. UI-логику app.js: isChapter/promoteSection
      };
    }
    /**
     * Создает раздел с дефолтными ресурсами
     * @param {string} name - Наименование раздела
     * @returns {Object} Раздел с дефолтными ресурсами
     */
    static createDefaultSection(name) {
      const section = this.create(name);
      if (name.toLowerCase().includes("\u0437\u0435\u043C\u043B\u044F\u043D\u044B\u0435") || name.toLowerCase().includes("\u0437\u0435\u043C\u043B\u044F")) {
        section.resources = [
          Resource.create({
            basis: "\u0413\u044D\u0441\u043D 81-02-01-01-01",
            name: "\u0420\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u0433\u0440\u0443\u043D\u0442\u0430 \u044D\u043A\u0441\u043A\u0430\u0432\u0430\u0442\u043E\u0440\u043E\u043C \u043F\u043E\u0434 \u0444\u0443\u043D\u0434\u0430\u043C\u0435\u043D\u0442\u044B",
            type: "labor",
            unit: "\u0447\u0435\u043B.-\u0447",
            qty: 10.5,
            price: 250,
            note: "\u0421\u043B\u0435\u0441\u0430\u0440\u044C 4 \u0440\u0430\u0437\u0440.",
            days: 3
          }),
          Resource.create({
            basis: "\u0413\u044D\u0441\u043D\u0440 81-02-01-01-01",
            name: "\u042D\u043A\u0441\u043A\u0430\u0432\u0430\u0442\u043E\u0440 \u043E\u0434\u043D\u043E\u043A\u043E\u0432\u0448\u043E\u0432\u044B\u0439 0,4 \u043C\xB3",
            type: "machine",
            operator: true,
            unit: "\u043C\u0430\u0448.-\u0447",
            qty: 5.2,
            price: 1450,
            note: "",
            days: 2
          }),
          Resource.create({
            basis: "",
            name: "\u041F\u0435\u0441\u043E\u043A \u0441\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439",
            type: "material",
            unit: "\u0442",
            qty: 12,
            price: 890,
            note: "\u041F\u0440\u0430\u0439\u0441 \u043F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A\u0430 \u211614",
            days: 1
          })
        ];
      } else if (name.toLowerCase().includes("\u0444\u0443\u043D\u0434\u0430\u043C\u0435\u043D\u0442")) {
        section.resources = [
          Resource.create({
            basis: "\u0413\u044D\u0441\u043D 81-02-03-01-01",
            name: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0431\u0435\u0442\u043E\u043D\u043D\u044B\u0445 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043E\u043A",
            type: "labor",
            unit: "\u0447\u0435\u043B.-\u0447",
            qty: 24,
            price: 275,
            note: "",
            days: 4
          }),
          Resource.create({
            basis: "",
            name: "\u0411\u0435\u0442\u043E\u043D \u041222.5 (\u043C300)",
            type: "material",
            unit: "\u043C3",
            qty: 18.4,
            price: 6200,
            note: "\u0413\u041E\u0421\u0422 7473-2010",
            days: 2
          })
        ];
      }
      return section;
    }
    /**
     * Валидация раздела
     * @param {Object} section - Раздел для валидации
     * @returns {boolean} true если раздел валиден
     */
    static validate(section) {
      if (!section || typeof section !== "object") {
        return false;
      }
      if (!section.id || typeof section.id !== "string") {
        return false;
      }
      if (!section.name || typeof section.name !== "string") {
        return false;
      }
      if (!Array.isArray(section.resources)) {
        return false;
      }
      for (const resource of section.resources) {
        if (!Resource.validate(resource)) {
          return false;
        }
      }
      return true;
    }
    /**
     * Добавляет ресурс в раздел
     * @param {Object} section - Раздел
     * @param {Object} resource - Ресурс для добавления
     * @returns {Object} Обновленный раздел
     */
    static addResource(section, resource) {
      if (!_Section.validate(section)) {
        throw new Error("Invalid section");
      }
      if (!Resource.validate(resource)) {
        throw new Error("Invalid resource");
      }
      section.resources.push(resource);
      return section;
    }
    /**
     * Удаляет ресурс из раздела
     * @param {Object} section - Раздел
     * @param {string} resourceId - ID ресурса для удаления
     * @returns {Object} Обновленный раздел
     */
    static removeResource(section, resourceId) {
      if (!_Section.validate(section)) {
        throw new Error("Invalid section");
      }
      section.resources = section.resources.filter((r) => r.id !== resourceId);
      return section;
    }
    /**
     * Находит ресурс в разделе по ID
     * @param {Object} section - Раздел
     * @param {string} resourceId - ID ресурса
     * @returns {Object|null} Найденный ресурс или null
     */
    static findResource(section, resourceId) {
      if (!_Section.validate(section)) {
        return null;
      }
      return section.resources.find((r) => r.id === resourceId) || null;
    }
    /**
     * Обновляет ресурс в разделе
     * @param {Object} section - Раздел
     * @param {string} resourceId - ID ресурса
     * @param {Object} updates - Обновления
     * @returns {Object} Обновленный раздел
     */
    static updateResource(section, resourceId, updates) {
      const resource = this.findResource(section, resourceId);
      if (!resource) {
        throw new Error(`Resource ${resourceId} not found`);
      }
      Object.assign(resource, updates);
      return section;
    }
    /**
     * Рассчитывает итоги по разделу
     * @param {Object} section - Раздел
     * @param {Object} rates - Ставки
     * @returns {Object} Итоги по разделу
     */
    static calculateTotals(section, rates) {
      if (!_Section.validate(section)) {
        return {
          laborTotal: 0,
          machineTotal: 0,
          materialTotal: 0,
          grandTotal: 0
        };
      }
      let laborTotal = 0;
      let machineTotal = 0;
      let materialTotal = 0;
      for (const resource of section.resources) {
        const total = resource.qty * resource.price;
        switch (resource.type) {
          case "labor":
            laborTotal += total;
            break;
          case "machine":
            machineTotal += total;
            break;
          case "material":
            materialTotal += total;
            break;
        }
      }
      return {
        laborTotal,
        machineTotal,
        materialTotal,
        grandTotal: laborTotal + machineTotal + materialTotal
      };
    }
  };

  // src/ts/models/Project.ts
  var uidCounter = 0;
  function frameworkDefaults() {
    return {
      enabled: true,
      // каркасный метод v2.0 — единственный расчёт (старый с НДС удалён)
      npPct: 3,
      usnPct: 6,
      dRyn: 0,
      kNight: 1.3,
      // k_ночн ∈ [1.2; 1.5] — коэффициент за работу в ночь/праздник
      vzPct: 3,
      zuPct: 0,
      ppPct: 0,
      garantPct: 0,
      fuelPer100: 12,
      fuelPrice: 60,
      workerDistanceKm: 0,
      workDays: 0,
      rainDays: 0,
      monthDays: 30,
      rainKLoss: 0.1,
      rainProb: 0.5,
      rainMonths: [],
      buildMonths: 2,
      vehicleTaxYear: 0,
      insuranceYear: 0,
      scrapPricePerTon: 15e3,
      vzLiquidation: 0
    };
  }
  var Project = class {
    /**
     * Создает новый проект с дефолтными значениями
     * @returns {Object} Дефолтный проект
     */
    static default() {
      return {
        title: "\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u043C\u0435\u0442\u0430 \u2116 1",
        sections: [
          Section.createDefaultSection("\u0417\u0435\u043C\u043B\u044F\u043D\u044B\u0435 \u0440\u0430\u0431\u043E\u0442\u044B"),
          Section.createDefaultSection("\u0424\u0443\u043D\u0434\u0430\u043C\u0435\u043D\u0442\u044B")
        ],
        startDate: this.defaultStartDate(),
        recalcMode: "auto",
        // auto | manual
        company: {
          customer: "",
          contractor: "",
          objectName: "",
          address: "",
          basis: "",
          chief: "",
          phone: "",
          date: ""
        },
        rates: {
          overheadPct: 15,
          overheadBase: "labor",
          profitPct: 10,
          profitBase: "labor"
        },
        rounding: {
          mode: "kopecks",
          method: "math"
        },
        // Каркасный метод ценообразования v2.0 (см. src/ts/framework.ts) —
        // единственный расчёт в программе (старая цепочка ПЗ→НР→СП→НДС удалена).
        framework: frameworkDefaults()
      };
    }
    /**
     * Возвращает текущую дату в формате YYYY-MM-DD
     * @returns {string} Дата в формате ISO
     */
    static defaultStartDate() {
      const d = /* @__PURE__ */ new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    }
    /**
     * Валидация проекта
     * @param {Object} project - Проект для валидации
     * @returns {boolean} true если проект валиден
     */
    static validate(project) {
      if (!project || typeof project !== "object") {
        return false;
      }
      if (!project.title || typeof project.title !== "string") {
        return false;
      }
      if (!Array.isArray(project.sections)) {
        return false;
      }
      for (const section of project.sections) {
        if (!Section.validate(section)) {
          return false;
        }
      }
      if (!project.rates || typeof project.rates !== "object") {
        return false;
      }
      return true;
    }
    /**
     * Создает уникальный ID
     * @returns {string} Уникальный ID
     */
    static generateId() {
      return `id-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;
    }
    /**
     * Глубокое клонирование проекта
     * @param {Object} project - Проект для клонирования
     * @returns {Object} Клонированный проект
     */
    static clone(project) {
      return JSON.parse(JSON.stringify(project));
    }
  };
  function migrateV3toV4(oldData) {
    const newData = Project.default();
    if (!oldData) {
      return newData;
    }
    if (oldData.title) {
      newData.title = oldData.title;
    }
    newData.recalcMode = oldData.recalcMode || "auto";
    if (oldData.company) {
      newData.company = { ...newData.company, ...oldData.company };
    }
    if (oldData.rates) {
      newData.rates = { ...newData.rates, ...oldData.rates };
    }
    if (oldData.rounding) {
      newData.rounding = { ...newData.rounding, ...oldData.rounding };
    }
    if (oldData.framework) {
      newData.framework = { ...frameworkDefaults(), ...oldData.framework };
    }
    if (oldData.startDate) {
      newData.startDate = oldData.startDate;
    }
    if (Array.isArray(oldData.sections)) {
      newData.sections = oldData.sections.map((section) => {
        const newSection2 = Section.create(section.name || "\u041D\u043E\u0432\u044B\u0439 \u0440\u0430\u0437\u0434\u0435\u043B");
        newSection2.id = section.id || Project.generateId();
        newSection2.parentId = section.parentId ?? null;
        newSection2.collapsed = !!section.collapsed;
        if (Array.isArray(section.resources)) {
          newSection2.resources = section.resources.map((resource) => {
            const newResource = Resource.create({});
            newResource.id = resource.id || Project.generateId();
            newResource.basis = resource.basis || "";
            newResource.name = resource.name || "";
            newResource.type = resource.type || "material";
            newResource.operator = !!resource.operator;
            newResource.unit = resource.unit || "";
            newResource.qty = Number(resource.qty) || 0;
            newResource.price = Number(resource.price) || 0;
            newResource.note = resource.note || "";
            newResource.days = resource.days !== null ? Number(resource.days) : null;
            newResource.pred = resource.pred || resource.predecessor || "";
            newResource.startAt = resource.startAt || null;
            for (const fk of [
              "wasteGroup",
              "perUnit",
              "unitMassT",
              "vehicleCapT",
              "distanceKm",
              "tariffPerKm",
              "supplyFee",
              "kGabarit",
              "manipulatorFlag",
              "unloadMachineHr",
              "unloadHours",
              "moveDistM",
              "moveSpeedMh",
              "perPct",
              "storePct",
              "perOn",
              "storeOn",
              "night",
              "holiday"
            ]) {
              if (resource[fk] !== void 0 && resource[fk] !== null) newResource[fk] = resource[fk];
            }
            return newResource;
          });
        }
        return newSection2;
      });
    }
    return newData;
  }

  // src/ts/toon.ts
  var TOON_KEYS = Object.freeze({
    NSB: "smetapro.nsb.v1",
    RESOURCES: "smetapro.resources.v1",
    HISTORY: "smetapro.history.v1"
  });
  var TOON_SCHEMAS = {
    [TOON_KEYS.NSB]: [
      "id",
      "basis",
      "name",
      "type",
      "unit",
      "price",
      "note",
      // Каркасный метод v2.0: метаданные расценок (нормы отходов, логистика, ночь/праздник)
      "wasteGroup",
      "perUnit",
      "unitMassT",
      "vehicleCapT",
      "distanceKm",
      "tariffPerKm",
      "supplyFee",
      "kGabarit",
      "manipulatorFlag",
      "unloadMachineHr",
      "unloadHours",
      "moveDistM",
      "moveSpeedMh",
      "perPct",
      "storePct",
      "perOn",
      "storeOn",
      "night",
      "holiday"
    ],
    [TOON_KEYS.RESOURCES]: [
      "id",
      "basis",
      "name",
      "type",
      "unit",
      "code",
      "labor",
      "mach",
      "mat",
      "qty",
      "price"
    ],
    [TOON_KEYS.HISTORY]: ["time", "text"]
  };
  var PROJECT_SCHEMA = {
    top: ["title", "startDate", "recalcMode"],
    company: ["customer", "contractor", "objectName", "address", "basis", "chief", "phone", "date"],
    rates: ["overheadPct", "overheadBase", "profitPct", "profitBase", "vatPct"],
    rounding: ["mode", "method"],
    // полные списки полей моделей: значения по умолчанию живут в models/*, не в хранилище
    section: ["id", "name", "parentId", "collapsed", "children"],
    row: [
      "id",
      "basis",
      "name",
      "type",
      "operator",
      "unit",
      "qty",
      "price",
      "note",
      "days",
      "pred",
      "startAt",
      // Каркасный метод v2.0 (framework.js): метаданные строки
      "wasteGroup",
      "perUnit",
      "unitMassT",
      "vehicleCapT",
      "distanceKm",
      "tariffPerKm",
      "supplyFee",
      "kGabarit",
      "manipulatorFlag",
      "unloadMachineHr",
      "unloadHours",
      "moveDistM",
      "moveSpeedMh",
      "perPct",
      "storePct",
      "perOn",
      "storeOn",
      "night",
      "holiday"
    ]
  };
  var FRAMEWORK_FIELDS = [
    "enabled",
    "npPct",
    "usnPct",
    "dRyn",
    "vzPct",
    "zuPct",
    "ppPct",
    "garantPct",
    "kNight",
    "fuelPer100",
    "fuelPrice",
    "workerDistanceKm",
    "workDays",
    "rainDays",
    "monthDays",
    "rainKLoss",
    "rainProb",
    "buildMonths",
    "vehicleTaxYear",
    "insuranceYear",
    "scrapPricePerTon",
    "vzLiquidation"
  ];
  var NUM_RE = /^-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
  function quoted(inner) {
    return '"' + inner.replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\n").replace(/\r/g, "\\r") + '"';
  }
  function escCell(v) {
    if (v === null || v === void 0) return "";
    const t = typeof v;
    if (t === "number" || t === "boolean") return String(v);
    if (t === "string") {
      if (v === "") return '""';
      const ambiguous = v === "true" || v === "false" || v === "null" || NUM_RE.test(v);
      return /[",\\\n\r]/.test(v) || /^\s|\s$/.test(v) || ambiguous ? quoted(v) : v;
    }
    return quoted(JSON.stringify(v));
  }
  function parseCells(line) {
    const cells = [];
    let cur = "";
    let q = false;
    let openQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (openQ) {
        if (ch === "\\" && i + 1 < line.length) {
          const nx = line[++i];
          cur += nx === "n" ? "\n" : nx === "r" ? "\r" : nx === "t" ? "	" : nx;
        } else if (ch === '"') {
          openQ = false;
        } else cur += ch;
      } else if (ch === '"') {
        openQ = true;
        q = true;
      } else if (ch === ",") {
        cells.push({ v: cur, q });
        cur = "";
        q = false;
      } else cur += ch;
    }
    cells.push({ v: cur, q });
    return cells;
  }
  function cellValue(cell) {
    if (!cell) return null;
    if (cell.q) return cell.v;
    if (cell.v === "") return null;
    if (cell.v === "true") return true;
    if (cell.v === "false") return false;
    if (NUM_RE.test(cell.v)) return Number(cell.v);
    return cell.v;
  }
  function encodeTable(arr, fields) {
    const cols = fields.concat(["_"]);
    const lines = [`[${cols.join(",")}]`];
    for (const item of arr) {
      if (!item) {
        lines.push("");
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
      cells.push(hasRest ? escCell(rest) : "");
      lines.push(cells.join(","));
    }
    return lines.join("\n");
  }
  function decodeTable(src, fields) {
    const text = String(src).replace(/^\ufeff/, "").trim();
    const nl = text.indexOf("\n");
    const m = /^\[(.+)\]$/.exec((nl === -1 ? text : text.slice(0, nl)).trim());
    if (!m) throw new Error("TOON: bad header");
    const cols = parseCells(m[1]).map((c) => c.v);
    const body = nl === -1 ? [] : text.slice(nl + 1).split("\n");
    const out = [];
    for (const line of body) {
      if (line === "") {
        out.push(null);
        continue;
      }
      const cells = parseCells(line);
      const obj = {};
      cells.forEach((cell, i) => {
        const col = cols[i];
        if (col === "_" || col === void 0) {
          if (cell.v && cell.v.startsWith("{")) {
            try {
              Object.assign(obj, JSON.parse(cell.v));
            } catch (e) {
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
  function encodeBlock(name, fields, rows, opts = {}) {
    const cf = opts.childField;
    const jsonFields = new Set(opts.jsonFields || (cf ? [cf] : []));
    const allFields = fields.slice();
    if (cf && !allFields.includes(cf)) allFields.push(cf);
    const lines = [`@${name}[${allFields.join(",")}]`];
    for (const item of rows || []) {
      if (!item) {
        lines.push("");
        continue;
      }
      const cells = allFields.map(
        (f) => jsonFields.has(f) ? quoted(JSON.stringify(item[f] || [])) : escCell(item[f])
      );
      const rest = {};
      let hasRest = false;
      for (const k of Object.keys(item)) {
        if (!allFields.includes(k)) {
          rest[k] = item[k];
          hasRest = true;
        }
      }
      while (cells.length && cells[cells.length - 1] === "") cells.pop();
      if (hasRest) cells.push(escCell(rest));
      lines.push(cells.join(","));
    }
    return lines.join("\n");
  }
  function defaultFor(f) {
    if (f === "resources" || f === "children") return [];
    if (f === "qty" || f === "price" || f === "overheadPct" || f === "profitPct") return 0;
    if (f === "operator" || f === "collapsed") return false;
    if (f === "pred" || f === "note" || f === "basis" || f === "name" || f === "type" || f === "unit")
      return "";
    return null;
  }
  function decodeBlockRows(lines, fields, jsonCols = []) {
    const jc = jsonCols || [];
    const out = [];
    for (const line of lines) {
      if (line === "") {
        out.push(null);
        continue;
      }
      const cells = parseCells(line);
      const obj = {};
      cells.forEach((cell, i) => {
        const f = fields[i];
        if (!f) {
          if (cell.v && cell.v.startsWith("{")) {
            try {
              Object.assign(obj, JSON.parse(cell.v));
            } catch (e) {
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
  function encodeProject(project) {
    const S = PROJECT_SCHEMA;
    const parts = [];
    const metaFields = S.top.slice();
    const restMeta = {};
    let hasRestMeta = false;
    for (const k of Object.keys(project)) {
      if (k === "sections" || S.top.includes(k) || ["company", "rates", "rounding", "framework"].includes(k))
        continue;
      restMeta[k] = project[k];
      hasRestMeta = true;
    }
    if (hasRestMeta) metaFields.push("_");
    const metaCells = metaFields.map((f) => escCell(f === "_" ? restMeta : project[f]));
    parts.push(`@meta[${metaFields.join(",")}]
${metaCells.join(",")}`);
    parts.push(encodeBlock("company", S.company, [project.company || {}]));
    parts.push(encodeBlock("rates", S.rates, [project.rates || {}]));
    parts.push(encodeBlock("rounding", S.rounding, [project.rounding || {}]));
    if (project.framework) {
      const fw = project.framework;
      const cells = FRAMEWORK_FIELDS.map((f) => escCell(fw[f]));
      const jsons = [JSON.stringify(fw.rainRows || []), JSON.stringify(fw.rainMonths || [])].map(
        (j) => quoted(j)
      );
      const restFw = {};
      let hasRestFw = false;
      for (const k of Object.keys(fw)) {
        if (!FRAMEWORK_FIELDS.includes(k) && k !== "rainRows" && k !== "rainMonths") {
          restFw[k] = fw[k];
          hasRestFw = true;
        }
      }
      parts.push(
        `@framework[${[...FRAMEWORK_FIELDS, "rainRows", "rainMonths", ...hasRestFw ? ["_"] : []].join(",")}]`
      );
      parts.push([...cells, ...jsons, ...hasRestFw ? [escCell(restFw)] : []].join(","));
    }
    parts.push(
      encodeBlock("sections", S.section, project.sections || [], { jsonFields: ["children"] })
    );
    const allSecs = [];
    for (const sec of project.sections || []) {
      allSecs.push(sec);
      for (const sub of sec.children || []) allSecs.push(sub);
    }
    for (const sec of allSecs) {
      parts.push(encodeBlock(`rows:${sec.id}`, S.row, sec.resources || []));
    }
    return "TOONP1:" + parts.join("\n");
  }
  function decodeProject(payload) {
    const S = PROJECT_SCHEMA;
    const blocks = [];
    let cur = null;
    for (const line of payload.split("\n")) {
      if (line.startsWith("@")) {
        cur = { header: line.slice(1), lines: [] };
        blocks.push(cur);
      } else if (cur) {
        cur.lines.push(line);
      }
    }
    const find = (name) => blocks.find((b) => {
      const nm = b.header.slice(0, b.header.indexOf("["));
      return nm === name;
    });
    const project = {};
    const metaB = find("meta");
    if (metaB) {
      const m = /^\[(.+)\]$/.exec(metaB.header.slice(4));
      const cols = parseCells(m[1]).map((c) => c.v);
      const cells = parseCells(metaB.lines[0] || "");
      cells.forEach((cell, i) => {
        const col = cols[i];
        if (col === "_") {
          if (cell.v && cell.v.startsWith("{")) {
            try {
              Object.assign(project, JSON.parse(cell.v));
            } catch (e) {
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
    project.company = one("company", S.company);
    project.rates = one("rates", S.rates);
    project.rounding = one("rounding", S.rounding);
    {
      const fb = find("framework");
      if (fb) {
        const mFw = /^\[(.+)\]$/.exec(fb.header.slice("framework".length));
        const cols = parseCells(mFw[1]).map((c) => c.v);
        const cells = parseCells(fb.lines[0] || "");
        const fw = {};
        cells.forEach((cell, i) => {
          const col = cols[i];
          if (!col) return;
          if (col === "_") {
            if (cell.v && cell.v.startsWith("{")) {
              try {
                Object.assign(fw, JSON.parse(cell.v));
              } catch (e) {
              }
            }
          } else if (col === "rainRows" || col === "rainMonths") {
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
    const secB = find("sections");
    project.sections = (secB ? decodeBlockRows(secB.lines, S.section, ["children"]) : []).filter(
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
  function toFile(project) {
    return encodeProject(project);
  }
  function fromFile(text) {
    const s = String(text).replace(/^\ufeff/, "").trim();
    if (s.startsWith("TOONP1:")) return decodeProject(s.slice("TOONP1:".length));
    if (s.startsWith("{")) return JSON.parse(s);
    throw new Error("TOON: \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0444\u0430\u0439\u043B\u0430 (\u043E\u0436\u0438\u0434\u0430\u043B\u0441\u044F .toon \u0441 \u043F\u0440\u0435\u0444\u0438\u043A\u0441\u043E\u043C TOONP1:)");
  }
  function encodeValue(key, value) {
    const sc = TOON_SCHEMAS[key];
    if (sc && Array.isArray(value)) return "TOON1:" + encodeTable(value, sc);
    return JSON.stringify(value);
  }
  function decodeValue(key, raw) {
    if (raw === null || raw === void 0) return null;
    const sc = TOON_SCHEMAS[key];
    if (sc && typeof raw === "string" && raw.startsWith("TOON1:")) {
      return decodeTable(raw.slice("TOON1:".length), sc);
    }
    return JSON.parse(raw);
  }

  // src/ts/services/storage.ts
  var STORAGE_KEYS = {
    DATA: "smetapro.v4",
    MIGRATE_FROM: "smetapro.v3",
    NSB: "smetapro.nsb.v1",
    RESOURCES: "smetapro.resources.v1",
    UI: "smetapro.ui.v1",
    HISTORY: "smetapro.history.v1",
    COLS: "smetapro.v4.cols",
    PRINT: "smetapro.print.v1"
  };
  function saveProject(project) {
    try {
      if (!Project.validate(project)) {
        console.error("Invalid project data");
        return false;
      }
      let data;
      try {
        data = encodeProject(project);
        decodeProject(data.slice("TOONP1:".length));
      } catch (e) {
        data = JSON.stringify(project);
      }
      localStorage.setItem(STORAGE_KEYS.DATA, data);
      return true;
    } catch (error) {
      console.error("Failed to save project:", error);
      return false;
    }
  }
  function saveUISettings(settings) {
    try {
      const data = JSON.stringify(settings);
      localStorage.setItem(STORAGE_KEYS.UI, data);
      return true;
    } catch (error) {
      console.error("Failed to save UI settings:", error);
      return false;
    }
  }
  function loadUISettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.UI);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Failed to load UI settings:", error);
      return {};
    }
  }
  function saveHistory(history) {
    try {
      const data = encodeValue(STORAGE_KEYS.HISTORY, history);
      localStorage.setItem(STORAGE_KEYS.HISTORY, data);
      return true;
    } catch (error) {
      console.error("Failed to save history:", error);
      return false;
    }
  }
  function savePrintSettings(settings) {
    try {
      const data = JSON.stringify(settings);
      localStorage.setItem(STORAGE_KEYS.PRINT, data);
      return true;
    } catch (error) {
      console.error("Failed to save print settings:", error);
      return false;
    }
  }
  function loadPrintSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRINT);
      if (data) {
        const settings = JSON.parse(data);
        if (settings && Array.isArray(settings.cols)) {
          return { cols: settings.cols, titleSheet: !!settings.titleSheet };
        }
      }
      return {
        cols: ["basis", "name", "type", "unit", "qty", "price", "total", "note"],
        titleSheet: false
      };
    } catch (error) {
      console.error("Failed to load print settings:", error);
      return {
        cols: ["basis", "name", "type", "unit", "qty", "price", "total", "note"],
        titleSheet: false
      };
    }
  }
  function saveColumnWidths(widths) {
    try {
      const data = JSON.stringify(widths);
      localStorage.setItem(STORAGE_KEYS.COLS, data);
      return true;
    } catch (error) {
      console.error("Failed to save column widths:", error);
      return false;
    }
  }
  function loadColumnWidths() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COLS) || localStorage.getItem("smetapro.v3.cols");
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Failed to load column widths:", error);
      return {};
    }
  }
  function isLocalStorageAvailable() {
    try {
      const testKey = "__test__";
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }
  function clearAllData() {
    try {
      for (const key of Object.values(STORAGE_KEYS)) {
        localStorage.removeItem(key);
      }
      return true;
    } catch (error) {
      console.error("Failed to clear all data:", error);
      return false;
    }
  }

  // src/ts/rounding.ts
  var ROUND_MODES = {
    kopecks: { label: "\u041A\u043E\u043F\u0435\u0439\u043A\u0438 (2 \u0437\u043D\u0430\u043A\u0430)", digits: 2 },
    rubles: { label: "\u0420\u0443\u0431\u043B\u0438 (0 \u0437\u043D\u0430\u043A\u043E\u0432)", digits: 0 }
  };
  var ROUND_METHODS = {
    math: "\u041C\u0430\u0442\u0435\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 (5 \u0438 \u0432\u044B\u0448\u0435 \u2014 \u0432\u0432\u0435\u0440\u0445)",
    bank: "\u0411\u0430\u043D\u043A\u043E\u0432\u0441\u043A\u043E\u0435 (\u0434\u043E \u0431\u043B\u0438\u0436\u0430\u0439\u0448\u0435\u0433\u043E \u0447\u0451\u0442\u043D\u043E\u0433\u043E)",
    truncate: "\u041E\u0442\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u043D\u0438\u0435 \u043E\u0441\u0442\u0430\u0442\u043A\u0430 (\u0432\u043D\u0438\u0437)"
  };
  function roundMoney(value, mode, method) {
    const v = Number(value) || 0;
    if (!isFinite(v)) return 0;
    const digits = ROUND_MODES[mode] ? ROUND_MODES[mode].digits : 2;
    const f = Math.pow(10, digits);
    const scaled = v * f;
    let r;
    switch (method) {
      case "bank": {
        const floor = Math.floor(scaled);
        const diff = scaled - floor;
        if (Math.abs(diff - 0.5) < 1e-9) {
          r = floor % 2 === 0 ? floor : floor + 1;
        } else {
          r = Math.round(scaled);
        }
        break;
      }
      case "truncate":
        r = Math.floor(scaled);
        break;
      default:
        r = Math.sign(scaled) * Math.round(Math.abs(scaled));
    }
    return r / f;
  }

  // src/ts/framework.ts
  var FRAMEWORK_META = Object.freeze({
    title: "\u0421\u043C\u0435\u0442\u043D\u0430\u044F \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0441\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0430 (\u041A\u0430\u0440\u043A\u0430\u0441\u043D\u044B\u0439 \u043C\u0435\u0442\u043E\u0434)",
    currency: "RUB (\u0420\u043E\u0441\u0441\u0438\u0439\u0441\u043A\u0438\u0439 \u0440\u0443\u0431\u043B\u044C, \u20BD)",
    method: "\u0420\u0435\u0441\u0443\u0440\u0441\u043D\u044B\u0439 \u043C\u0435\u0442\u043E\u0434 / \u0411\u0435\u0437 \u0431\u0430\u0437\u0438\u0441\u0430 / \u0411\u0435\u0437 \u041D\u0414\u0421 / \u0411\u0435\u0437 \u0434\u0438\u0441\u043A\u043E\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F",
    duration: "1-3 \u043C\u0435\u0441\u044F\u0446\u0430 (\u0438\u043D\u0444\u043B\u044F\u0446\u0438\u044F/\u044D\u0441\u043A\u0430\u043B\u0430\u0446\u0438\u044F \u043D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F)",
    version: "v2.0 / \u041F\u043E\u043B\u043D\u044B\u0439 \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442 \u0441 \u043D\u043E\u0440\u043C\u0430\u043C\u0438 \u043E\u0442\u0445\u043E\u0434\u043E\u0432 \u0438 \u043B\u043E\u0433\u0438\u0441\u0442\u0438\u043A\u043E\u0439",
    analysis_date: "2026-10-15"
  });
  var WASTE_NORMS = Object.freeze([
    {
      id: "block",
      material_group: "\u0411\u043B\u043E\u0447\u043D\u044B\u0435 (\u0433\u0430\u0437\u043E\u0431\u0435\u0442\u043E\u043D, \u043A\u0438\u0440\u043F\u0438\u0447)",
      k: 0.04,
      pct: "4%",
      explanation: "\u0411\u043E\u0439 \u043F\u0440\u0438 \u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0435, \u043E\u0431\u0440\u0435\u0437\u043A\u0430 \u043F\u043E\u0434 \u0440\u0430\u0437\u043C\u0435\u0440"
    },
    {
      id: "sheet",
      material_group: "\u041B\u0438\u0441\u0442\u043E\u0432\u044B\u0435 (\u0413\u041A\u041B, \u041E\u0421\u0411, \u0444\u0430\u043D\u0435\u0440\u0430)",
      k: 0.06,
      pct: "6%",
      explanation: "\u0420\u0430\u0441\u043A\u0440\u043E\u0439, \u043D\u0435\u043B\u0438\u043A\u0432\u0438\u0434\u043D\u044B\u0435 \u043E\u0431\u0440\u0435\u0437\u043A\u0438"
    },
    {
      id: "roll",
      material_group: "\u0420\u0443\u043B\u043E\u043D\u043D\u044B\u0435 (\u0433\u0438\u0434\u0440\u043E\u0438\u0437\u043E\u043B\u044F\u0446\u0438\u044F, \u043F\u043E\u0434\u043B\u043E\u0436\u043A\u0430)",
      k: 0.08,
      pct: "8%",
      explanation: "\u0422\u0435\u0445\u043D\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043D\u0430\u0445\u043B\u0435\u0441\u0442, \u043E\u0431\u0440\u0435\u0437\u043A\u0430 \u043A\u0440\u0430\u0435\u0432"
    },
    {
      id: "lumber",
      material_group: "\u041F\u0438\u043B\u043E\u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B (\u0434\u043E\u0441\u043A\u0430, \u0431\u0440\u0443\u0441, \u0440\u0435\u0439\u043A\u0430)",
      k: 0.08,
      pct: "8%",
      explanation: "\u041E\u0431\u0437\u043E\u043B, \u0442\u043E\u0440\u0446\u043E\u0432\u043A\u0430, \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u0430\u044F \u0443\u0441\u0443\u0448\u043A\u0430"
    },
    {
      id: "metal",
      material_group: "\u041C\u0435\u0442\u0430\u043B\u043B\u043E\u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438 (\u041B\u0421\u0422\u041A, \u043F\u0440\u043E\u0444\u0438\u043B\u044C, \u0443\u0433\u043E\u043B\u043E\u043A)",
      k: 0.03,
      pct: "3%",
      explanation: "\u041E\u0431\u0440\u0435\u0437\u043A\u0438 \u043F\u0440\u0438 \u0441\u0432\u0435\u0440\u043B\u043E\u0432\u043A\u0435 \u0438 \u043F\u043E\u0434\u0433\u043E\u043D\u043A\u0435"
    },
    {
      id: "concrete",
      material_group: "\u0420\u0430\u0441\u0442\u0432\u043E\u0440\u044B \u0438 \u0431\u0435\u0442\u043E\u043D (\u0433\u043E\u0442\u043E\u0432\u044B\u0435 \u0441\u043C\u0435\u0441\u0438)",
      k: 0.04,
      pct: "4%",
      explanation: "\u041F\u043E\u0442\u0435\u0440\u0438 \u043F\u0440\u0438 \u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0435, \u043D\u0430\u043B\u0438\u043F\u0430\u043D\u0438\u0435 \u043D\u0430 \u0442\u0430\u0440\u0443, \u043F\u0435\u0440\u0435\u0440\u0430\u0441\u0445\u043E\u0434"
    },
    {
      id: "paint",
      material_group: "\u041A\u0440\u0430\u0441\u043A\u0438, \u0433\u0440\u0443\u043D\u0442\u043E\u0432\u043A\u0438, \u0448\u043F\u0430\u0442\u043B\u0435\u0432\u043A\u0438",
      k: 0.08,
      pct: "8%",
      explanation: "\u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u0432 \u0442\u0430\u0440\u0435, \u043F\u043E\u0442\u0435\u0440\u0438 \u043F\u0440\u0438 \u043D\u0430\u043D\u0435\u0441\u0435\u043D\u0438\u0438, \u043E\u0447\u0438\u0441\u0442\u043A\u0430 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430"
    },
    {
      id: "floor",
      material_group: "\u0427\u0438\u0441\u0442\u043E\u0432\u044B\u0435 \u043F\u043E\u043B\u044B (\u043B\u0430\u043C\u0438\u043D\u0430\u0442, \u043F\u043B\u0438\u0442\u043A\u0430, \u043A\u0432\u0430\u0440\u0446\u0432\u0438\u043D\u0438\u043B)",
      k: 0.07,
      pct: "7%",
      explanation: "\u041F\u043E\u0434\u0440\u0435\u0437\u043A\u0430 \u0443 \u0441\u0442\u0435\u043D, \u0431\u043E\u0439 \u043F\u043B\u0438\u0442\u043A\u0438, \u043F\u043E\u0434\u0433\u043E\u043D\u043A\u0430 \u0440\u0438\u0441\u0443\u043D\u043A\u0430"
    },
    {
      id: "insul",
      material_group: "\u0423\u0442\u0435\u043F\u043B\u0438\u0442\u0435\u043B\u044C (\u043C\u0438\u043D\u0432\u0430\u0442\u0430, \u042D\u041F\u041F\u0421, PIR)",
      k: 0.04,
      pct: "4%",
      explanation: "\u0421\u0436\u0430\u0442\u0438\u0435 \u043F\u0440\u0438 \u043C\u043E\u043D\u0442\u0430\u0436\u0435, \u043E\u0431\u0440\u0435\u0437\u043A\u0430 \u043F\u043E\u0434 \u043D\u0435\u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0435 \u0443\u0437\u043B\u044B"
    },
    {
      id: "roof",
      material_group: "\u041A\u0440\u043E\u0432\u0435\u043B\u044C\u043D\u044B\u0435 (\u043C\u0435\u0442\u0430\u043B\u043B\u043E\u0447\u0435\u0440\u0435\u043F\u0438\u0446\u0430, \u043C\u044F\u0433\u043A\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F)",
      k: 0.1,
      pct: "10%",
      explanation: "\u0421\u0440\u0435\u0434\u043D\u0438\u0439 \u043F\u0440\u043E\u0446\u0435\u043D\u0442 \u043D\u0430 \u043E\u0431\u0440\u0435\u0437\u043A\u0443 \u0441\u043A\u0430\u0442\u043E\u0432 (\u0434\u043E 15% \u043D\u0430 \u0441\u043B\u043E\u0436\u043D\u044B\u0445 \u043A\u0440\u044B\u0448\u0430\u0445)"
    },
    {
      id: "cable",
      material_group: "\u041A\u0430\u0431\u0435\u043B\u044C \u0438 \u043F\u0440\u043E\u0432\u043E\u0434\u043A\u0430",
      k: 0.08,
      pct: "8%",
      explanation: "\u0417\u0430\u043F\u0430\u0441 \u043D\u0430 \u0440\u0430\u0437\u0434\u0435\u043B\u043A\u0443, \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0432 \u0449\u0438\u0442\u0430\u0445 \u0438 \u0440\u043E\u0437\u0435\u0442\u043A\u0430\u0445, \u0438\u0437\u0433\u0438\u0431\u044B"
    },
    {
      id: "pipe",
      material_group: "\u0422\u0440\u0443\u0431\u044B (\u0441\u0430\u043D\u0442\u0435\u0445\u043D\u0438\u043A\u0430, \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u0435, \u043A\u0430\u043D\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F)",
      k: 0.05,
      pct: "5%",
      explanation: "\u041D\u0430\u0440\u0435\u0437\u043A\u0430 \u0440\u0435\u0437\u044C\u0431\u044B, \u0444\u0438\u0442\u0438\u043D\u0433\u043E\u0432\u044B\u0435 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F, \u043E\u0431\u0440\u0435\u0437\u043A\u0438"
    }
  ]);
  var WASTE_BY_ID = new Map(WASTE_NORMS.map((w) => [w.id, w]));
  function wasteK(groupId) {
    const n = WASTE_BY_ID.get(groupId);
    return n ? n.k : 0;
  }
  function factQty(qtyNetto, wasteGroup) {
    const q = Number(qtyNetto) || 0;
    return q * (1 + wasteK(wasteGroup));
  }
  var LABOR_MARKUP = 1.2;
  function laborRateFact(baseRate, { night = false, holiday = false, kNight = 1.3 } = {}) {
    let r = (Number(baseRate) || 0) * LABOR_MARKUP;
    if (night || holiday) r *= Number(kNight) || 1;
    return r;
  }
  function resourceFullPrice(m, settings = null) {
    const perUnit = Number(m.perUnit) || 0;
    const delivery = deliveryPerUnit(m);
    const unloading = unloadingPerUnit(m);
    const surchPer = perUnit * ((Number(m.perPct) || 0) / 100);
    const surchStore = perUnit * ((Number(m.storePct) || 0) / 100);
    return {
      priceFull: perUnit + delivery + unloading + surchPer + surchStore,
      delivery,
      unloading,
      surchPer,
      surchStore
    };
  }
  function deliveryPerUnit(m) {
    const qty = Number(m.qty) || 0;
    const mass = Number(m.unitMassT) || 0;
    const cap = Number(m.vehicleCapT) || 0;
    if (!qty || !cap || mass <= 0) return 0;
    const trips = Math.ceil(qty * mass / cap);
    const km = Number(m.distanceKm) || 0;
    const tripCost = (Number(m.supplyFee) || 0) + km * (Number(m.tariffPerKm) || 0);
    const total = trips * tripCost * (Number(m.kGabarit) || 1);
    return total / qty;
  }
  function unloadingPerUnit(m) {
    const qty = Number(m.qty) || 0;
    if (!qty) return 0;
    const machineHr = Number(m.unloadMachineHr) || 0;
    const hours = Number(m.unloadHours) || 0;
    const supply = Number(m.supplyFee) || 0;
    const manip = Number(m.manipulatorFlag) ? 1 : 0;
    const distM = Number(m.moveDistM) || 0;
    const moveSpeed = Number(m.moveSpeedMh) || 0;
    const cranePart = (1 - 0.9 * manip) * (machineHr * hours + 0.5 * supply);
    const movePart = moveSpeed > 0 ? machineHr * distM / moveSpeed : 0;
    return (cranePart + movePart) / qty;
  }
  var RESOURCE_DEFAULT_META = Object.freeze({
    wasteGroup: "",
    // id группы из WASTE_NORMS ('' = запас не применять)
    perUnit: 0,
    // p_отп — отпускная цена за единицу, ₽ (0 → брать resource.price)
    unitMassT: 0,
    // Масса_ед, т
    vehicleCapT: 0,
    // Грузоподъёмность ТС, т
    distanceKm: 0,
    // L_км плечо перевозки
    tariffPerKm: 0,
    // C_тариф_км, ₽/км
    supplyFee: 0,
    // C_подачи, ₽ (подача ТС)
    kGabarit: 1,
    // k_габарит
    manipulatorFlag: false,
    // Флаг_манипулятор
    unloadMachineHr: 0,
    // C_маш_ч разгрузки, ₽/ч
    unloadHours: 0,
    // t_час, ч
    moveDistM: 0,
    // S_м перемещение после разгрузки, м
    moveSpeedMh: 0,
    // V_перем, м/ч
    perPct: 0,
    // П — надбавка за сезонность/риски, % (1per ∈ {0,1})
    storePct: 0,
    // Х — хранение на складе, % (1hran ∈ {0,1})
    perOn: true,
    // 1per
    storeOn: false,
    // 1hran
    night: false,
    // работа в ночную смену
    holiday: false
    // работа в праздник
  });
  function normalizeResMeta(resource) {
    const out = {};
    for (const k of Object.keys(RESOURCE_DEFAULT_META)) {
      out[k] = resource && resource[k] !== void 0 && resource[k] !== null ? resource[k] : RESOURCE_DEFAULT_META[k];
    }
    return out;
  }
  function calcLimitedCosts(pz, nr, spres, laborTotal, settings, mode, method) {
    const s = settings || defaultFrameworkSettings();
    const rnd = (v) => roundMoney(v, mode, method);
    const smr = pz + nr + spres;
    const norm = (pct, base) => (Number(pct) || 0) / 100 * base;
    const vz = norm(s.vzPct, smr) + directSum("vz", resOf(settings));
    const zu = norm(s.zuPct, smr) + directSum("zu", resOf(settings));
    const pp = norm(s.ppPct, smr) + directSum("pp", resOf(settings));
    const rain = calcRain(laborTotal, s);
    const workerTransport = calcWorkerTransport(laborTotal, s);
    const np = (pz + nr) * (Number(s.npPct ?? 3) / 100);
    const garant = smr * ((Number(s.garantPct) || 0) / 100);
    return {
      vz: rnd(vz),
      zu: rnd(zu),
      pp: rnd(pp),
      rain: rnd(rain),
      workerTransport: rnd(workerTransport),
      np: rnd(np),
      garant: rnd(garant),
      total: rnd(vz + zu + pp + rain + workerTransport + np + garant)
    };
  }
  var _limitedRows = [];
  function resOf(_settings) {
    return _limitedRows;
  }
  function directSum(kind, rows) {
    let sum = 0;
    for (const r of rows) if (r.kind === kind) sum += (Number(r.qty) || 0) * (Number(r.price) || 0);
    return sum;
  }
  function calcWorkerTransport(_laborTotal, s) {
    const consumption = Number(s.fuelPer100) || 0;
    const km = Number(s.workerDistanceKm) || 0;
    const fuelPrice = Number(s.fuelPrice) || 0;
    const days = Number(s.workDays) || 0;
    return consumption / 100 * km * 2 * fuelPrice * 1.05 * days;
  }
  function calcRain(laborTotal, s) {
    const months = Array.isArray(s.rainMonths) ? s.rainMonths : [];
    if (!months.length) {
      const d = Number(s.rainDays) || 0;
      const D = Number(s.monthDays) || 30;
      return laborTotal * (Number(s.rainKLoss) || 0) * (Number(s.rainProb) || 0) * (d / D);
    }
    const share = laborTotal / months.length;
    let sum = 0;
    for (const m of months) {
      sum += share * (Number(m.kLoss) || 0) * (Number(m.prob) || 0) * ((Number(m.rainDays) || 0) / (Number(m.monthDays) || 30));
    }
    return sum;
  }
  function calcTax(baseWithoutTax, s) {
    return baseWithoutTax * (Number(s.usnPct ?? 6) / 100);
  }
  function calcVehicleTax(s, durationMonths) {
    const months = Number(durationMonths) || Number(s.buildMonths) || 0;
    const yearly = (Number(s.vehicleTaxYear) || 0) + (Number(s.insuranceYear) || 0);
    return months / 12 * yearly;
  }
  function calcReturnable(resources, s) {
    let scrapMassT = 0;
    for (const r of resources || []) {
      if (r.type !== "material") continue;
      const wg = r.wasteGroup;
      if (wg !== "metal" && wg !== "pipe" && wg !== "cable") continue;
      const mass = Number(r.unitMassT) || 0;
      if (!mass) continue;
      const q = Number(r.qty) || 0;
      scrapMassT += q * (1 + wasteK(wg)) * mass * wasteK(wg);
    }
    const scrapRevenue = scrapMassT * (Number(s.scrapPricePerTon) || 0);
    const liquidation = Number(s.vzLiquidation) || 0;
    return {
      scrap: roundMoney(scrapRevenue, "kopecks", "math"),
      liquidation,
      total: roundMoney(scrapRevenue + liquidation, "kopecks", "math")
    };
  }
  function defaultFrameworkSettings() {
    return {
      enabled: true,
      // каркасный метод v2.0 — единственный расчёт в программе
      npPct: 3,
      // НП = 3% (каркас: стандартная предсказуемость)
      usnPct: 6,
      // Налог_УСН = 6%
      dRyn: 0,
      // d_рын — рыночная надбавка к сметной прибыли, ₽ (СП = Н_сп*Б_сп + d_рын)
      kNight: 1.3,
      // k_ночн ∈ [1.2; 1.5] — работа в ночь/праздник (Labor_Condition)
      vzPct: 3,
      // ВЗ, % от С_СМР (нормативный способ)
      zuPct: 0,
      // ЗУ (для каркаса в тёплый период обычно 0)
      ppPct: 0,
      // ПП, % от С_СМР
      garantPct: 0,
      // Гарантийное удержание (3–5%), влияет на cash flow
      // Транспорт персонала
      fuelPer100: 12,
      // Расход_л_100, л/100км
      fuelPrice: 60,
      // Цена_топл, ₽/л
      workerDistanceKm: 0,
      // L_км до объекта (в одну сторону)
      workDays: 0,
      // Дни_раб — фактические дни присутствия бригады
      // Дожди (упрощённый однофазный режим; для помесячного — rainMonths)
      rainDays: 0,
      // d_дождь, дни
      monthDays: 30,
      // D_мес, дни
      rainKLoss: 0.1,
      // k_потерь ∈ [0.05; 0.30]
      rainProb: 0.5,
      // p_вероятн
      rainMonths: [],
      // [{kLoss, prob, rainDays, monthDays}, ...]
      // Техника: налоги/страховка
      buildMonths: 2,
      // T_стр_мес (1–3)
      vehicleTaxYear: 0,
      // Н_транспортный_год, ₽
      insuranceYear: 0,
      // ОСАГО/КАСКО, ₽/год
      // Возвратные суммы
      scrapPricePerTon: 15e3,
      // реализация металлолома, ₽/т
      vzLiquidation: 0
      // ликвидационная стоимость ВЗ, ₽
    };
  }
  function calcFrameworkTotals(project, { pz, nr, sp, laborTotal, mode, method }) {
    const s = { ...defaultFrameworkSettings(), ...project?.framework || {} };
    const rnd = (v) => roundMoney(v, mode, method);
    const lz = calcLimitedCosts(pz, nr, sp, laborTotal, s, mode, method);
    const durationDays = Number(project?.durationDays) || 0;
    const durationMonths = durationDays > 0 ? durationDays / 30 : Number(s.buildMonths) || 0;
    const vehicleTax = rnd(calcVehicleTax(s, durationMonths));
    const subtotal = pz + nr + sp + lz.total + vehicleTax;
    const tax = rnd(calcTax(subtotal, s));
    const returnable = calcReturnable(flatResources(project), s);
    const grand = roundMoney(subtotal + tax - returnable.total, mode, method);
    return {
      settings: s,
      pz,
      nr,
      sp,
      lzParts: lz,
      lz: lz.total,
      vehicleTax,
      tax,
      returnable,
      sNoTax: rnd(subtotal),
      grand
    };
  }
  function flatResources(project) {
    const out = [];
    for (const sec of project?.sections || []) {
      for (const r of sec.resources || []) out.push(r);
      for (const sub of sec.children || []) {
        for (const r of sub.resources || []) out.push(r);
      }
    }
    return out;
  }
  function frameworkRowCost(resource, settings = null) {
    const q = Number(resource.qty) || 0;
    const meta = normalizeResMeta(resource);
    const s = settings || defaultFrameworkSettings();
    if (resource.type === "labor") {
      const rate = laborRateFact(resource.price, {
        night: !!meta.night,
        holiday: !!meta.holiday,
        kNight: Number(s.kNight) || 1.3
      });
      return {
        qtyFact: q,
        priceFull: rate,
        total: q * rate,
        parts: { markup: rate - (Number(resource.price) || 0) }
      };
    }
    if (resource.type === "machine") {
      const rate = meta.night || meta.holiday ? q * (Number(resource.price) || 0) * (Number(s.kNight) || 1.3) / q : Number(resource.price) || 0;
      return { qtyFact: q, priceFull: rate, total: q * rate, parts: {} };
    }
    const qtyFact = factQty(q, meta.wasteGroup);
    const m = { ...meta, qty: q, perUnit: meta.perUnit || Number(resource.price) || 0 };
    const fp = resourceFullPrice(m, s);
    return {
      qtyFact,
      priceFull: fp.priceFull,
      total: qtyFact * fp.priceFull,
      parts: {
        delivery: fp.delivery * qtyFact,
        unloading: fp.unloading * qtyFact,
        surchPer: fp.surchPer * qtyFact,
        surchStore: fp.surchStore * qtyFact
      }
    };
  }

  // src/ts/services/calculation.ts
  function calculateProjectTotals(project) {
    const totals = calculateFrameworkTotals(project);
    if (totals) return totals;
    return {
      settings: defaultFrameworkSettings(),
      labor: 0,
      machine: 0,
      material: 0,
      laborRaw: 0,
      pz: 0,
      nr: 0,
      sp: 0,
      vat: 0,
      lz: 0,
      lzParts: null,
      tax: 0,
      vehicleTax: 0,
      returnable: { scrap: 0, liquidation: 0, total: 0 },
      sNoTax: 0,
      grand: 0,
      framework: true
    };
  }
  function calculateFrameworkTotals(project) {
    if (!project || !Array.isArray(project.sections)) return null;
    let laborRaw = 0;
    let labor = 0, machine = 0, material = 0;
    const fwSettings = project.framework || {};
    for (const sec of project.sections) {
      const walk = (s) => {
        for (const r of s.resources || []) {
          const c = frameworkRowCost(r, fwSettings);
          if (r.type === "labor") {
            labor += c.total;
            laborRaw += (Number(r.qty) || 0) * (Number(r.price) || 0);
          } else if (r.type === "machine") machine += c.total;
          else material += c.total;
        }
        for (const sub of s.children || []) walk(sub);
      };
      walk(sec);
    }
    const mode = project.rounding?.mode || "kopecks";
    const method = project.rounding?.method || "math";
    const pz = labor + machine + material;
    const baseFor = (base) => base === "pz" ? pz : labor;
    const nr = roundMoney(
      baseFor(project.rates?.overheadBase) * (Number(project.rates?.overheadPct) || 0) / 100,
      mode,
      method
    );
    const sp = roundMoney(
      baseFor(project.rates?.profitBase) * (Number(project.rates?.profitPct) || 0) / 100 + (Number(fwSettings.dRyn) || 0),
      mode,
      method
    );
    const durationDays = calculateProjectDuration(project);
    const totals = calcFrameworkTotals(
      { ...project || {}, durationDays },
      { pz, nr, sp, laborTotal: labor, mode, method }
    );
    return { ...totals, labor, machine, material, laborRaw, durationDays, vat: 0, framework: true };
  }
  function calculateSectionDuration(section) {
    if (!Section.validate(section) || !section.resources.length) {
      return 0;
    }
    let maxDay = 0;
    for (const resource of section.resources) {
      const days = Number(resource.days);
      if (resource.days !== null && isFinite(days) && days > maxDay) {
        maxDay = days;
      }
    }
    return maxDay;
  }
  function calculateProjectDuration(project) {
    if (!project || !project.sections) {
      return 0;
    }
    let totalDuration = 0;
    for (const section of project.sections) {
      const sectionDuration = calculateSectionDuration(section);
      totalDuration += sectionDuration;
    }
    return totalDuration;
  }

  // src/ts/services/export.ts
  function exportToCsv(project, columns = null) {
    if (!Project.validate(project)) {
      throw new Error("Invalid project data");
    }
    const defaultColumns = ["basis", "name", "type", "unit", "qty", "price", "total", "note"];
    const cols = columns || defaultColumns;
    const lines = [];
    lines.push(cols.map((col) => getColumnLabel(col)).join(";"));
    for (const section of project.sections) {
      lines.push(`;${section.name};;;;;;`);
      for (const resource of section.resources) {
        const formatted = Resource.formatForDisplay(resource);
        const row = cols.map((col) => {
          const value = formatted[col] !== void 0 ? formatted[col] : "";
          return formatCsvValue(value);
        });
        lines.push(row.join(";"));
      }
      lines.push("");
    }
    return lines.join("\n");
  }
  function getColumnLabel(key) {
    const labels = {
      basis: "\u041E\u0431\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435",
      name: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u0440\u0430\u0431\u043E\u0442\u044B \u0438 \u0437\u0430\u0442\u0440\u0430\u0442",
      type: "\u0422\u0438\u043F \u0437\u0430\u0442\u0440\u0430\u0442",
      unit: "\u0415\u0434. \u0438\u0437\u043C.",
      qty: "\u041A\u043E\u043B-\u0432\u043E",
      price: "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0446\u0435\u043D\u0430, \u0440\u0443\u0431.",
      total: "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C, \u0440\u0443\u0431.",
      note: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435",
      days: "\u0414\u043B\u0438\u0442., \u0434\u043D\u0438",
      pred: "\u041F\u0440\u0435\u0435\u043C\u0441\u0442\u0432."
    };
    return labels[key] || key;
  }
  function formatCsvValue(value) {
    if (value === null || value === void 0) {
      return "";
    }
    if (typeof value === "number") {
      return value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    const str = String(value);
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // src/ts/services/validation.ts
  function validateProject(project) {
    const errors = [];
    if (!project || typeof project !== "object") {
      errors.push({
        field: "project",
        message: "\u041F\u0440\u043E\u0435\u043A\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C",
        type: "type"
      });
      return { valid: false, errors };
    }
    if (!project.title || typeof project.title !== "string") {
      errors.push({
        field: "title",
        message: "\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439",
        type: "required"
      });
    }
    if (!Array.isArray(project.sections)) {
      errors.push({
        field: "sections",
        message: "\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u043C\u0430\u0441\u0441\u0438\u0432\u043E\u043C",
        type: "type"
      });
    } else {
      for (let i = 0; i < project.sections.length; i++) {
        const sectionResult = validateSection(project.sections[i]);
        if (!sectionResult.valid) {
          sectionResult.errors.forEach((error) => {
            errors.push({
              field: `sections[${i}].${error.field}`,
              message: `\u0420\u0430\u0437\u0434\u0435\u043B "${project.sections[i]?.name || i}": ${error.message}`,
              type: error.type
            });
          });
        }
      }
    }
    if (project.rates && typeof project.rates === "object") {
      const ratesResult = validateRates(project.rates);
      if (!ratesResult.valid) {
        ratesResult.errors.forEach((error) => {
          errors.push({
            field: `rates.${error.field}`,
            message: error.message,
            type: error.type
          });
        });
      }
    }
    if (project.rounding && typeof project.rounding === "object") {
      const roundingResult = validateRounding(project.rounding);
      if (!roundingResult.valid) {
        roundingResult.errors.forEach((error) => {
          errors.push({
            field: `rounding.${error.field}`,
            message: error.message,
            type: error.type
          });
        });
      }
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
  function validateSection(section) {
    const errors = [];
    if (!section || typeof section !== "object") {
      errors.push({
        field: "section",
        message: "\u0420\u0430\u0437\u0434\u0435\u043B \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C",
        type: "type"
      });
      return { valid: false, errors };
    }
    if (!section.id || typeof section.id !== "string") {
      errors.push({
        field: "id",
        message: "ID \u0440\u0430\u0437\u0434\u0435\u043B\u0430 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439",
        type: "required"
      });
    }
    if (!section.name || typeof section.name !== "string") {
      errors.push({
        field: "name",
        message: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u0430 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439",
        type: "required"
      });
    }
    if (!Array.isArray(section.resources)) {
      errors.push({
        field: "resources",
        message: "\u0420\u0435\u0441\u0443\u0440\u0441\u044B \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u043C\u0430\u0441\u0441\u0438\u0432\u043E\u043C",
        type: "type"
      });
    } else {
      for (let i = 0; i < section.resources.length; i++) {
        const resourceResult = validateResource(section.resources[i]);
        if (!resourceResult.valid) {
          resourceResult.errors.forEach((error) => {
            errors.push({
              field: `resources[${i}].${error.field}`,
              message: `\u0420\u0435\u0441\u0443\u0440\u0441 ${i + 1}: ${error.message}`,
              type: error.type
            });
          });
        }
      }
    }
    if (section.parentId !== null && typeof section.parentId !== "string") {
      errors.push({
        field: "parentId",
        message: "parentId \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439 \u0438\u043B\u0438 null",
        type: "type"
      });
    }
    if (typeof section.collapsed !== "boolean") {
      errors.push({
        field: "collapsed",
        message: "collapsed \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0431\u0443\u043B\u0435\u0432\u044B\u043C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\u043C",
        type: "type"
      });
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
  function validateResource(resource) {
    const errors = [];
    if (!resource || typeof resource !== "object") {
      errors.push({
        field: "resource",
        message: "\u0420\u0435\u0441\u0443\u0440\u0441 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C",
        type: "type"
      });
      return { valid: false, errors };
    }
    if (!resource.id || typeof resource.id !== "string") {
      errors.push({
        field: "id",
        message: "ID \u0440\u0435\u0441\u0443\u0440\u0441\u0430 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439",
        type: "required"
      });
    }
    if (typeof resource.name !== "string") {
      errors.push({
        field: "name",
        message: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0440\u0435\u0441\u0443\u0440\u0441\u0430 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439",
        type: "type"
      });
    }
    if (!["labor", "machine", "material"].includes(resource.type)) {
      errors.push({
        field: "type",
        message: "\u0422\u0438\u043F \u0440\u0435\u0441\u0443\u0440\u0441\u0430 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C labor, machine \u0438\u043B\u0438 material",
        type: "enum"
      });
    }
    if (typeof resource.qty !== "number" || resource.qty < 0) {
      errors.push({
        field: "qty",
        message: "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u0447\u0438\u0441\u043B\u043E\u043C >= 0",
        type: "range"
      });
    }
    if (typeof resource.price !== "number" || resource.price < 0) {
      errors.push({
        field: "price",
        message: "\u0426\u0435\u043D\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u0447\u0438\u0441\u043B\u043E\u043C >= 0",
        type: "range"
      });
    }
    if (typeof resource.unit !== "string") {
      errors.push({
        field: "unit",
        message: "\u0415\u0434\u0438\u043D\u0438\u0446\u0430 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439",
        type: "type"
      });
    }
    if (resource.type === "machine" && typeof resource.operator !== "boolean") {
      errors.push({
        field: "operator",
        message: "\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0431\u0443\u043B\u0435\u0432\u044B\u043C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\u043C \u0434\u043B\u044F \u043C\u0430\u0448\u0438\u043D",
        type: "type"
      });
    }
    if (resource.days !== null && (typeof resource.days !== "number" || resource.days < 0)) {
      errors.push({
        field: "days",
        message: "\u0414\u043D\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u0447\u0438\u0441\u043B\u043E\u043C >= 0 \u0438\u043B\u0438 null",
        type: "range"
      });
    }
    if (typeof resource.note !== "string") {
      errors.push({
        field: "note",
        message: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439",
        type: "type"
      });
    }
    if (typeof resource.pred !== "string") {
      errors.push({
        field: "pred",
        message: "\u041F\u0440\u0435\u0435\u043C\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439",
        type: "type"
      });
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
  function validateRates(rates) {
    const errors = [];
    if (!rates || typeof rates !== "object") {
      errors.push({
        field: "rates",
        message: "\u0421\u0442\u0430\u0432\u043A\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C",
        type: "type"
      });
      return { valid: false, errors };
    }
    if (typeof rates.overheadPct !== "number" || rates.overheadPct < 0) {
      errors.push({
        field: "overheadPct",
        message: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u044B\u0445 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0447\u0438\u0441\u043B\u043E\u043C >= 0",
        type: "range"
      });
    }
    if (!["labor", "pz"].includes(rates.overheadBase)) {
      errors.push({
        field: "overheadBase",
        message: "\u0411\u0430\u0437\u0430 \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u044B\u0445 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C labor \u0438\u043B\u0438 pz",
        type: "enum"
      });
    }
    if (typeof rates.profitPct !== "number" || rates.profitPct < 0) {
      errors.push({
        field: "profitPct",
        message: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u043F\u0440\u0438\u0431\u044B\u043B\u0438 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0447\u0438\u0441\u043B\u043E\u043C >= 0",
        type: "range"
      });
    }
    if (!["labor", "pz"].includes(rates.profitBase)) {
      errors.push({
        field: "profitBase",
        message: "\u0411\u0430\u0437\u0430 \u043F\u0440\u0438\u0431\u044B\u043B\u0438 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C labor \u0438\u043B\u0438 pz",
        type: "enum"
      });
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
  function validateRounding(rounding) {
    const errors = [];
    if (!rounding || typeof rounding !== "object") {
      errors.push({
        field: "rounding",
        message: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043E\u043A\u0440\u0443\u0433\u043B\u0435\u043D\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C",
        type: "type"
      });
      return { valid: false, errors };
    }
    if (!["kopecks", "rubles"].includes(rounding.mode)) {
      errors.push({
        field: "mode",
        message: "\u0420\u0435\u0436\u0438\u043C \u043E\u043A\u0440\u0443\u0433\u043B\u0435\u043D\u0438\u044F \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C kopecks \u0438\u043B\u0438 rubles",
        type: "enum"
      });
    }
    if (!["math", "bank", "truncate"].includes(rounding.method)) {
      errors.push({
        field: "method",
        message: "\u041C\u0435\u0442\u043E\u0434 \u043E\u043A\u0440\u0443\u0433\u043B\u0435\u043D\u0438\u044F \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C math, bank \u0438\u043B\u0438 truncate",
        type: "enum"
      });
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // src/ts/office.ts
  function xmlEsc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function svgToPng(svgMarkup, scale, callback) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = svgMarkup;
    const svg = wrapper.querySelector("svg");
    const W = Number(svg.getAttribute("width")) || 1200;
    const H = Number(svg.getAttribute("height")) || 600;
    const k = scale || 2;
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarkup);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W * k;
      canvas.height = H * k;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => callback(blob), "image/png");
    };
    img.onerror = () => callback(null);
    img.src = url;
  }

  // src/ts/utils/formatters.ts
  function formatMoney(value, currency = "RUB", options = {}) {
    const n = Number(value) || 0;
    const defaultOptions = {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      currency,
      ...options
    };
    try {
      return n.toLocaleString("ru-RU", defaultOptions);
    } catch (e) {
      return formatMoneyFallback(n, defaultOptions);
    }
  }
  function formatMoneyFallback(value, options) {
    const n = Number(value) || 0;
    const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;
    const parts = n.toFixed(Math.max(minimumFractionDigits, maximumFractionDigits)).split(".");
    let integerPart = parts[0];
    let fractionalPart = parts[1] || "";
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    if (fractionalPart.length > maximumFractionDigits) {
      fractionalPart = fractionalPart.slice(0, maximumFractionDigits);
    }
    while (fractionalPart.length < minimumFractionDigits) {
      fractionalPart += "0";
    }
    return fractionalPart ? `${integerPart},${fractionalPart}` : integerPart;
  }

  // src/ts/app.ts
  var PAGE_SIZE = 50;
  var LS_KEY = STORAGE_KEYS.DATA;
  var LS_MIGRATE_FROM = STORAGE_KEYS.MIGRATE_FROM;
  var LS_NSB_KEY = STORAGE_KEYS.NSB;
  var LS_RESOURCES_KEY = STORAGE_KEYS.RESOURCES;
  var LS_UI_KEY = STORAGE_KEYS.UI;
  var LS_HISTORY_KEY = STORAGE_KEYS.HISTORY;
  var LS_COLS_KEY = STORAGE_KEYS.COLS;
  var LS_PRINT_KEY = STORAGE_KEYS.PRINT;
  var uidCounter2 = 0;
  function uid() {
    return `id-${Date.now().toString(36)}-${(uidCounter2++).toString(36)}`;
  }
  function loadLocal() {
    try {
      const data = localStorage.getItem(LS_KEY);
      if (data) {
        const project = decodeValue(LS_KEY, data);
        if (validateProject(project).valid) {
          return project;
        }
      }
      const oldData = localStorage.getItem(LS_MIGRATE_FROM);
      if (oldData) {
        const migrated = migrateV3toV4(JSON.parse(oldData));
        saveProject(migrated);
        localStorage.removeItem(LS_MIGRATE_FROM);
        return migrated;
      }
      return null;
    } catch (e) {
      console.error("Failed to load project:", e);
      return null;
    }
  }
  function loadNsb() {
    try {
      const data = localStorage.getItem(LS_NSB_KEY);
      return data ? decodeValue(LS_NSB_KEY, data) : defaultNsb();
    } catch (e) {
      return defaultNsb();
    }
  }
  function loadResources() {
    try {
      const data = localStorage.getItem(LS_RESOURCES_KEY);
      return data ? decodeValue(LS_RESOURCES_KEY, data) : [];
    } catch (e) {
      return [];
    }
  }
  function loadActivity() {
    try {
      const data = localStorage.getItem(LS_HISTORY_KEY);
      return data ? decodeValue(LS_HISTORY_KEY, data) : [];
    } catch (e) {
      return [];
    }
  }
  function defaultNsb() {
    return [
      Resource.create({
        id: uid(),
        basis: "\u0413\u044D\u0441\u043D 81-02-01-01-01",
        name: "\u0420\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u0433\u0440\u0443\u043D\u0442\u0430 \u044D\u043A\u0441\u043A\u0430\u0432\u0430\u0442\u043E\u0440\u043E\u043C \u043F\u043E\u0434 \u0444\u0443\u043D\u0434\u0430\u043C\u0435\u043D\u0442\u044B",
        type: "labor",
        unit: "\u0447\u0435\u043B.-\u0447",
        price: 250,
        note: "\u0421\u0440\u0435\u0434\u043D\u0438\u0439 \u0440\u0430\u0437\u0440\u044F\u0434 \u0440\u0430\u0431\u043E\u0447\u0438\u0445"
      }),
      Resource.create({
        id: uid(),
        basis: "\u0424\u0415\u0420\u0440-81-02-14-01-01",
        name: "\u041C\u043E\u043D\u0442\u0430\u0436 \u043A\u0430\u0440\u043A\u0430\u0441\u0430 \u041B\u0421\u0422\u041A (\u0441\u0442\u0435\u043D\u043A\u0438, \u043F\u0435\u0440\u0435\u043A\u0440\u044B\u0442\u0438\u044F)",
        type: "labor",
        unit: "\u0447\u0435\u043B.-\u0447",
        price: 320,
        note: "\u0417\u041F_\u0431\u0430\u0437\u0430; \u0432 \u0440\u0430\u0441\u0447\u0451\u0442\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043D\u0430\u0446\u0435\u043D\u043A\u0430 \xD71.20 (k_\u043D\u043E\u0447\u043D \u2014 \u043F\u0440\u0438 \u043D\u043E\u0447\u044C/\u043F\u0440\u0430\u0437\u0434\u043D\u0438\u043A)"
      }),
      Resource.create({
        id: uid(),
        basis: "\u041D\u0421\u0411-\u041C\u0422\u041B-\u041B\u0421\u0422\u041A-01",
        name: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u041B\u0421\u0422\u041A C90x50x3 \u043C\u043C",
        type: "material",
        unit: "\u043C.\u043F.",
        price: 410,
        wasteGroup: "metal",
        perUnit: 385,
        unitMassT: 43e-4,
        vehicleCapT: 10,
        distanceKm: 45,
        tariffPerKm: 95,
        supplyFee: 1500,
        manipulatorFlag: true,
        unloadMachineHr: 1200,
        unloadHours: 0.5,
        perPct: 4,
        storePct: 2,
        storeOn: true,
        note: "p_\u043F\u043E\u043B\u043D = p_\u043E\u0442\u043F + \u043F\u0435\u0440\u0435\u0432\u043E\u0437\u043A\u0430 + \u0440\u0430\u0437\u0433\u0440\u0443\u0437\u043A\u0430 + \u041F + \u0425 (\u0442\u0430\u0440\u0430/\u043F\u043E\u0433\u0440\u0443\u0437\u043A\u0430 \u2014 \u043F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A)"
      }),
      Resource.create({
        id: uid(),
        basis: "\u0413\u044D\u0441\u043D\u0440 81-02-01-01-01",
        name: "\u042D\u043A\u0441\u043A\u0430\u0432\u0430\u0442\u043E\u0440 \u043E\u0434\u043D\u043E\u043A\u043E\u0432\u0448\u043E\u0432\u044B\u0439 0,4 \u043C\xB3",
        type: "machine",
        operator: true,
        unit: "\u043C\u0430\u0448.-\u0447",
        price: 1450,
        note: "\u0412\u043A\u043B. \u0422\u043C\u0440"
      }),
      Resource.create({
        id: uid(),
        basis: "\u0413\u044D\u0441\u043D 81-02-03-01-01",
        name: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0431\u0435\u0442\u043E\u043D\u043D\u044B\u0445 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043E\u043A",
        type: "labor",
        unit: "\u0447\u0435\u043B.-\u0447",
        price: 275,
        note: ""
      }),
      Resource.create({
        id: uid(),
        basis: "\u0424\u0435\u0440 81-02-05-01-01",
        name: "\u041C\u043E\u043D\u0442\u0430\u0436 \u0444\u0443\u043D\u0434\u0430\u043C\u0435\u043D\u0442\u043D\u044B\u0445 \u0431\u043B\u043E\u043A\u043E\u0432",
        type: "labor",
        unit: "\u0447\u0435\u043B.-\u0447",
        price: 310,
        note: ""
      }),
      Resource.create({
        id: uid(),
        basis: "\u0420\u0435\u0441\u0443\u0440\u0441-01",
        name: "\u0411\u0435\u0442\u043E\u043D \u041222.5 (\u043C300)",
        type: "material",
        unit: "\u043C3",
        price: 6200,
        note: "\u0413\u041E\u0421\u0422 7473-2010"
      }),
      Resource.create({
        id: uid(),
        basis: "\u0420\u0435\u0441\u0443\u0440\u0441-02",
        name: "\u041F\u0435\u0441\u043E\u043A \u0441\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439",
        type: "material",
        unit: "\u0442",
        price: 890,
        note: "\u041A\u0430\u0440\u044C\u0435\u0440"
      }),
      Resource.create({
        id: uid(),
        basis: "\u0420\u0435\u0441\u0443\u0440\u0441-03",
        name: "\u0429\u0435\u0431\u0435\u043D\u044C \u0444\u0440. 5-20 \u043C\u043C",
        type: "material",
        unit: "\u0442",
        price: 1650,
        note: ""
      }),
      Resource.create({
        id: uid(),
        basis: "\u0420\u0435\u0441\u0443\u0440\u0441-04",
        name: "\u0410\u0440\u043C\u0430\u0442\u0443\u0440\u0430 \u0410500\u0421 \xD812",
        type: "material",
        unit: "\u0442",
        price: 62e3,
        note: ""
      }),
      Resource.create({
        id: uid(),
        basis: "\u0413\u044D\u0441\u043D\u043C 81-03",
        name: "\u041A\u0440\u0430\u043D \u0441\u0442\u0440\u0435\u043B\u043E\u0432\u043E\u0439 25 \u0442",
        type: "machine",
        unit: "\u043C\u0430\u0448.-\u0447",
        price: 3800,
        note: "\u0412\u043A\u043B. \u0422\u043C\u0440"
      })
    ];
  }
  function defaultData() {
    return Project.default();
  }
  function resKey(r) {
    return Resource.getKey(r);
  }
  function newSection(name) {
    return Section.create(name);
  }
  function newRow(partial = {}) {
    return Object.assign(
      Resource.create({}),
      {
        days: null,
        pred: "",
        startAt: null,
        operator: false
      },
      partial
    );
  }
  function copyFrameworkFields(from, to) {
    const KEYS = [
      "wasteGroup",
      "perUnit",
      "unitMassT",
      "vehicleCapT",
      "distanceKm",
      "tariffPerKm",
      "supplyFee",
      "kGabarit",
      "manipulatorFlag",
      "unloadMachineHr",
      "unloadHours",
      "moveDistM",
      "moveSpeedMh",
      "perPct",
      "storePct",
      "perOn",
      "storeOn",
      "night",
      "holiday"
    ];
    for (const k of KEYS) {
      if (from[k] !== void 0 && from[k] !== null) to[k] = from[k];
    }
  }
  function defaultStartDate() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  var TOOLS = [
    {
      id: "smeta",
      icon: "\u{1F4CB}",
      name: "\u0421\u043C\u0435\u0442\u0430",
      description: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u0440\u0430\u0437\u0434\u0435\u043B\u043E\u0432 \u0438 \u0437\u0430\u043F\u0438\u0441\u0435\u0439, \u0441\u0432\u043E\u0434\u043D\u0430\u044F \u0432\u0435\u0434\u043E\u043C\u043E\u0441\u0442\u044C \u0440\u0435\u0441\u0443\u0440\u0441\u043E\u0432, \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u0430 \u0413\u0430\u043D\u0442\u0430. \u0414\u0430\u043D\u043D\u044B\u0435 \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435.",
      meta: "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442"
    }
  ];
  window.smeta = function smeta() {
    return {
      // ==========================================
      // Состояние
      // ==========================================
      // Главный экран: 'home' (карточки инструментов) | 'app' (смета)
      screen: "home",
      tools: TOOLS,
      // Данные проекта
      data: loadLocal() || defaultData(),
      // Сводная ведомость ресурсов (вид «Сводка»)
      // Группировки и сортировки запрещены — сводка всегда плоская.
      summarySearch: "",
      // Гант: подсветка критического пути (#49)
      ganttCritical: false,
      // Боковая панель истории: problems | log
      historyTab: "problems",
      // UI состояние
      filter: "",
      activeTab: null,
      renamingSection: null,
      tabDragFrom: null,
      tabDragOver: null,
      // si вкладки-цели при drag&drop разделов (подсветка drop-зоны)
      selectedIds: /* @__PURE__ */ new Set(),
      editing: null,
      expandedRow: null,
      sidebarCollapsed: true,
      // по умолчанию свёрнута — панель прячется полностью (кнопка «Показать сводку» / ручка ◀)
      sectionModalOpen: false,
      sectionModalMode: "create",
      sectionDraft: { name: "", index: null },
      recordModalOpen: false,
      recordDraft: null,
      fieldMenuFor: null,
      savedFlash: false,
      lastSavedAt: null,
      // UI v4
      viewTab: "table",
      page: 0,
      historyOpen: false,
      dragRow: null,
      // drag&drop строк между разделами (#26)
      activityLog: loadActivity(),
      undoStack: [],
      redoStack: [],
      _histBusy: false,
      ctxMenu: null,
      batchBar: false,
      batchPrice: "",
      batchQty: "",
      batchUnit: "",
      cursor: -1,
      calcTab: "labor",
      calc: {
        volume: 100,
        // объём работ в единице из сметы
        normTime: 1.2,
        // чел-ч (или machine-часы) на единицу объёма
        crewSize: 3,
        // бригада, чел. (для машин — звено механизаторов)
        shiftsPerDay: 1,
        // смен в день
        hoursPerShift: 8,
        // часов в смене
        ratePerHour: 250,
        // стоимость одного чел-ч / маш-ч, руб.
        days: null
        // обратный расчёт: задан срок → подобрать состав
      },
      calcModalOpen: false,
      projModalOpen: false,
      resModalOpen: false,
      resSearch: "",
      resources: loadResources(),
      dirty: false,
      ganttDrag: null,
      ganttLinkFrom: null,
      ganttLinkPath: null,
      rowDropTarget: null,
      // { key: 'si|id', pos: 'above'|'below' } — подсветка drop-зоны строки
      droppedRowId: null,
      // id переставленной строки — зелёная вспышка row-dropped после drop
      // Настройки печати
      printOrientation: "landscape",
      printModalOpen: false,
      printSettings: loadPrintSettings(),
      // Модальные окна
      helpModalOpen: false,
      topMenuOpen: false,
      // выпадающее меню «Меню» в шапке (GitHub-style)
      sectionDropdownOpen: false,
      // список разделов «раскрыть вверх» (AutoCAD-листы, внизу таблицы)
      nsbModalOpen: false,
      nsbSearch: "",
      nsbItems: loadNsb(),
      nsbEditId: null,
      nsbDraft: null,
      // Колонки таблицы (сортировка запрещена — порядок ручной / разделами)
      columns: [
        { key: "num", label: "#", width: 44, min: 34 },
        { key: "basis", label: "\u041E\u0431\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435", width: 120, min: 70 },
        { key: "name", label: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u0440\u0430\u0431\u043E\u0442\u044B \u0438 \u0437\u0430\u0442\u0440\u0430\u0442", width: 300, min: 140 },
        { key: "type", label: "\u0422\u0438\u043F \u0437\u0430\u0442\u0440\u0430\u0442", width: 150, min: 110 },
        { key: "unit", label: "\u0415\u0434. \u0438\u0437\u043C.", width: 90, min: 60 },
        { key: "qty", label: "\u041A\u043E\u043B-\u0432\u043E", width: 100, min: 70 },
        { key: "price", label: "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0446\u0435\u043D\u0430, \u0440\u0443\u0431.", width: 120, min: 80 },
        { key: "total", label: "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C, \u0440\u0443\u0431.", width: 130, min: 90 },
        { key: "note", label: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435", width: 190, min: 90 },
        { key: "days", label: "\u0414\u043B\u0438\u0442., \u0434\u043D\u0438", width: 90, min: 60 },
        { key: "pred", label: "\u041F\u0440\u0435\u0435\u043C\u0441\u0442\u0432.", width: 90, min: 60 },
        { key: "actions", label: "", width: 118, min: 118 }
      ],
      // ==========================================
      // Вычисляемые свойства
      // ==========================================
      /**
       * Плоский список ресурсов со ссылками на разделы
       */
      get flatRows() {
        const result = [];
        const scope = this.scopedSections;
        for (const { sec, si } of scope) {
          for (let ri = 0; ri < sec.resources.length; ri++) {
            result.push({ si, row: sec.resources[ri], section: sec });
          }
        }
        return result;
      },
      /**
       * Отфильтрованные ресурсы
       */
      get filteredRows() {
        const f = this.filter.trim().toLowerCase();
        if (!f) return this.flatRows;
        return this.flatRows.filter(({ row }) => {
          return row.name.toLowerCase().includes(f) || row.basis.toLowerCase().includes(f) || row.unit.toLowerCase().includes(f) || row.note.toLowerCase().includes(f) || String(row.qty).includes(f) || String(row.price).includes(f);
        });
      },
      /**
       * Плоский список ресурсов текущей области просмотра.
       * ⛔ Сортировки и группировки запрещены (см. README «⛔ Запрещено»):
       *    порядок только ручной (перетаскивание/↑↓) и разделами сметы.
       */
      get flatViewRows() {
        return this.filteredRows;
      },
      /**
       * Пагинированные ресурсы (50 строк на страницу)
       */
      get pagedRows() {
        const start = this.page * PAGE_SIZE;
        return this.flatViewRows.slice(start, start + PAGE_SIZE);
      },
      /**
       * Общее количество страниц
       */
      get totalPages() {
        return Math.ceil(this.flatViewRows.length / PAGE_SIZE);
      },
      /**
       * Видимые колонки
       */
      visibleColumns() {
        return this.columns.filter((c) => !this.hiddenCols.includes(c.key));
      },
      /**
       * Проверяет, скрыта ли колонка
       */
      colHidden(key) {
        return this.hiddenCols.includes(key);
      },
      /**
       * Получает метку колонки
       */
      colLabel(key) {
        const col = this.columns.find((c) => c.key === key);
        return col ? col.label : key;
      },
      /**
       * Количество выбранных ресурсов
       */
      selectedCount() {
        return this.selectedIds.size;
      },
      /**
       * Проверяет, выбран ли ресурс
       */
      isSelected(rowId) {
        return this.selectedIds.has(rowId);
      },
      /* ---------- проблемы сметы (#10, перенос legacy — фаза 1) ---------- */
      get problems() {
        const list = [];
        let n = 0;
        for (let si = 0; si < this.data.sections.length; si++) {
          const sec = this.data.sections[si];
          if (!sec.name.trim())
            list.push({ sev: "warn", text: `\u0420\u0430\u0437\u0434\u0435\u043B ${si + 1}: \u043F\u0443\u0441\u0442\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435`, si });
          for (const r of sec.resources) {
            n++;
            const label = `\u2116${n} \xAB${(r.name || "").trim() || "\u0431\u0435\u0437 \u043D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u044F"}\xBB`;
            if (!(String(r.name).trim() || String(r.basis).trim()))
              list.push({
                sev: "err",
                text: `${label}: \u043F\u0443\u0441\u0442\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C (\u043D\u0435\u0442 \u043D\u0438 \u043D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u044F, \u043D\u0438 \u043E\u0431\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F)`,
                si,
                id: r.id
              });
            else {
              if (!String(r.basis).trim())
                list.push({
                  sev: "warn",
                  text: `${label}: \u043D\u0435\u0442 \u043E\u0431\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F (\u0448\u0438\u0444\u0440\u0430 \u0440\u0430\u0441\u0446\u0435\u043D\u043A\u0438)`,
                  si,
                  id: r.id
                });
              if ((Number(r.price) || 0) <= 0)
                list.push({
                  sev: "err",
                  text: `${label}: \u0446\u0435\u043D\u0430 \u2264 0 \u2014 \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u043D\u0435 \u0444\u043E\u0440\u043C\u0438\u0440\u0443\u0435\u0442\u0441\u044F`,
                  si,
                  id: r.id
                });
              if ((Number(r.qty) || 0) <= 0)
                list.push({ sev: "warn", text: `${label}: \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u2264 0`, si, id: r.id });
              if (!String(r.unit).trim())
                list.push({
                  sev: "warn",
                  text: `${label}: \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430 \u0435\u0434\u0438\u043D\u0438\u0446\u0430 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F`,
                  si,
                  id: r.id
                });
            }
          }
        }
        return list;
      },
      /**
       * Количество проблем (для значка), опционально с фильтром по severity
       */
      problemCount(sev) {
        return this.problems.filter((p) => !sev || p.sev === sev).length;
      },
      goToProblem(p) {
        this.activeTab = null;
        this.page = 0;
        if (p.si !== null && p.si !== void 0) {
          this.activeTab = p.si;
          this.selectedIds = /* @__PURE__ */ new Set();
        }
        if (p.id) this.selectedIds = /* @__PURE__ */ new Set([p.id]);
        this.historyOpen = false;
      },
      /**
       * Текст для кнопки сохранения
       */
      savedTimeText() {
        if (this.savedFlash) return "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E";
        if (this.lastSavedAt) {
          return `\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E: ${new Date(this.lastSavedAt).toLocaleTimeString("ru-RU")}`;
        }
        return "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C";
      },
      /**
       * Ключ ресурса для группировки
       */
      resKey(r) {
        return Resource.getKey(r);
      },
      /**
       * Уникальные ресурсы
       */
      get resourceIndex() {
        const map = /* @__PURE__ */ new Map();
        for (const sec of this.data.sections) {
          for (const r of sec.resources) {
            const k = this.resKey(r);
            if (!k) continue;
            if (!map.has(k)) {
              map.set(k, {
                key: k,
                name: r.name,
                type: r.type,
                unit: r.unit,
                prices: /* @__PURE__ */ new Set(),
                uses: 0,
                sections: /* @__PURE__ */ new Set()
              });
            }
            const e = map.get(k);
            e.uses++;
            e.sections.add(sec.name);
            if (Number(r.price)) e.prices.add(Number(r.price));
          }
        }
        return map;
      },
      get uniqueResources() {
        const arr = [...this.resourceIndex.values()].map((e) => ({
          ...e,
          priceList: [...e.prices].sort((a, b) => a - b),
          sectionNames: [...e.sections]
        }));
        const f = this.resSearch.trim().toLowerCase();
        if (!f) return arr.sort((a, b) => a.name.localeCompare(b.name, "ru"));
        return arr.filter(
          (r) => r.name.toLowerCase().includes(f) || r.unit.toLowerCase().includes(f)
        );
      },
      // ==========================================
      // Инициализация
      // ==========================================
      init() {
        this.loadColWidths();
        this.loadUI();
        this.$watch(
          "data",
          () => {
            if (this.data.recalcMode === "manual") {
              this.dirty = true;
            } else {
              this.saveLocal();
            }
          },
          { deep: true }
        );
        this.$watch("columns", () => this.saveColWidths(), { deep: true });
        this.$watch("hiddenCols", () => this.saveUI());
        this.$watch("sidebarCollapsed", () => this.saveUI());
        window.addEventListener("keydown", (e) => this.handleKeyDown(e));
        window.addEventListener("beforeunload", (e) => this.handleBeforeUnload(e));
      },
      // ==========================================
      // Обработчики клавиш
      // ==========================================
      handleKeyDown(e) {
        const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
        if (e.key === "Escape") {
          this.editing = null;
          this.expandedRow = null;
          this.selectedIds = /* @__PURE__ */ new Set();
          this.sectionModalOpen = false;
          this.fieldMenuFor = null;
          this.ctxMenu = null;
          this.helpModalOpen = false;
          this.printModalOpen = false;
          this.calcModalOpen = false;
          this.projModalOpen = false;
          this.resModalOpen = false;
          this.historyOpen = false;
          this.batchBar = false;
          this.ganttLinkFrom = null;
          this.ganttLinkPath = null;
          if (this.nsbModalOpen) this.cancelNsbEdit();
          this.nsbModalOpen = false;
          if (this.recordModalOpen) this.cancelRecordModal();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !inField) {
          e.preventDefault();
          this.selectedIds = new Set(this.flatRows.map((i) => i.row.id));
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && this.selectedIds.size === 1) {
          const item = this.flatRows.find((i) => this.selectedIds.has(i.row.id));
          if (item) this.duplicateRowById(item.si, item.row.id);
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !inField) {
          e.preventDefault();
          e.shiftKey ? this.redoAction() : this.undoAction();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !inField) {
          e.preventDefault();
          this.redoAction();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          this.manualSave();
        }
        if (!inField && ["ArrowDown", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          this.moveGridCursor(e.key === "ArrowDown" ? 1 : -1);
        }
        if (!inField && e.key === "F2" && this.cursor >= 0) {
          e.preventDefault();
          const items = this.pagedRows;
          const item = items[Math.min(this.cursor, items.length - 1)];
          if (item) this.openCell("name", item);
        }
        if (!inField && e.key === "Delete" && this.selectedIds.size) {
          e.preventDefault();
          this.removeSelected();
        }
      },
      handleBeforeUnload(e) {
        if (this.dirty) {
          e.preventDefault();
          e.returnValue = "";
        }
      },
      // ==========================================
      // Работа с данными
      // ==========================================
      /**
       * Сохранение в localStorage
       */
      saveLocal() {
        try {
          saveProject(this.data);
          this.lastSavedAt = Date.now();
          this.savedFlash = true;
          setTimeout(() => this.savedFlash = false, 2e3);
          this.dirty = false;
        } catch (e) {
          console.error("Failed to save:", e);
        }
      },
      /**
       * Ручное сохранение
       */
      manualSave() {
        this.saveLocal();
        this.logActivity("\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0441\u043C\u0435\u0442\u044B");
      },
      /**
       * Загрузка ширин колонок
       */
      loadColWidths() {
        const widths = loadColumnWidths();
        for (const c of this.columns) {
          if (typeof widths[c.key] === "number" && widths[c.key] >= c.min) {
            c.width = widths[c.key];
          }
        }
      },
      /**
       * Сохранение ширин колонок
       */
      saveColWidths() {
        const map = {};
        for (const c of this.columns) {
          map[c.key] = c.width;
        }
        saveColumnWidths(map);
      },
      /**
       * Загрузка UI настроек
       */
      loadUI() {
        const ui = loadUISettings();
        if (ui.screen === "home" || ui.screen === "app") this.screen = ui.screen;
        if (Array.isArray(ui.hiddenCols)) this.hiddenCols = ui.hiddenCols;
        if (["table", "gantt", "summary"].includes(ui.viewTab)) this.viewTab = ui.viewTab;
        if (typeof ui.sidebarCollapsed === "boolean") this.sidebarCollapsed = ui.sidebarCollapsed;
        else if (typeof window !== "undefined") this.sidebarCollapsed = !(window.innerWidth >= 1200);
      },
      /**
       * Сохранение UI настроек
       */
      saveUI() {
        saveUISettings({
          screen: this.screen,
          hiddenCols: this.hiddenCols,
          viewTab: this.viewTab,
          sidebarCollapsed: this.sidebarCollapsed
        });
      },
      // ==========================================
      // Главный экран (карточки инструментов)
      // ==========================================
      openTool(id) {
        if (!this.tools.some((t) => t.id === id)) return;
        this.screen = "app";
        this.saveUI();
      },
      goHome() {
        this.manualSave();
        this.screen = "home";
        this.saveUI();
      },
      // ==========================================
      // Работа с разделами
      // ==========================================
      /**
       * Создание нового раздела
       */
      createSection(name = "\u041D\u043E\u0432\u044B\u0439 \u0440\u0430\u0437\u0434\u0435\u043B") {
        const section = Section.create(name);
        this.data.sections.push(section);
        this.pushHistory(`\u0421\u043E\u0437\u0434\u0430\u043D \u0440\u0430\u0437\u0434\u0435\u043B "${name}"`);
        return section;
      },
      /**
       * Удаление раздела
       */
      removeSection(si) {
        const section = this.data.sections[si];
        this.data.sections.splice(si, 1);
        this.pushHistory(`\u0423\u0434\u0430\u043B\u0435\u043D \u0440\u0430\u0437\u0434\u0435\u043B "${section.name}"`);
      },
      /**
       * Переименование раздела
       */
      renameSection(si, newName) {
        const section = this.data.sections[si];
        const oldName = section.name;
        section.name = newName;
        this.pushHistory(`\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D \u0440\u0430\u0437\u0434\u0435\u043B "${oldName}" \u2192 "${newName}"`);
      },
      /**
       * Выбор раздела
       */
      selectTab(si) {
        this.activeTab = this.activeTab === si ? null : si;
        this.page = 0;
      },
      /**
       * Выбор раздела из выпадающего списка (как листы в AutoCAD):
       * всегда переключает на выбранный, без «тоггла» при повторном клике.
       */
      selectSection(si) {
        this.activeTab = si;
        this.page = 0;
        this.sectionDropdownOpen = false;
      },
      /** Количество записей в разделе (для бейджей в списке разделов). */
      sectionRecordCount(si) {
        const sec = this.data.sections[si];
        if (!sec) return 0;
        return sec.resources.length;
      },
      // ==========================================
      // Работа с ресурсами
      // ==========================================
      /**
       * Создание нового ресурса
       */
      createResource(partial = {}) {
        return Resource.create(partial);
      },
      /**
       * Добавление ресурса в раздел
       */
      addResourceToSection(si, resource) {
        if (!this.data.sections[si]) return;
        this.data.sections[si].resources.push(resource);
        this.pushHistory(`\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0440\u0435\u0441\u0443\u0440\u0441 "${resource.name}" \u0432 "${this.data.sections[si].name}"`);
      },
      /**
       * Удаление ресурса
       */
      removeResource(si, ri) {
        const section = this.data.sections[si];
        const resource = section.resources[ri];
        section.resources.splice(ri, 1);
        this.pushHistory(`\u0423\u0434\u0430\u043B\u0435\u043D \u0440\u0435\u0441\u0443\u0440\u0441 "${resource.name}" \u0438\u0437 "${section.name}"`);
      },
      /**
       * Дублирование ресурса
       */
      duplicateRowById(si, rowId) {
        const section = this.data.sections[si];
        const resource = section.resources.find((r) => r.id === rowId);
        if (!resource) return;
        const duplicate = Resource.create({
          ...resource,
          id: uid(),
          name: `${resource.name} (\u043A\u043E\u043F\u0438\u044F)`
        });
        section.resources.push(duplicate);
        this.pushHistory(`\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u043D \u0440\u0435\u0441\u0443\u0440\u0441 "${resource.name}"`);
      },
      /**
       * Обновление ресурса
       */
      updateResource(si, ri, updates) {
        const section = this.data.sections[si];
        const resource = section.resources[ri];
        Object.assign(resource, updates);
        this.pushHistory(`\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D \u0440\u0435\u0441\u0443\u0440\u0441 "${resource.name}"`);
      },
      // ==========================================
      // Экспорт/Импорт
      // ==========================================
      /**
       * Экспорт в TOON (.toon — компактный табличный формат вместо JSON)
       */
      exportJson() {
        const toon = toFile(this.data);
        downloadFile(
          new Blob([toon], { type: "text/plain;charset=utf-8;" }),
          `${this.data.title || "\u0441\u043C\u0435\u0442\u0430"}.toon`
        );
        this.logActivity("\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0432 TOON");
      },
      /**
       * Импорт из TOON (.toon; legacy .json с объектом внутри тоже принимается)
       */
      importJson(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const project = fromFile(e.target.result);
            if (!Project.validate(project)) throw new Error("\u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430");
            this.data = project;
            this.pushHistory("\u0418\u043C\u043F\u043E\u0440\u0442 \u0438\u0437 TOON");
            this.logActivity("\u0418\u043C\u043F\u043E\u0440\u0442 \u0438\u0437 TOON");
          } catch (error) {
            alert("\u041E\u0448\u0438\u0431\u043A\u0430 \u0438\u043C\u043F\u043E\u0440\u0442\u0430: " + error.message);
          }
        };
        reader.readAsText(file);
      },
      /**
       * Экспорт в CSV
       */
      exportCsv() {
        const csv = exportToCsv(this.data);
        downloadFile(
          new Blob([csv], { type: "text/csv;charset=utf-8;" }),
          `${this.data.title || "\u0441\u043C\u0435\u0442\u0430"}.csv`
        );
        this.logActivity("\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0432 CSV");
      },
      // ==========================================
      // История и Undo/Redo
      // ==========================================
      /**
       * Добавляет запись в историю
       */
      pushHistory(label) {
        if (this._histBusy) return;
        try {
          this.undoStack.push(JSON.stringify(this.data));
          if (this.undoStack.length > 60) this.undoStack.shift();
          this.redoStack = [];
          this.logActivity(label);
        } catch (e) {
          console.error("Failed to push history:", e);
        }
      },
      /**
       * Отмена действия
       */
      undoAction() {
        if (!this.undoStack.length) return;
        this._histBusy = true;
        this.redoStack.push(JSON.stringify(this.data));
        this.data = JSON.parse(this.undoStack.pop());
        this._histBusy = false;
        this.logActivity("\u041E\u0442\u043C\u0435\u043D\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F");
      },
      /**
       * Повтор действия
       */
      redoAction() {
        if (!this.redoStack.length) return;
        this._histBusy = true;
        this.undoStack.push(JSON.stringify(this.data));
        this.data = JSON.parse(this.redoStack.pop());
        this._histBusy = false;
        this.logActivity("\u041F\u043E\u0432\u0442\u043E\u0440 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F");
      },
      /**
       * Логирование активности
       */
      logActivity(text) {
        this.activityLog.unshift({ time: (/* @__PURE__ */ new Date()).toLocaleTimeString("ru-RU"), text });
        if (this.activityLog.length > 100) this.activityLog.length = 100;
        saveHistory(this.activityLog);
      },
      /**
       * Очистка активности
       */
      clearActivity() {
        this.activityLog = [];
        clearAllData();
      },
      // ==========================================
      // Расчеты
      // ==========================================
      /**
       * Рассчитывает итоги по проекту
       */
      calculateTotals() {
        return calculateProjectTotals(this.data);
      },
      /** Округление итоговой статьи согласно правилам модели округления (#11) */
      rnd(v) {
        const r = this.data.rounding || { mode: "kopecks", method: "math" };
        return roundMoney(v, r.mode, r.method);
      },
      /**
       * Итоги сметы с применением округления по Методике № 421/пр (п. 58).
       * Расчёты идут с полной точностью; округляются только итоговые статьи.
       * Каркасный метод v2.0 — единственный расчёт в программе (старый путь с НДС удалён):
       * S = ПЗ + НР + СП + ЛЗ + Нал − Возвр (без НДС).
       */
      get sums() {
        const fw = calculateFrameworkTotals(this.data);
        return {
          labor: fw.labor,
          machine: fw.machine,
          operator: 0,
          material: fw.material,
          pz: fw.pz,
          nr: fw.nr,
          sp: fw.sp,
          lz: fw.lz,
          lzParts: fw.lzParts,
          tax: fw.tax,
          vehicleTax: fw.vehicleTax,
          returnable: fw.returnable,
          sNoTax: fw.sNoTax,
          grand: fw.grand,
          framework: true
        };
      },
      /**
       * Форматирует деньги
       */
      formatMoney(value) {
        return formatMoney(value);
      },
      // ==========================================
      // Утилиты
      // ==========================================
      /**
       * Открытие модального окна помощи
       */
      openHelpModal() {
        this.helpModalOpen = true;
      },
      /** Открытие справочника НСБ (сброс состояния редактирования) */
      openNsb() {
        this.nsbModalOpen = true;
        this.nsbEditId = null;
        this.nsbDraft = null;
      },
      // ==========================================
      // Скрытые колонки
      // ==========================================
      hiddenCols: [],
      toggleColVisibility(key) {
        if (key === "num" || key === "name" || key === "actions") return;
        this.hiddenCols = this.hiddenCols.includes(key) ? this.hiddenCols.filter((k) => k !== key) : [...this.hiddenCols, key];
        this.fieldMenuFor = null;
      },
      // ==========================================
      // Печать
      // ==========================================
      printCols() {
        return this.columns.filter((c) => c.key !== "num" && c.key !== "actions");
      },
      printColOn(key) {
        return this.printSettings.cols.includes(key);
      },
      togglePrintCol(key) {
        const arr = this.printSettings.cols;
        const i = arr.indexOf(key);
        if (i >= 0) arr.splice(i, 1);
        else arr.push(key);
        savePrintSettings(this.printSettings);
      },
      savePrintSettings() {
        savePrintSettings(this.printSettings);
      },
      openPrintModal() {
        this.printModalOpen = true;
      },
      // ==========================================
      // Прочие UI-функции (перенесены из legacy js/app.js)
      // ==========================================
      /** Переименование раздела inline (F2/клик по имени вкладки) */
      startRenameSection(si) {
        this.renamingSection = si;
        this.$nextTick(() => {
          const el = document.querySelector(".at-tab-wrap .at-tab-rename");
          if (el) {
            el.focus();
            el.select();
          }
        });
      },
      /** Перемещение вкладки раздела drag&drop */
      moveSectionByDrag(targetSi) {
        if (this.tabDragFrom === null || this.tabDragFrom === targetSi) return;
        const arr = this.data.sections;
        const [moved] = arr.splice(this.tabDragFrom, 1);
        arr.splice(targetSi, 0, moved);
        this.activeTab = null;
        this.tabDragFrom = null;
      },
      /** Ресайз колонки таблицы за край заголовка */
      startResize(e, col) {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = col.width;
        document.body.style.userSelect = "none";
        const onMove = (ev) => {
          col.width = Math.max(col.min, startW + ev.clientX - startX);
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          document.body.style.userSelect = "";
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      },
      /** Перемещение курсора таблицы стрелками ↑/↓ */
      moveGridCursor(delta) {
        const items = this.pagedRows;
        if (!items.length) return;
        this.cursor = Math.max(0, Math.min(items.length - 1, this.cursor + delta));
        const item = items[this.cursor];
        if (item) this.selectedIds = /* @__PURE__ */ new Set([item.row.id]);
      },
      /** Открытие ячейки на редактирование */
      openCell(field, item) {
        this.editing = { key: item.row.id + "|" + field };
      },
      /** Стоимость всех выделенных записей (показывается в сайдбаре, SPEC «UI v2») */
      selectedCost() {
        let s = 0;
        if (!this.selectedIds.size) return 0;
        for (const sec of this.data.sections)
          for (const r of sec.resources) if (this.selectedIds.has(r.id)) s += this.rowTotal(r);
        return s;
      },
      /** Удаление выделенных записей */
      removeSelected() {
        if (!this.selectedIds.size) return;
        if (!confirm(`\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 (${this.selectedIds.size})?`)) return;
        this.pushHistory(`\u0423\u0434\u0430\u043B\u0435\u043D\u043E \u0437\u0430\u043F\u0438\u0441\u0435\u0439: ${this.selectedIds.size}`);
        for (const sec of this.data.sections)
          sec.resources = sec.resources.filter((r) => !this.selectedIds.has(r.id));
        this.selectedIds = /* @__PURE__ */ new Set();
      },
      /** Отмена редактирования элемента НСБ (пустая новая запись удаляется) */
      cancelNsbEdit() {
        if (this.nsbEditId && this.nsbDraft && !String(this.nsbDraft.name || "").trim()) {
          const idx = this.nsbItems.findIndex((n) => n.id === this.nsbEditId);
          if (idx >= 0) {
            this.nsbItems.splice(idx, 1);
            this.saveNsb();
          }
        }
        this.nsbEditId = null;
        this.nsbDraft = null;
      },
      /** Сохранение базы НСБ в localStorage */
      saveNsb() {
        try {
          localStorage.setItem(LS_NSB_KEY, encodeValue(LS_NSB_KEY, this.nsbItems));
        } catch (e) {
        }
      },
      /** Текущая строка формы записи (для модалки редактирования) */
      get recordRow() {
        if (!this.recordModalOpen || !this.recordDraft) return null;
        const sec = this.data.sections[this.recordDraft.si];
        if (!sec) return null;
        return sec.resources.find((r) => r.id === this.recordDraft.rowId) || null;
      },
      /** Открытие модалки формы новой записи */
      openAddRecordModal() {
        let si = this.activeTab === null ? this.data.sections.length ? this.data.sections.length - 1 : null : this.activeTab;
        if (si === null || !this.data.sections[si]) {
          this.addSection();
          si = this.data.sections.length - 1;
        }
        this.pushHistory("\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C (\u0444\u043E\u0440\u043C\u0430)");
        const row = Resource.create({ type: "material" });
        this.data.sections[si].resources.push(row);
        this.recordDraft = { si, rowId: row.id };
        this.recordModalOpen = true;
      },
      /** Отмена модалки записи (пустая новая запись удаляется) */
      cancelRecordModal() {
        const row = this.recordRow;
        if (row && !(String(row.name).trim() || String(row.basis).trim() || Number(row.qty) || Number(row.price))) {
          const sec = this.data.sections[this.recordDraft.si];
          const idx = sec.resources.indexOf(row);
          if (idx >= 0) sec.resources.splice(idx, 1);
        }
        this.recordModalOpen = false;
        this.recordDraft = null;
      },
      /** Синхронизация цены ресурса во всех записях с тем же ключом */
      syncResourcePrice(row) {
        if (this.data.recalcMode === "manual") return;
        const k = this.resKey(row);
        if (!k) return;
        for (const sec of this.data.sections)
          for (const r of sec.resources) if (r !== row && this.resKey(r) === k) r.price = row.price;
      },
      /** Обработка правки цены в ячейке */
      onPriceEdited(row) {
        this.syncResourcePrice(row);
        this.logActivity(`\u0426\u0435\u043D\u0430 \xAB${(row.name || "").slice(0, 40)}\xBB \u2192 ${row.price}`);
      },
      /** Сквозной номер записи по flatRows (для предшественника по номеру) */
      rowNumber(rowId) {
        const i = this.flatRows.findIndex((it) => it.row.id === rowId);
        return i >= 0 ? i + 1 : null;
      },
      /** Установка предшественника по его номеру (#49) */
      setPredByNumber(row, numText) {
        const n = parseInt(numText);
        if (!isFinite(n) || n <= 0) {
          row.pred = "";
          return;
        }
        const items = this.flatRows;
        const target = items[n - 1];
        row.pred = target ? String(this.rowNumber(target.row.id)) : "";
      },
      // ==========================================
      // Перенесено из legacy — фаза 1 (см. docs/MIGRATION.md)
      // ==========================================
      /* ---------- форматирование ---------- */
      fmtNum(v) {
        const n = Number(v) || 0;
        return n.toLocaleString("ru-RU", { maximumFractionDigits: 6 });
      },
      fmtMoney(v) {
        return (Number(v) || 0).toLocaleString("ru-RU", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      },
      typeLabel(row) {
        if (row.type === "labor") return "\u0417\u0422 \xB7 \u0442\u0440\u0443\u0434";
        if (row.type === "machine") return row.operator ? "\u041E\u041C \xB7 \u0422\u043C\u0440" : "\u041E\u041C \xB7 \u043C\u0430\u0448\u0438\u043D\u044B";
        return "\u041C \xB7 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B";
      },
      setType(row, t) {
        row.type = t;
        if (t !== "machine") row.operator = false;
      },
      /* ---------- снапшот данных для сохранения ---------- */
      exportable() {
        return JSON.parse(JSON.stringify(this.data));
      },
      /* ---------- вычисления (#11) — каркасный метод v2.0 ---------- */
      rowTotal(row) {
        if (!row) return 0;
        try {
          const fw = this.data && this.data.framework ? this.data.framework : null;
          return frameworkRowCost(row, fw).total;
        } catch (e) {
          return (Number(row.qty) || 0) * (Number(row.price) || 0);
        }
      },
      /** Детализация стоимости строки: q_факт, p_полн и состав (для проверки расчётов). */
      rowBreakdown(row) {
        const fw = this.data && this.data.framework ? this.data.framework : null;
        return frameworkRowCost(row, fw);
      },
      /** Список групп норм отходов (для select в модалке записей). */
      wasteNorms() {
        return WASTE_NORMS;
      },
      /** Название группы норм отходов + k для отображения в проверке расчёта. */
      wasteLabel(groupId) {
        const g = WASTE_NORMS.find((w) => w.id === groupId);
        return g ? `${g.material_group} \xB7 +${g.pct}` : "\u0431\u0435\u0437 \u0437\u0430\u043F\u0430\u0441\u0430";
      },
      /** Контрольная сверка: Σ стоимостей строк грида == ПЗ из свода (расхождение, ₽). */
      checkPzConvergence() {
        let gridSum = 0;
        for (const sec of this.data.sections || []) {
          for (const r of sec.resources || []) gridSum += this.rowTotal(r);
        }
        const pz = Number(this.sums && this.sums.pz) || 0;
        return { gridSum, pz, diff: gridSum - pz };
      },
      sectionTotal(section) {
        return section.resources.reduce((s, r) => s + this.rowTotal(r), 0);
      },
      roundingLabel() {
        const r = this.data.rounding || {};
        return (ROUND_MODES[r.mode] || ROUND_MODES.kopecks).label + " \xB7 " + (ROUND_METHODS[r.method] || "");
      },
      setRecalcMode(mode) {
        this.data.recalcMode = mode;
        if (mode === "auto" && this.dirty) this.saveLocal();
        this.logActivity("\u0420\u0435\u0436\u0438\u043C \u043F\u0435\u0440\u0435\u0441\u0447\u0451\u0442\u0430: " + (mode === "auto" ? "\u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439" : "\u0440\u0443\u0447\u043D\u043E\u0439"));
      },
      forceRecalc() {
        this.saveLocal();
        this.savedFlash = true;
        setTimeout(() => this.savedFlash = false, 1500);
      },
      goPage(delta) {
        this.page = Math.max(0, Math.min(this.pageCount - 1, this.page + delta));
        this.cursor = -1;
      },
      gotoLastPage() {
        this.page = this.pageCount - 1;
      },
      pageLabel() {
        return `${Math.min(this.page + 1, this.pageCount)} / ${this.pageCount}`;
      },
      /* ---------- таблица: ширины и служебные ---------- */
      totalTableWidth() {
        return this.visibleColumns().reduce((s, c) => s + c.width, 0);
      },
      colSpanFor(key) {
        const vis = this.visibleColumns();
        const idx = vis.findIndex((c) => c.key === key);
        if (idx < 0) return 0;
        let span = 0;
        for (let i = idx; i < vis.length; i++) span += vis[i].key === "name" ? 2 : 1;
        return span;
      },
      colIcon(key) {
        return {
          num: "#",
          basis: "T",
          name: "T",
          type: "\u2B21",
          unit: "T",
          qty: "#",
          price: "$",
          total: "\u2211",
          note: "T",
          days: "\u{1F5D3}",
          pred: "\u2192",
          actions: ""
        }[key] || "";
      },
      resetColWidths() {
        localStorage.removeItem(LS_COLS_KEY);
        location.reload();
      },
      /* ---------- редактирование ячеек (#37) ---------- */
      commitEdit(ev, field, item) {
        const row = item.row;
        if (ev && ev.key === "Escape") {
          this.editing = null;
          return;
        }
        const input = ev && ev.target;
        let val = input ? input.value : row[field];
        if (["qty", "price", "days"].includes(field)) {
          val = String(val).replace(",", ".");
          const n = parseFloat(val);
          row[field] = isFinite(n) ? n : 0;
        } else if (field === "pred") {
          this.setPredByNumber(row, val);
        } else {
          row[field] = String(val).trim();
        }
        if (field === "price") this.onPriceEdited(row);
        this.pushHistory(`\u041F\u0440\u0430\u0432\u043A\u0430 \u043F\u043E\u043B\u044F \xAB${field}\xBB`);
        this.editing = null;
        if (ev && ev.key === "Tab") {
          ev.preventDefault();
          const order = ["basis", "name", "unit", "qty", "price", "note", "days", "pred"];
          const i = order.indexOf(field);
          const next = order[(i + 1) % order.length];
          this.$nextTick(() => this.openCell(next, item));
        }
      },
      /* ---------- модальное окно записи ---------- */
      openRowModal(item) {
        this.expandedRow = { ...item };
      },
      addRow(si) {
        if (si === null || si < 0 || !this.data.sections[si]) {
          this.createSection();
          this.activeTab = this.data.sections.length - 1;
          return;
        }
        this.pushHistory("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0430 \u0437\u0430\u043F\u0438\u0441\u044C");
        this.data.sections[si].resources.push(Resource.create());
        const list = this.data.sections[si].resources;
        const created = list[list.length - 1];
        this.openCell("name", { row: created });
      },
      saveRecordModal() {
        const row = this.recordRow;
        if (row && !(String(row.name).trim() || String(row.basis).trim())) {
          const idx = this.data.sections[this.recordDraft.si].resources.indexOf(row);
          if (idx >= 0) this.data.sections[this.recordDraft.si].resources.splice(idx, 1);
        } else if (row) {
          this.syncResourcePrice(row);
        }
        this.recordModalOpen = false;
        this.recordDraft = null;
      },
      removeRowById(si, id) {
        this.pushHistory("\u0423\u0434\u0430\u043B\u0435\u043D\u0430 \u0437\u0430\u043F\u0438\u0441\u044C");
        const arr = this.data.sections[si].resources;
        const idx = arr.findIndex((r) => r.id === id);
        if (idx >= 0) arr.splice(idx, 1);
        this.selectedIds.delete(id);
      },
      moveRow(item, delta) {
        const sec = this.data.sections[item.si];
        const from = sec.resources.findIndex((r) => r.id === item.row.id);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= sec.resources.length) return;
        this.pushHistory("\u041F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438");
        const [moved] = sec.resources.splice(from, 1);
        sec.resources.splice(to, 0, moved);
      },
      /* drag&drop строк между разделами (#26) */
      startRowDrag(e, item) {
        this.dragRow = { si: item.si, id: item.row.id };
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", item.row.id);
          const tr = e.target && e.target.closest ? e.target.closest("tr") : null;
          if (tr) {
            const r = tr.getBoundingClientRect();
            e.dataTransfer.setDragImage(tr, 12, r.height / 2);
          }
        } catch (err) {
        }
      },
      endRowDrag() {
        this.dragRow = null;
      },
      dropOnSection(si) {
        if (!this.dragRow || this.dragRow.si === si) return;
        this.pushHistory("\u0417\u0430\u043F\u0438\u0441\u044C \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u0430 \u0432 \u0434\u0440\u0443\u0433\u043E\u0439 \u0440\u0430\u0437\u0434\u0435\u043B");
        const fromArr = this.data.sections[this.dragRow.si].resources;
        const idx = fromArr.findIndex((r) => r.id === this.dragRow.id);
        if (idx < 0) return;
        const [moved] = fromArr.splice(idx, 1);
        this.data.sections[si].resources.push(moved);
        this.dragRow = null;
      },
      /** Открытие модалки реквизитов проекта */
      openProjectModal() {
        this.projModalOpen = true;
      },
      /** Открытие калькулятора трудозатрат / маш-часов (#48) */
      openCalc(prefillRow) {
        this.calcTab = prefillRow && prefillRow.type === "machine" ? "machine" : "labor";
        if (prefillRow) {
          this.calc.volume = Number(prefillRow.qty) || 100;
          this.calc.ratePerHour = Number(prefillRow.price) || 250;
        }
        this.calc.days = null;
        this.calcModalOpen = true;
      },
      /** Результат расчёта калькулятора */
      get calcResult() {
        const c = this.calc;
        const V = Number(c.volume) || 0;
        const N = Number(c.normTime) || 0;
        const totalHours = V * N;
        const dayHours = Math.max(1, Number(c.crewSize) || 1) * Math.max(1, Number(c.shiftsPerDay) || 1) * Math.max(1, Number(c.hoursPerShift) || 8);
        const days = totalHours > 0 ? totalHours / dayHours : 0;
        const cost = totalHours * (Number(c.ratePerHour) || 0);
        const needCrew = Number(c.days) > 0 ? Math.ceil(
          totalHours / (Math.max(1, Number(c.days)) * Math.max(1, Number(c.shiftsPerDay) || 1) * Math.max(1, Number(c.hoursPerShift) || 8))
        ) : null;
        return { totalHours, days: Math.ceil(days), exactDays: days, cost, needCrew, dayHours };
      },
      /** Применение результата калькулятора к записи */
      applyCalcToRow(item) {
        const res = this.calcResult;
        const row = item ? item.row : this.recordRow;
        if (!row) {
          alert("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u044C \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435.");
          this.calcModalOpen = false;
          return;
        }
        this.pushHistory("\u041A\u0430\u043B\u044C\u043A\u0443\u043B\u044F\u0442\u043E\u0440 \u043F\u0440\u0438\u043C\u0435\u043D\u0451\u043D \u043A \u0437\u0430\u043F\u0438\u0441\u0438");
        row.type = this.calcTab === "labor" ? "labor" : "machine";
        row.price = Number(this.calc.ratePerHour) || 0;
        row.unit = row.unit || (this.calcTab === "labor" ? "\u0447\u0435\u043B-\u0447" : "\u043C\u0430\u0448-\u0447");
        row.qty = Number(res.totalHours.toFixed(2));
        if (res.days > 0) row.days = res.days;
        this.calcModalOpen = false;
      },
      /** Открытие хаба ресурсов */
      openResHub() {
        this.resModalOpen = true;
      },
      // ==========================================
      // Методы UI (портировано из legacy js/app.js)
      // ==========================================
      applyResourcePrice(entry, price) {
        const p = Number(price);
        if (!isFinite(p) || p < 0) return;
        let n = 0;
        for (const sec of this.data.sections) {
          for (const r of sec.resources) {
            if (resKey(r) === entry.key) {
              r.price = p;
              n++;
            }
          }
        }
        this.pushHistory(`\u0426\u0435\u043D\u0430 \u0440\u0435\u0441\u0443\u0440\u0441\u0430 \xAB${entry.name}\xBB \u2192 ${p} \u20BD (${n} \u0437\u0430\u043F\u0438\u0441\u0435\u0439)`);
      },
      findResourceByName(name) {
        const f = String(name || "").trim().toLowerCase();
        if (!f) return null;
        for (const sec of this.data.sections)
          for (const r of sec.resources) if (String(r.name).trim().toLowerCase() === f) return r;
        return null;
      },
      /** Показать все скрытые колонки (пункт меню «👁 Показать все колонки») */
      showAllCols() {
        this.hiddenCols = [];
        this.saveUI();
      },
      /** Число колонок после последней видимой — для colspan-заглушек таблицы */
      tailCols() {
        const vis = this.visibleColumns();
        const lastIdx = vis.length ? this.columns.indexOf(vis[vis.length - 1]) : -1;
        return Math.max(0, this.columns.length - 1 - lastIdx);
      },
      /* ---------- Каркасный метод v2.0: строки считаются по frameworkRowCost ---------- */
      selectionTotal() {
        let s = 0;
        for (const sec of this.data.sections)
          for (const r of sec.resources) if (this.selectedIds.has(r.id)) s += this.rowTotal(r);
        return s;
      },
      isChapter(sec) {
        return Array.isArray(sec.children) && sec.children.length > 0;
      },
      chapterTotal(sec) {
        return sec.children.reduce((s, c) => s + this.sectionTotal(c), 0);
      },
      chapterRowTotal(sec) {
        return this.sectionTotal(sec) + this.chapterTotal(sec);
      },
      toggleCollapse(si) {
        const sec = this.data.sections[si];
        if (this.isChapter(sec)) {
          sec.collapsed = !sec.collapsed;
        } else {
          sec.collapsed = !sec.collapsed;
        }
      },
      makeChapter(index) {
        this.pushHistory("\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0433\u043B\u0430\u0432\u044B");
        const name = prompt("\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0433\u043B\u0430\u0432\u044B:", "\u0413\u043B\u0430\u0432\u0430 1");
        if (name === null || name === void 0) return;
        this.data.sections.splice(index, 0, {
          id: uid(),
          name: name.trim() || "\u0413\u043B\u0430\u0432\u0430",
          parentId: null,
          collapsed: false,
          resources: [],
          children: []
        });
      },
      promoteSection(si) {
        if (si <= 0) return;
        const arr = this.data.sections;
        const prev = arr[si - 1];
        if (this.isChapter(prev)) {
          this.pushHistory("\u0420\u0430\u0437\u0434\u0435\u043B \u0441\u0434\u0435\u043B\u0430\u043D \u043F\u043E\u0434\u0440\u0430\u0437\u0434\u0435\u043B\u043E\u043C");
          prev.children.push(arr[si]);
          arr.splice(si, 1);
          this.activeTab = null;
        } else {
          this.pushHistory("\u0421\u043E\u0437\u0434\u0430\u043D\u0430 \u0433\u043B\u0430\u0432\u0430 \u043D\u0430\u0434 \u0440\u0430\u0437\u0434\u0435\u043B\u043E\u043C");
          const chapter = {
            id: uid(),
            name: prev.name + " (\u0433\u043B\u0430\u0432\u0430)",
            parentId: null,
            collapsed: false,
            resources: [],
            children: [prev, arr[si]]
          };
          arr.splice(si - 1, 2, chapter);
          this.activeTab = null;
        }
      },
      demoteSection(si) {
        const arr = this.data.sections;
        const idx = arr.findIndex((s) => this.isChapter(s) && s.children.includes(arr[si]));
        if (idx < 0) return;
        this.pushHistory("\u041F\u043E\u0434\u0440\u0430\u0437\u0434\u0435\u043B \u043F\u043E\u0434\u043D\u044F\u0442 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u044B");
        arr[idx].children.splice(arr[idx].children.indexOf(arr[si]), 1);
        if (arr[idx].children.length === 0) {
          const ch = arr[idx];
          const single = ch.children[0];
          arr.splice(idx, 1, single);
          this.activeTab = null;
        } else {
          this.activeTab = null;
        }
      },
      findChapterOf(secId) {
        return this.data.sections.findIndex(
          (s) => this.isChapter(s) && s.children.some((c) => c.id === secId)
        );
      },
      get tabSections() {
        const out = [];
        this.data.sections.forEach((sec, si) => {
          out.push({ sec, si, child: false });
          if (this.isChapter(sec) && !sec.collapsed) {
            sec.children.forEach((c) => out.push({ sec: c, si, child: true }));
          }
        });
        return out;
      },
      get scopedSections() {
        if (this.activeTab !== null) {
          const sec = this.data.sections[this.activeTab];
          if (!sec) return [];
          if (this.isChapter(sec)) {
            if (sec.collapsed) return [];
            return [
              { sec, si: this.activeTab },
              ...sec.children.map((c) => ({ sec: c, si: this.activeTab }))
            ];
          }
          return [{ sec, si: this.activeTab }];
        }
        const out = [];
        this.data.sections.forEach((sec, si) => {
          out.push({ sec, si });
          if (this.isChapter(sec) && !sec.collapsed) {
            sec.children.forEach((c) => out.push({ sec: c, si }));
          }
        });
        return out;
      },
      get pageCount() {
        return Math.max(1, Math.ceil(this.flatRows.length / PAGE_SIZE));
      },
      // Групповые итоги удалены: группировки запрещены (см. README «⛔ Запрещено»).
      // Итог раздела остаётся доступным через sectionTotal(sec).
      get summaryResources() {
        const map = /* @__PURE__ */ new Map();
        this.data.sections.forEach((sec, si) => {
          const secs = this.isChapter(sec) ? sec.children : [sec];
          for (const s of secs) {
            for (const r of s.resources) {
              const k = resKey(r);
              if (!k) continue;
              if (!map.has(k))
                map.set(k, {
                  name: r.name,
                  type: r.type,
                  unit: r.unit,
                  qty: 0,
                  cost: 0,
                  bases: /* @__PURE__ */ new Set(),
                  uses: 0,
                  sections: /* @__PURE__ */ new Set()
                  // имя раздела(ов), где встречается ресурс (указатель №6)
                });
              const e = map.get(k);
              e.qty += Number(r.qty) || 0;
              e.cost += this.rowTotal(r);
              e.uses++;
              if (String(r.basis).trim()) e.bases.add(String(r.basis).trim());
              e.sections.add(`${si + 1}. ${s.name || "(\u0431\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F)"}`);
            }
          }
        });
        return [...map.values()].sort((a, b) => b.cost - a.cost);
      },
      summaryTotalCost() {
        return this.summaryResources.reduce((s, e) => s + e.cost, 0);
      },
      matchesFilter(row) {
        const f = this.filter.trim().toLowerCase();
        if (!f) return true;
        return (row.name || "").toLowerCase().includes(f) || (row.basis || "").toLowerCase().includes(f) || (row.note || "").toLowerCase().includes(f);
      },
      hiddenCount() {
        let hidden = 0;
        for (const sec of this.data.sections)
          for (const r of sec.resources) if (!this.matchesFilter(r)) hidden++;
        return hidden;
      },
      visibleCount() {
        return this.flatRows.length;
      },
      totalCount() {
        return this.data.sections.reduce((s, sec) => s + sec.resources.length, 0);
      },
      selectOnly(id) {
        this.selectedIds = /* @__PURE__ */ new Set([id]);
      },
      toggleSelect(id) {
        const s = new Set(this.selectedIds);
        s.has(id) ? s.delete(id) : s.add(id);
        this.selectedIds = s;
      },
      openAddSectionModal() {
        this.sectionModalMode = "create";
        this.sectionDraft = { name: "", index: null };
        this.sectionModalOpen = true;
      },
      openEditSectionModal(si) {
        this.sectionModalMode = "edit";
        this.sectionDraft = { name: this.data.sections[si].name, index: si };
        this.sectionModalOpen = true;
      },
      saveSectionModal() {
        const name = (this.sectionDraft.name || "").trim();
        if (!name) {
          this.sectionModalOpen = false;
          return;
        }
        if (this.sectionModalMode === "create") {
          this.data.sections.push(newSection(name));
          this.activeTab = this.data.sections.length - 1;
        } else if (this.sectionDraft.index !== null && this.sectionDraft.index !== void 0 && this.data.sections[this.sectionDraft.index]) {
          this.data.sections[this.sectionDraft.index].name = name;
        }
        this.sectionModalOpen = false;
      },
      addSection() {
        this.data.sections.push(newSection("\u041D\u043E\u0432\u044B\u0439 \u0440\u0430\u0437\u0434\u0435\u043B"));
        this.activeTab = this.data.sections.length - 1;
        this.startRenameSection(this.activeTab);
      },
      removeSectionByTab(si) {
        const sec = this.data.sections[si];
        if (confirm(`\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0440\u0430\u0437\u0434\u0435\u043B \xAB${sec.name}\xBB \u0441\u043E \u0432\u0441\u0435\u043C\u0438 \u0437\u0430\u043F\u0438\u0441\u044F\u043C\u0438?`)) {
          this.data.sections.splice(si, 1);
          this.activeTab = null;
        }
      },
      deleteSectionFromModal() {
        const si = this.sectionDraft.index;
        if (si === null || !this.data.sections[si]) return;
        const sec = this.data.sections[si];
        const cnt = sec.resources.length;
        if (confirm(`\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0440\u0430\u0437\u0434\u0435\u043B \xAB${sec.name}\xBB \u0438 ${cnt} \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u0432 \u043D\u0451\u043C?`)) {
          this.data.sections.splice(si, 1);
          this.activeTab = null;
          this.sectionModalOpen = false;
        }
      },
      duplicateSection(si) {
        const src = this.data.sections[si];
        const copy = newSection(src.name + " (\u043A\u043E\u043F\u0438\u044F)");
        copy.resources = src.resources.map((r) => {
          const { id: _drop, ...rest } = r;
          return newRow(rest);
        });
        this.data.sections.splice(si + 1, 0, copy);
        this.activeTab = si + 1;
      },
      toggleFieldMenu(col) {
        this.fieldMenuFor = this.fieldMenuFor === col ? null : col;
      },
      currentTargetSection() {
        return this.activeTab === null ? this.data.sections.length - 1 : this.activeTab;
      },
      /** Завершение перетаскивания строки — сброс состояния drag/drop-подсветки. */
      rowDragEnd(item, e) {
        const target = this.rowDropTarget;
        if (this.dragRow && target && this.dragRow.si === item.si && this.dragRow.id !== item.row.id) {
          this._reorderInSection(this.dragRow.si, this.dragRow.id, item.row.id, target.pos);
        }
        this.dragRow = null;
        this.rowDropTarget = null;
        this._flipRows();
      },
      /**
       * FLIP-анимация перестановки строк (как в Airtable): до перерисовки DOM запоминаем
       * позиции видимых строк, после — проигрываем «прилёт» сдвигаемых соседей и самой
       * перемещённой строки. Без этого строки мгновенно телепортируются, и непонятно,
       * куда именно встал перенесённый элемент.
       */
      _flipRows() {
        const sel = "tr.at-row[data-row-id]";
        const prev = this._rowRects || /* @__PURE__ */ new Map();
        requestAnimationFrame(() => {
          const anims = [];
          document.querySelectorAll(sel).forEach((tr) => {
            const id = tr.dataset.rowId;
            const now = tr.getBoundingClientRect();
            const before = prev.get(id);
            if (!before) return;
            const dy = before.top - now.top;
            if (Math.abs(dy) < 2) return;
            tr.style.transition = "none";
            tr.style.transform = `translateY(${dy}px)`;
            anims.push(tr);
          });
          requestAnimationFrame(() => {
            for (const tr of anims) {
              tr.style.transition = "transform .28s cubic-bezier(.2,.8,.3,1)";
              tr.style.transform = "";
              const done = () => {
                tr.style.transition = "";
                tr.removeEventListener("transitionend", done);
              };
              tr.addEventListener("transitionend", done);
            }
          });
          this._rowRects = null;
        });
      },
      /** Перемещение строки внутри одного раздела относительно целевой (up/down). */
      _reorderInSection(si, movedId, targetId, pos) {
        const arr = this.data.sections[si].resources;
        const from = arr.findIndex((r) => r.id === movedId);
        if (from < 0) return;
        let to = arr.findIndex((r) => r.id === targetId);
        if (to < 0) return;
        if (pos === "below") to += 1;
        if (from < to) to -= 1;
        if (to === from) return;
        this.pushHistory("\u041F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438");
        this._rowRects = this._captureRowRects();
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        this._flashDroppedRow(movedId);
      },
      /** Снимок вертикальных позиций строк таблицы (для FLIP-анимации). */
      _captureRowRects() {
        const map = /* @__PURE__ */ new Map();
        document.querySelectorAll("tr.at-row[data-row-id]").forEach((tr) => {
          map.set(tr.dataset.rowId, tr.getBoundingClientRect());
        });
        return map;
      },
      /** Подсветка строки после переноса — визуальное подтверждение нового места (указатель №7). */
      _flashDroppedRow(rowId) {
        this.droppedRowId = rowId;
        setTimeout(() => {
          if (this.droppedRowId === rowId) this.droppedRowId = null;
        }, 650);
      },
      /**
       * Наведение на строку во время drag&drop: определяем половину цели
       * (вставить перед строкой или после неё) и подсвечиваем drop-зону.
       * Работает и перенос между разделами, и reorder внутри раздела.
       */
      rowDragOver(e, item) {
        if (!this.dragRow || this.dragRow.id === item.row.id) {
          if (this.rowDropTarget) this.rowDropTarget = null;
          return;
        }
        const pos = this._rowDropPos(e);
        const key = item.si + "|" + item.row.id;
        if (this.rowDropTarget && this.rowDropTarget.key === key && this.rowDropTarget.pos === pos)
          return;
        this.rowDropTarget = { key, pos };
        if (this.dragRow.si === item.si) {
          const arr = this.data.sections[item.si].resources;
          const from = arr.findIndex((r) => r.id === this.dragRow.id);
          let to = arr.findIndex((r) => r.id === item.row.id);
          if (from >= 0 && to >= 0 && from !== to) {
            if (pos === "below") to += 1;
            if (from < to) to -= 1;
            if (to !== from) {
              this._rowRects = this._captureRowRects();
              const [moved] = arr.splice(from, 1);
              arr.splice(to, 0, moved);
              this._flipRows();
            }
          }
        }
      },
      /** Вычислить верхнюю/нижнюю половину строки по координате курсора. */
      _rowDropPos(e) {
        const tr = e && e.target ? e.target.closest("tr") : null;
        if (!tr) return "above";
        const r = tr.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2 ? "above" : "below";
      },
      /** Drop строки на другую строку: перенос в раздел цели перед/после целевой записи. */
      rowDrop(item) {
        const target = this.rowDropTarget;
        if (!this.dragRow || this.dragRow.si === item.si) return;
        const fromSi = this.dragRow.si;
        const movedId = this.dragRow.id;
        const fromArr = this.data.sections[fromSi].resources;
        const idx = fromArr.findIndex((r) => r.id === movedId);
        if (idx < 0) return;
        this.pushHistory("\u0417\u0430\u043F\u0438\u0441\u044C \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u0430 \u0432 \u0434\u0440\u0443\u0433\u043E\u0439 \u0440\u0430\u0437\u0434\u0435\u043B");
        const [moved] = fromArr.splice(idx, 1);
        const toArr = this.data.sections[item.si].resources;
        let to = toArr.findIndex((r) => r.id === item.row.id);
        if (to < 0) to = toArr.length;
        else if (target && target.pos === "below") to += 1;
        toArr.splice(to, 0, moved);
        this.dragRow = null;
        this._flashDroppedRow(movedId);
      },
      openCtxMenu(e, item) {
        e.preventDefault();
        if (!this.selectedIds.has(item.row.id)) this.selectOnly(item.row.id);
        this.ctxMenu = {
          x: Math.min(e.clientX, window.innerWidth - 220),
          y: Math.min(e.clientY, window.innerHeight - 260),
          item
        };
      },
      closeCtxMenu() {
        this.ctxMenu = null;
      },
      ctxAction(fn) {
        const m = this.ctxMenu;
        if (!m) return;
        this.ctxMenu = null;
        fn(m.item);
      },
      ctxEditRow() {
        this.ctxAction((item) => {
          this.expandedRow = { ...item };
        });
      },
      ctxDuplicate() {
        this.ctxAction((item) => this.duplicateRowById(item.si, item.row.id));
      },
      ctxMoveUp() {
        this.ctxAction((item) => this.moveRow(item, -1));
      },
      ctxMoveDown() {
        this.ctxAction((item) => this.moveRow(item, 1));
      },
      ctxDeleteRow() {
        this.ctxAction((item) => this.removeRowById(item.si, item.row.id));
      },
      ctxApplyNsb() {
        this.ctxAction((item) => {
          const hit = this.nsbItems.find(
            (n) => n.basis && n.basis.trim().toLowerCase() === String(item.row.basis).trim().toLowerCase() || n.name && n.name.trim().toLowerCase() === String(item.row.name).trim().toLowerCase()
          );
          if (hit) {
            this.pushHistory("\u041F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0430 \u0440\u0430\u0441\u0446\u0435\u043D\u043A\u0430 \u041D\u0421\u0411");
            item.row.basis = hit.basis;
            item.row.name = hit.name;
            item.row.type = hit.type;
            item.row.unit = hit.unit;
            item.row.price = hit.price;
            copyFrameworkFields(hit, item.row);
          } else {
            alert("\u0412 \u041D\u0421\u0411 \u043D\u0435\u0442 \u0440\u0430\u0441\u0446\u0435\u043D\u043A\u0438 \u0441 \u0442\u0430\u043A\u0438\u043C \u0448\u0438\u0444\u0440\u043E\u043C \u0438\u043B\u0438 \u043D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435\u043C.");
          }
        });
      },
      ctxCopyName() {
        this.ctxAction((item) => {
          const t = `${item.row.basis} ${item.row.name}`.trim();
          if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {
          });
        });
      },
      /** Пункт контекстного меню: открыть калькулятор для этой строки */
      ctxCalc() {
        this.ctxAction((item) => this.openCalc(item.row));
      },
      rangeSelect(toIndex) {
        const items = this.flatRows;
        const last = items[items.length - 1];
        const anchor = last ? last.row.id : null;
        const target = items.find((i) => i.index === toIndex);
        if (!anchor || !target) return;
        const a = items.findIndex((i) => i.row.id === anchor);
        const b = items.indexOf(target);
        const s = new Set(this.selectedIds);
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) s.add(items[i].row.id);
        this.selectedIds = s;
      },
      clearSelection() {
        this.selectedIds = /* @__PURE__ */ new Set();
        this.batchBar = false;
      },
      openBatchBar() {
        this.batchBar = true;
        this.ctxMenu = null;
        this.batchPrice = "";
        this.batchQty = "";
        this.batchUnit = "";
      },
      batchApply() {
        if (!this.selectedIds.size) return;
        this.pushHistory("\u0411\u0430\u0442\u0447-\u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u044F");
        for (const sec of this.data.sections)
          for (const r of sec.resources)
            if (this.selectedIds.has(r.id)) {
              if (this.batchPrice !== "") r.price = Number(this.batchPrice) || 0;
              if (this.batchQty !== "") r.qty = Number(this.batchQty) || 0;
              if (this.batchUnit !== "") r.unit = this.batchUnit;
            }
        this.batchBar = false;
      },
      setAllSelectedPriceFromNsb() {
        this.nsbApplyToSelected();
      },
      download(filename, text, mime) {
        const blob = new Blob([text], { type: mime + ";charset=utf-8" });
        this.downloadBlob(filename, blob);
      },
      downloadBlob(filename, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1e3);
      },
      exportGanttPng(svgIn) {
        const svg = svgIn || this.buildGanttSVG();
        if (!svg) {
          alert("\u041D\u0435\u0442 \u0440\u0430\u0431\u043E\u0442 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0430: \u0437\u0430\u0434\u0430\u0439\u0442\u0435 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438.");
          return;
        }
        svgToPng(svg, 2, (blob) => {
          if (!blob) {
            alert("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435.");
            return;
          }
          this.downloadBlob("gantt.png", blob);
          this.logActivity("\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u044B \u0413\u0430\u043D\u0442\u0430 (PNG)");
        });
      },
      exportGanttSvg(svgIn) {
        const svg = svgIn || this.buildGanttSVG();
        if (!svg) {
          alert("\u041D\u0435\u0442 \u0440\u0430\u0431\u043E\u0442 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0430.");
          return;
        }
        this.download("gantt.svg", svg, "image/svg+xml");
        this.logActivity("\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u044B \u0413\u0430\u043D\u0442\u0430 (SVG)");
      },
      buildGanttSVG() {
        const g = this.ganttData;
        if (!g.rows.length && !g.sections.length) return null;
        const DAYW = 34, ROWH = 26, SECH = 30, NAMEW = 260, TOP = 46;
        const width = NAMEW + g.totalDays * DAYW + 40;
        const height = TOP + g.sections.length * SECH + g.rows.length * ROWH + 30;
        const colors = {
          labor: "#0052cc",
          machine: "#ff8b00",
          material: "#36b37e",
          section: "#4c9aff"
        };
        const parts = [];
        parts.push(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
        );
        parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
        parts.push(
          `<text x="12" y="24" font-family="Arial" font-size="15" font-weight="bold" fill="#172b4d">${xmlEsc(this.data.title)} \u2014 \u0433\u0440\u0430\u0444\u0438\u043A \u0440\u0430\u0431\u043E\u0442</text>`
        );
        for (let d = 0; d <= g.totalDays; d++) {
          const x = NAMEW + d * DAYW;
          parts.push(
            `<line x1="${x}" y1="${TOP - 8}" x2="${x}" y2="${height - 10}" stroke="#eaebf0" stroke-width="1"/>`
          );
          if (d % 5 === 0)
            parts.push(
              `<text x="${x + 2}" y="${TOP - 12}" font-family="Arial" font-size="10" fill="#7a8699">${this.ganttDateLabel(d)}</text>`
            );
        }
        let y = TOP;
        for (const s of g.sections) {
          parts.push(
            `<text x="8" y="${y + 18}" font-family="Arial" font-size="12" font-weight="bold" fill="#172b4d">${xmlEsc(s.si + 1 + ". " + s.name).slice(0, 34)}</text>`
          );
          parts.push(
            `<rect x="${NAMEW + s.leftDays * DAYW}" y="${y + 8}" width="${Math.max(6, s.spanDays * DAYW - 4)}" height="12" rx="3" fill="${colors.section}"/>`
          );
          y += SECH;
        }
        for (const r of g.rows) {
          parts.push(
            `<text x="22" y="${y + 17}" font-family="Arial" font-size="11" fill="#344563">${xmlEsc(r.name).slice(0, 40)}</text>`
          );
          parts.push(
            `<rect x="${NAMEW + r.leftDays * DAYW}" y="${y + 5}" width="${Math.max(6, r.spanDays * DAYW - 4)}" height="16" rx="4" fill="${colors[r.type] || colors.material}"/>`
          );
          parts.push(
            `<text x="${NAMEW + r.leftDays * DAYW + 6}" y="${y + 17}" font-family="Arial" font-size="10" fill="#fff">${r.days} \u0434\u043D.</text>`
          );
          y += ROWH;
        }
        parts.push("</svg>");
        return parts.join("");
      },
      doPrint() {
        const style = document.getElementById("print-orientation-style");
        if (style) {
          style.textContent = `@media print { @page { size: A4 ${this.printOrientation}; margin: 10mm; } }`;
        }
        document.body.classList.add("printing");
        if (this.viewTab === "gantt") document.body.classList.add("printing-gantt");
        this.printModalOpen = false;
        this.logActivity("\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u043D\u0430 \u043F\u0435\u0447\u0430\u0442\u044C (" + this.printOrientation + ")");
        setTimeout(() => {
          window.print();
          setTimeout(() => {
            document.body.classList.remove("printing");
            document.body.classList.remove("printing-gantt");
          }, 300);
        }, 60);
      },
      projectFilled() {
        const c = this.data.company || {};
        return !!(c.objectName || c.customer || c.contractor || c.chief);
      },
      saveProjectModal() {
        this.projModalOpen = false;
        this.pushHistory("\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u0440\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u044B \u043E\u0431\u044A\u0435\u043A\u0442\u0430");
      },
      toggleGantt() {
        this.viewTab = this.viewTab === "gantt" ? "table" : "gantt";
      },
      get ganttData() {
        const DAY = 864e5;
        const start = new Date(this.data.startDate || defaultStartDate()).getTime();
        const scoped = this.activeTab === null ? (() => {
          const out = [];
          this.data.sections.forEach((sec, si) => {
            out.push({ sec, si });
            if (this.isChapter(sec) && !sec.collapsed)
              sec.children.forEach((c) => out.push({ sec: c, si }));
          });
          return out;
        })() : [{ sec: this.data.sections[this.activeTab], si: this.activeTab }].filter((x) => x.sec);
        const rows = [];
        const skipped = [];
        let prevEnd = start;
        let maxEnd = start;
        for (const { sec, si } of scoped) {
          const secStart = Math.max(start, prevEnd);
          let cur = secStart;
          for (const r of sec.resources) {
            const raw = Number(r.days);
            if (!isFinite(raw) || raw <= 0) {
              skipped.push(r);
              continue;
            }
            const dur = Math.round(raw);
            if (dur <= 0) {
              skipped.push(r);
              continue;
            }
            const from = cur;
            const to = from + dur * DAY;
            rows.push({
              row: r,
              si,
              name: r.name || "(\u0431\u0435\u0437 \u043D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u044F)",
              type: r.type,
              total: this.rowTotal(r),
              days: dur,
              leftDays: Math.round((from - start) / DAY),
              spanDays: dur
            });
            cur = to;
            if (to > maxEnd) maxEnd = to;
          }
          if (cur > prevEnd) prevEnd = cur;
        }
        const numByRowId = new Map(this.flatRows.map((it, i) => [it.row.id, i + 1]));
        const byNum = new Map(
          rows.map((g) => {
            const n = numByRowId.get(g.row.id);
            return n === void 0 || n === null ? null : [n, g];
          }).filter((e) => e !== null)
        );
        const origLeft = rows.map((g) => g.leftDays);
        const moved = rows.some((g) => Number(g.row.startAt) >= 0);
        if (moved) {
          rows.forEach((g, i) => {
            if (Number(g.row.startAt) >= 0)
              g.leftDays = Math.max(0, Math.round(Number(g.row.startAt)));
          });
        }
        const links = [];
        rows.forEach((g, i) => {
          const n = parseInt(String(g.row.pred || "").trim());
          if (!isFinite(n) || n <= 0 || n === numByRowId.get(g.row.id)) return;
          const pred = byNum.get(n);
          if (!pred) return;
          links.push({ from: pred, to: g });
          const minStart = pred.leftDays + pred.spanDays;
          if (moved) {
            if (g.leftDays < minStart) {
              const shift = minStart - g.leftDays;
              g.leftDays = minStart;
              for (let j = i; j < rows.length; j++) rows[j].leftDays += shift;
            }
          } else {
            g.leftDays = Math.max(g.leftDays, minStart);
          }
        });
        const workedDays = rows.reduce((m, g) => Math.max(m, g.leftDays + g.spanDays), 0);
        const totalDays = Math.max(7, workedDays);
        const memo = /* @__PURE__ */ new Map();
        const chainLen = (g) => {
          if (memo.has(g)) return memo.get(g);
          let best = 0;
          const n = parseInt(String(g.row.pred || "").trim());
          if (isFinite(n) && n > 0) {
            const pred = byNum.get(n);
            if (pred && pred !== g) best = chainLen(pred);
          }
          const len = best + g.spanDays;
          memo.set(g, len);
          return len;
        };
        const maxChain = rows.reduce((m, g) => Math.max(m, chainLen(g)), 0);
        rows.forEach((g) => {
          g.isCritical = this.ganttCritical && chainLen(g) === maxChain;
        });
        const sections = [];
        for (const { sec, si } of scoped) {
          const gr = rows.filter((g) => g.row && sec.resources.includes(g.row));
          if (!gr.length) continue;
          const left = Math.min(...gr.map((g) => g.leftDays));
          const right = Math.max(...gr.map((g) => g.leftDays + g.spanDays));
          sections.push({
            id: sec.id,
            si,
            name: sec.name,
            leftDays: left,
            spanDays: right - left,
            total: this.sectionTotal(sec)
          });
        }
        return { rows, sections, skipped, links, totalDays, workedDays, start, origLeft };
      },
      get ganttLinkLines() {
        const w = this.ganttDayWidth();
        const ROWH = 34, SECH = 38, TOP = 34;
        const rows = this.ganttData.rows;
        const secCount = this.ganttData.sections.length;
        void this.layoutTick;
        const tracks = document.querySelectorAll(".at-gantt .at-gantt-track");
        return this.ganttData.links.map((l) => {
          const fi = rows.indexOf(l.from);
          const ti = rows.indexOf(l.to);
          if (fi < 0 || ti < 0) return null;
          let x1, y1, x2, y2;
          const trackT = tracks[ti];
          const barF = trackT && tracks[fi] ? tracks[fi].querySelector(".at-gantt-bar") : null;
          const barT = trackT ? trackT.querySelector(".at-gantt-bar") : null;
          if (barF && barT) {
            const rf = barF.getBoundingClientRect();
            const rt = barT.getBoundingClientRect();
            const rc = trackT.getBoundingClientRect();
            x1 = rf.right - rc.left;
            y1 = rf.top + rf.height / 2 - rc.top;
            x2 = rt.left - rc.left;
            y2 = rt.top + rt.height / 2 - rc.top;
          } else {
            x1 = l.from.leftDays * w + Math.max(6, l.from.spanDays * w - 4);
            y1 = TOP + secCount * SECH + fi * ROWH + ROWH / 2;
            x2 = l.to.leftDays * w;
            y2 = TOP + secCount * SECH + ti * ROWH + ROWH / 2;
          }
          const r = 6;
          const midX = Math.max(x1 + 12, x2 - 16);
          const dy = y2 - y1;
          const ady = Math.abs(dy);
          let d;
          if (x2 > x1 + 14 && ady > 2) {
            const mx = (x1 + x2) / 2;
            d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 7},${y2}`;
          } else {
            const rr = Math.min(
              r,
              ady / 2,
              Math.max(0, (midX - x1) / 2),
              Math.max(0, (x2 - 7 - midX) / 2)
            );
            const sgn = dy >= 0 ? 1 : -1;
            d = `M${x1},${y1} H${midX - rr}` + (rr > 0.5 ? ` Q${midX},${y1} ${midX},${y1 + sgn * rr}` : "") + ` V${y2 - sgn * rr}` + (rr > 0.5 ? ` Q${midX},${y2} ${midX + rr},${y2}` : ` H${midX}`) + ` H${Math.max(midX, x2 - 7)}`;
          }
          return d;
        }).filter(Boolean);
      },
      trackGanttLink(e) {
        if (!this.ganttLinkFrom) return;
        const grid = e.currentTarget.closest(".at-gantt");
        if (!grid) return;
        const rectG = grid.getBoundingClientRect();
        const w = this.ganttDayWidth();
        const fi = this.ganttData.rows.indexOf(this.ganttLinkFrom);
        const tracks = grid.querySelectorAll(".at-gantt-track");
        let x1, y1;
        const barF = fi >= 0 && tracks[fi] ? tracks[fi].querySelector(".at-gantt-bar") : null;
        if (barF) {
          const rf = barF.getBoundingClientRect();
          x1 = rf.right - rectG.left;
          y1 = rf.top + rf.height / 2 - rectG.top;
        } else {
          x1 = this.ganttLinkFrom.leftDays * w + Math.max(6, this.ganttLinkFrom.spanDays * w - 4);
          y1 = 34 + this.ganttData.sections.length * 38 + fi * 34 + 17;
        }
        const x2 = e.clientX - rectG.left;
        const y2 = e.clientY - rectG.top;
        const mx = (x1 + x2) / 2;
        this.ganttLinkPath = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      },
      /** Клик по пустому месту дорожки — отменить рисование связи */
      cancelGanttLink() {
        this.ganttLinkFrom = null;
        this.ganttLinkPath = null;
      },
      ganttBarStyle(g) {
        const w = this.ganttDayWidth();
        return `left:${g.leftDays * w}px;width:${Math.max(6, g.spanDays * w - 4)}px`;
      },
      ganttSecBarStyle(s) {
        const w = this.ganttDayWidth();
        return `left:${s.leftDays * w}px;width:${Math.max(6, s.spanDays * w - 4)}px`;
      },
      startGanttDrag(e, g) {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startLeft = g.leftDays;
        const w = this.ganttDayWidth();
        this.ganttDrag = { row: g.row, days: g.leftDays };
        const onMove = (ev) => {
          const d = Math.round((ev.clientX - startX) / w);
          g.leftDays = Math.max(0, startLeft + d);
          this.ganttDrag.days = g.leftDays;
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (g.leftDays !== startLeft) {
            this.pushHistory("\u0421\u0434\u0432\u0438\u0433 \u0440\u0430\u0431\u043E\u0442\u044B \u043D\u0430 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u0435");
            g.row.startAt = g.leftDays;
            this.logActivity(`\xAB${(g.name || "").slice(0, 30)}\xBB \u043D\u0430\u0447\u043D\u0451\u0442\u0441\u044F \u043D\u0430 ${g.leftDays}-\u0439 \u0434\u0435\u043D\u044C`);
          }
          this.ganttDrag = null;
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      },
      resetGanttShift(row) {
        row.startAt = null;
        this.logActivity("\u0421\u0431\u0440\u043E\u0441 \u0440\u0443\u0447\u043D\u043E\u0433\u043E \u0441\u0434\u0432\u0438\u0433\u0430 \u0440\u0430\u0431\u043E\u0442\u044B");
      },
      ganttLinkClick(e, g) {
        e.stopPropagation();
        if (!this.ganttLinkFrom) {
          this.ganttLinkFrom = g;
        } else {
          if (this.ganttLinkFrom !== g) {
            this.pushHistory("\u0421\u043E\u0437\u0434\u0430\u043D\u0430 \u0441\u0432\u044F\u0437\u044C \u0413\u0430\u043D\u0442\u0430");
            const fromNum = this.rowNumber(this.ganttLinkFrom.row.id);
            if (fromNum === null || fromNum === void 0) {
              this.logActivity("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043D\u043E\u043C\u0435\u0440 \u043F\u0440\u0435\u0434\u0448\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u0438\u043A\u0430 \u2014 \u0441\u0432\u044F\u0437\u044C \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0430");
            } else {
              g.row.pred = String(fromNum);
              this.logActivity(`\u0421\u0432\u044F\u0437\u044C: \u2116${fromNum} \u2192 \u2116${this.rowNumber(g.row.id) ?? "\u2014"}`);
            }
          }
          this.ganttLinkFrom = null;
          this.ganttLinkPath = null;
        }
      },
      /** Начало рисования связи перетаскиванием (drawio-style): зажать ручку и тянуть к цели */
      startLinkDrag(e, g) {
        e.preventDefault();
        e.stopPropagation();
        if (this.ganttLinkFrom && this.ganttLinkFrom !== g) {
          this.ganttLinkClick(e, g);
          return;
        }
        if (!this.ganttLinkFrom) this.ganttLinkFrom = g;
        const onUp = (ev) => {
          window.removeEventListener("mouseup", onUp);
          const target = ev.target && ev.target.closest ? ev.target.closest(".at-gantt-bar") : null;
          if (target && this.ganttLinkFrom) {
            const rows = this.ganttData.rows;
            const idx = Array.prototype.findIndex.call(
              document.querySelectorAll(".at-gantt .at-gantt-track"),
              (t) => t.contains(target)
            );
            const gTo = idx >= 0 ? rows[idx] : null;
            if (gTo && gTo !== this.ganttLinkFrom) {
              this.pushHistory("\u0421\u043E\u0437\u0434\u0430\u043D\u0430 \u0441\u0432\u044F\u0437\u044C \u0413\u0430\u043D\u0442\u0430");
              const fromNum = this.rowNumber(this.ganttLinkFrom.row.id);
              if (fromNum !== null && fromNum !== void 0) {
                gTo.row.pred = String(fromNum);
                this.logActivity(`\u0421\u0432\u044F\u0437\u044C: \u2116${fromNum} \u2192 \u2116${this.rowNumber(gTo.row.id) ?? "\u2014"}`);
              }
            }
          }
          this.ganttLinkFrom = null;
          this.ganttLinkPath = null;
        };
        window.addEventListener("mouseup", onUp);
      },
      removePred(row) {
        row.pred = "";
      },
      ganttDateLabel(offsetDays) {
        const d = new Date(this.ganttData.start + offsetDays * 864e5);
        return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
      },
      ganttTicks() {
        const step = this.ganttData.totalDays <= 15 ? 1 : this.ganttData.totalDays <= 40 ? 5 : 10;
        const ticks = [];
        for (let i = 0; i < this.ganttData.totalDays; i += step) ticks.push(i);
        return ticks;
      },
      ganttDayWidth() {
        return Math.max(26, Math.min(64, Math.floor(980 / this.ganttData.totalDays)));
      },
      /** Размер SVG-слоя связей (ширина/высота сетки диаграммы) */
      get ganttLinksSize() {
        const g = this.ganttData;
        void this.layoutTick;
        const w = this.ganttDayWidth();
        const maxRight = g.rows.reduce((m, r) => Math.max(m, (r.leftDays + r.spanDays) * w), 0);
        let h = 34 + g.sections.length * 38 + g.rows.length * 34;
        if (g.rows.length) {
          const grid = document.querySelector(".at-gantt");
          if (grid) h = Math.max(h, grid.getBoundingClientRect().height);
        }
        return {
          w: Math.max(g.totalDays * w, maxRight + 24),
          h
        };
      },
      /** Правый клик по полосе: убрать связь или ручной сдвиг */
      onBarContext(g) {
        if (g.row.pred) {
          this.pushHistory("\u0423\u0434\u0430\u043B\u0435\u043D\u0430 \u0441\u0432\u044F\u0437\u044C \u0413\u0430\u043D\u0442\u0430");
          g.row.pred = "";
          this.logActivity(`\u0421\u043D\u044F\u0442\u0430 \u0441\u0432\u044F\u0437\u044C \u0443 \xAB${(g.name || "").slice(0, 30)}\xBB`);
        } else if (Number(g.row.startAt) >= 0) {
          this.resetGanttShift(g.row);
        }
      },
      /** Экспорт Ганта в PNG (указатель №5: PNG/SVG слиты в одну кнопку — выбор формата в диалоге) */
      exportGantt() {
        const svg = this.buildGanttSVG();
        const choice = confirm(
          "\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u044B \u0413\u0430\u043D\u0442\u0430.\n\nOK \u2014 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u0430\u043A PNG (\u0440\u0430\u0441\u0442\u0440\u043E\u0432\u043E\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435)\n\u041E\u0442\u043C\u0435\u043D\u0430 \u2014 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u0430\u043A SVG (\u0432\u0435\u043A\u0442\u043E\u0440\u043D\u044B\u0439 \u0444\u0430\u0439\u043B)"
        );
        if (choice) this.exportGanttPng(svg);
        else this.exportGanttSvg(svg);
      },
      ganttHasShifts() {
        return this.ganttData.rows.some((g) => Number(g.row.startAt) >= 0);
      },
      resetAllGanttShifts() {
        this.pushHistory("\u0421\u0431\u0440\u043E\u0448\u0435\u043D\u044B \u0432\u0441\u0435 \u0440\u0443\u0447\u043D\u044B\u0435 \u0441\u0434\u0432\u0438\u0433\u0438 \u0413\u0430\u043D\u0442\u0430");
        for (const sec of this.data.sections) {
          const secs = this.isChapter(sec) ? sec.children : [sec];
          for (const s of secs) for (const r of s.resources) r.startAt = null;
        }
        this.logActivity("\u0412\u0441\u0435 \u0440\u0430\u0431\u043E\u0442\u044B \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u044B \u0432 \u0430\u0432\u0442\u043E\u043F\u043B\u0430\u043D");
      },
      groupTypeLabel(type) {
        return this.typeLabel({ type });
      },
      /** Строки сводной ведомости (плоские: группировки и сортировки запрещены) */
      get summaryRows() {
        const f = this.summarySearch.trim().toLowerCase();
        const all = this.summaryResources.filter(
          (e) => !f || String(e.name).toLowerCase().includes(f) || String(e.unit).toLowerCase().includes(f)
        );
        return all.map((e, i) => ({
          key: "r" + i,
          num: i + 1,
          e,
          avgPrice: e.qty > 0 ? e.cost / e.qty : e.price || 0
        }));
      },
      exportSummaryCsv() {
        const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
        const lines = ["\u2116;\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435;\u0420\u0430\u0437\u0434\u0435\u043B;\u0422\u0438\u043F;\u0415\u0434.;\u041A\u043E\u043B-\u0432\u043E;\u0421\u0440\u0435\u0434\u043D\u044F\u044F \u0446\u0435\u043D\u0430;\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C;\u0420\u0430\u0441\u0446\u0435\u043D\u043A\u0438"];
        let n = 0;
        for (const e of this.summaryResources) {
          lines.push(
            [
              ++n,
              e.name,
              [...e.sections].join(", "),
              this.groupTypeLabel(e.type),
              e.unit,
              e.qty,
              (e.qty > 0 ? e.cost / e.qty : 0).toFixed(2),
              e.cost.toFixed(2),
              [...e.bases].join(" / ")
            ].map(esc).join(";")
          );
        }
        this.download("svod-resursy.csv", "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
      },
      get nsbFiltered() {
        const f = this.nsbSearch.trim().toLowerCase();
        if (!f) return this.nsbItems;
        return this.nsbItems.filter(
          (n) => (n.name || "").toLowerCase().includes(f) || (n.basis || "").toLowerCase().includes(f) || (n.unit || "").toLowerCase().includes(f)
        );
      },
      nsbAddNew() {
        const item = {
          id: uid(),
          basis: "",
          name: "",
          type: "material",
          unit: "",
          price: 0,
          note: ""
        };
        this.nsbItems.unshift(item);
        this.nsbEditId = item.id;
        this.nsbDraft = { ...item };
        this.saveNsb();
      },
      nsbEdit(item) {
        this.nsbEditId = item.id;
        this.nsbDraft = { ...item };
      },
      nsbSaveEdit() {
        if (!this.nsbDraft) return;
        const idx = this.nsbItems.findIndex((n) => n.id === this.nsbEditId);
        if (idx >= 0) {
          this.nsbItems[idx] = { ...this.nsbItems[idx], ...this.nsbDraft };
          this.saveNsb();
        }
        this.nsbEditId = null;
        this.nsbDraft = null;
      },
      nsbDelete(id) {
        const item = this.nsbItems.find((n) => n.id === id);
        if (!item) return;
        if (!confirm(`\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0438\u0437 \u041D\u0421\u0411 \xAB${item.name || item.basis}\xBB?`)) return;
        this.nsbItems = this.nsbItems.filter((n) => n.id !== id);
        if (this.nsbEditId === id) {
          this.nsbEditId = null;
          this.nsbDraft = null;
        }
        this.saveNsb();
      },
      nsbResetDefaults() {
        if (!confirm(
          "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u0440\u0430\u0441\u0446\u0435\u043D\u043E\u043A \u041D\u0421\u0411? \u0422\u0435\u043A\u0443\u0449\u0438\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0431\u0430\u0437\u044B \u0431\u0443\u0434\u0443\u0442 \u043F\u043E\u0442\u0435\u0440\u044F\u043D\u044B."
        ))
          return;
        this.nsbItems = defaultNsb();
        this.nsbEditId = null;
        this.nsbDraft = null;
        this.saveNsb();
      },
      nsbApply(item) {
        const targetId = this.selectedIds.size === 1 ? [...this.selectedIds][0] : null;
        let appliedTo = null;
        if (targetId) {
          for (const sec of this.data.sections) {
            const r = sec.resources.find((x) => x.id === targetId);
            if (r) {
              appliedTo = r;
              break;
            }
          }
        }
        if (!appliedTo) {
          let si = this.currentTargetSection();
          if (si === null || !this.data.sections[si]) {
            this.data.sections.push(newSection("\u041D\u043E\u0432\u044B\u0439 \u0440\u0430\u0437\u0434\u0435\u043B"));
            si = this.data.sections.length - 1;
            this.activeTab = si;
          }
          appliedTo = newRow({});
          this.data.sections[si].resources.push(appliedTo);
        }
        appliedTo.basis = item.basis;
        appliedTo.name = item.name;
        appliedTo.type = item.type;
        appliedTo.unit = item.unit;
        appliedTo.price = item.price;
        copyFrameworkFields(item, appliedTo);
        this.nsbModalOpen = false;
      },
      nsbApplyToSelected() {
        if (!this.selectedIds.size) {
          alert("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435 (\u043A\u043B\u0438\u043A \u043F\u043E \u043D\u043E\u043C\u0435\u0440\u0443 \u0441\u0442\u0440\u043E\u043A\u0438, Ctrl+A \u2014 \u0432\u0441\u0435 \u0432\u0438\u0434\u0438\u043C\u044B\u0435).");
          return;
        }
        this.pushHistory("\u041F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u044B \u0446\u0435\u043D\u044B \u041D\u0421\u0411 \u043A \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u044E");
        let updated = 0;
        for (const sec of this.data.sections) {
          for (const r of sec.resources) {
            if (!this.selectedIds.has(r.id)) continue;
            const hit = this.nsbItems.find(
              (n) => r.basis && n.basis && r.basis.trim().toLowerCase() === n.basis.trim().toLowerCase() || r.name && n.name && r.name.trim().toLowerCase() === n.name.trim().toLowerCase()
            );
            if (hit) {
              r.price = hit.price;
              if (!r.unit) r.unit = hit.unit;
              if (!r.basis) r.basis = hit.basis;
              updated++;
            }
          }
        }
        alert(
          updated ? `\u0426\u0435\u043D\u044B \u0438\u0437 \u041D\u0421\u0411 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u044B \u0432 ${updated} \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u043F\u0438\u0441\u044F\u0445.` : "\u0421\u0440\u0435\u0434\u0438 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u043D\u0435\u0442 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439 \u0441 \u041D\u0421\u0411 (\u043F\u043E \u0448\u0438\u0444\u0440\u0443 \u0438\u043B\u0438 \u043D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u044E)."
        );
      },
      exportNsb() {
        const toon = encodeValue(STORAGE_KEYS.NSB, this.nsbItems);
        this.download("nsb.toon", toon, "text/plain;charset=utf-8");
      },
      importNsb(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const arr = decodeValue(STORAGE_KEYS.NSB, String(reader.result));
            if (!Array.isArray(arr)) throw new Error("\u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u043C\u0430\u0441\u0441\u0438\u0432 \u0437\u0430\u043F\u0438\u0441\u0435\u0439");
            const FW_KEYS = [
              "wasteGroup",
              "perUnit",
              "unitMassT",
              "vehicleCapT",
              "distanceKm",
              "tariffPerKm",
              "supplyFee",
              "kGabarit",
              "manipulatorFlag",
              "unloadMachineHr",
              "unloadHours",
              "moveDistM",
              "moveSpeedMh",
              "perPct",
              "storePct",
              "perOn",
              "storeOn",
              "night",
              "holiday"
            ];
            this.nsbItems = arr.map((n) => {
              const base = {
                id: n.id || uid(),
                basis: n.basis || "",
                name: n.name || "",
                type: n.type || "material",
                unit: n.unit || "",
                price: Number(n.price) || 0,
                note: n.note || ""
              };
              for (const k of FW_KEYS) if (n[k] !== void 0) base[k] = n[k];
              return base;
            });
            this.saveNsb();
          } catch (e) {
            alert("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u041D\u0421\u0411: " + e.message);
          }
        };
        reader.readAsText(file, "utf-8");
        ev.target.value = "";
      },
      printPage() {
        window.print();
      },
      suggestionsFor(field, item) {
        const vals = /* @__PURE__ */ new Set();
        for (const sec of this.data.sections) {
          for (const r of sec.resources) {
            const v = field === "total" ? null : r[field];
            if (v !== "" && v !== null && !(Number(v) === 0)) vals.add(String(v));
          }
        }
        let arr = [...vals].sort((a, b) => a.localeCompare(b, "ru"));
        if (field === "pred") {
          arr = this.flatRows.filter((i) => i.row.id !== item.row.id).map((i) => String(i.index));
        }
        return arr.slice(0, 12);
      },
      acceptSuggestion(item, field, value) {
        if (field === "qty" || field === "price" || field === "days")
          item.row[field] = Number(value) || 0;
        else item.row[field] = value;
        this.editing = null;
        if (field === "price") this.syncResourcePrice(item.row);
      }
      // mergeSameResources(groupKey) удалён: группировки запрещены (см. README «⛔ Запрещено»).
    };
  };
  window.ganttLinks = function ganttLinks() {
    const NS = "http://www.w3.org/2000/svg";
    let lastKey = "";
    return {
      layoutTick: 0,
      _ro: null,
      init(el) {
        requestAnimationFrame(() => {
          this.layoutTick++;
        });
        if (typeof ResizeObserver === "undefined") return;
        const grid = el.closest(".at-gantt");
        if (!grid) return;
        let raf = 0;
        this._ro = new ResizeObserver(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            this.layoutTick++;
          });
        });
        this._ro.observe(grid);
      },
      destroy() {
        if (this._ro) this._ro.disconnect();
      },
      render(el, lines, preview) {
        this.layoutTick++;
        const key = lines.join("|");
        if (key !== lastKey) {
          lastKey = key;
          el.replaceChildren(
            ...lines.map((d) => {
              const p = document.createElementNS(NS, "path");
              p.setAttribute("d", d);
              p.setAttribute("class", "at-gantt-linkpath");
              p.setAttribute("marker-end", "url(#arrowhead)");
              return p;
            })
          );
          requestAnimationFrame(() => {
            for (const p of el.querySelectorAll(".at-gantt-linkpath")) {
              try {
                const len = Math.ceil(p.getTotalLength()) + 8;
                p.style.setProperty("--len", len);
              } catch {
              }
            }
          });
        }
        let pv = document.getElementById("gantt-link-preview-layer");
        if (!preview && !pv) return;
        if (!pv) {
          pv = document.createElementNS(NS, "g");
          pv.id = "gantt-link-preview-layer";
          pv.style.pointerEvents = "none";
          el.parentNode.appendChild(pv);
        }
        if (!preview) {
          pv.remove();
          return;
        }
        pv.replaceChildren(
          (() => {
            const p = document.createElementNS(NS, "path");
            p.setAttribute("d", preview);
            p.setAttribute("class", "at-gantt-linkpath preview");
            p.setAttribute("marker-end", "url(#arrowhead)");
            return p;
          })()
        );
      }
    };
  };
  document.addEventListener("DOMContentLoaded", () => {
    if (!isLocalStorageAvailable()) {
      alert("localStorage \u043D\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u041D\u0435\u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u0438 \u043C\u043E\u0433\u0443\u0442 \u043D\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C.");
    }
  });
  var app_default = window.smeta;
})();
