# План миграции legacy → модульная версия

Статус на момент составления: модульная версия (`src/js/app.js`) переносит
компонент из 235 функций legacy `js/app.js`. Перенесено ядро (134 функции)
и фаза 1 — каркас таблицы (29 функций, PR #15), всё покрыто тестами
(133 теста). **Осталось перенести 94 функции** — список ниже.

Активное приложение — legacy. Модульная версия подключается как резерв
(`window.__smetaModule`) и переключается на основную только после полного
переноса и сравнительного тестирования.

## Принципы

1. **Legacy — источник истины.** Не переписываем логику, переносим как есть,
   адаптируя под модели Project/Section/Resource и сервисы.
2. **Функция за функцией, тест за тестом.** Каждая перенесённая функция
   получает тест в `src/js/tests/migrated-ui.test.js` (см. тест
   «все бывшие заглушки теперь реализованы»).
3. **UI обновляем параллельно зоне**: разметка в `src/index.html` догоняет
   код той же веткой.
4. **Legacy не трогаем** до завершения миграции — он рабочий прод.
5. После каждой фазы — smoke-тест: обе версии открываются, базовый сценарий
   (создать смету → добавить раздел → строки → суммы сходятся) проходит в обеих.

## Фазы (123 функции по зонам)

### Фаза 1 — каркас таблицы (29 функций, низкий риск) — ✅ ВЫПОЛНЕНО (PR #15)

Отображение, форматирование, пагинация, редактирование ячеек — без этого
таблица в модульной версии не соберётся.

Примечания к переносу: `problemCount()` переведён на legacy-семантику
(геттер `problems` + фильтр по severity); `pageCount` — псевдоним над
существующим `totalPages` с защитой `Math.max(1, ...)`; `goToProblem`
задаёт вкладку напрямую (модульный `selectTab` переключает, а не устанавливает).

- Отображение/форматирование (16): `fmtNum`, `fmtMoney`, `typeLabel`,
  `setType`, `colIcon`, `colSpanFor`, `totalTableWidth`, `roundingLabel`,
  `exportable`, `rowTotal`, `sectionTotal`, `setRecalcMode`, `forceRecalc`,
  `problems`, `goToProblem`, `resetColWidths`
- Редактирование и строки (9): `commitEdit`, `openRowModal`, `addRow`,
  `saveRecordModal`, `removeRowById`, `moveRow`, `startRowDrag`,
  `endRowDrag`, `dropOnSection`
- Пагинация (4): `pageCount`, `goPage`, `gotoLastPage`, `pageLabel`
  (вычисляемые `filteredRows`, `sortedRows`, `totalPages` уже есть)

### Фаза 2 — структура сметы (26 функций)

- Разделы и главы (18): `openAddSectionModal`, `openEditSectionModal`,
  `saveSectionModal`, `addSection`, `removeSectionByTab`,
  `deleteSectionFromModal`, `duplicateSection`, `currentTargetSection`,
  `isChapter`, `chapterTotal`, `chapterRowTotal`, `toggleCollapse`,
  `makeChapter`, `promoteSection`, `demoteSection`, `findChapterOf`,
  `tabSections`, `scopedSections`
- Выделение и батч-операции (8): `selectOnly`, `toggleSelect`,
  `rangeSelect`, `clearSelection`, `selectionTotal`, `openBatchBar`,
  `batchApply`, `setAllSelectedPriceFromNsb`

### Фаза 3 — удобство работы (30 функций)

- Группировка и сортировка (15): `toggleGroupMenu`, `visibleGroups`,
  `groupedFlatRows`, `toggleGroupCollapse`, `groupCollapsedFn`, `groupLabel`,
  `groupByLabel`, `setGroupBy`, `toggleFieldMenu`, `sortDescOrAsc`,
  `sortDescOrAsc2`, `addSortLevel`, `removeSortLevel`, `sortLevelIndex`,
  `applySortToSections`
- Контекстное меню (10): `openCtxMenu`, `closeCtxMenu`, `ctxAction`,
  `ctxEditRow`, `ctxDuplicate`, `ctxMoveUp`, `ctxMoveDown`, `ctxDeleteRow`,
  `ctxApplyNsb`, `ctxCopyName`
- Ресурсы и подсказки (5): `applyResourcePrice`, `findResourceByName`,
  `suggestionsFor`, `acceptSuggestion`, `mergeSameResources`

### Фаза 4 — данные и вывод (22 функции)

- НСБ-менеджмент (10): `nsbFiltered`, `nsbAddNew`, `nsbEdit`, `nsbSaveEdit`,
  `nsbDelete`, `nsbResetDefaults`, `nsbApply`, `nsbApplyToSelected`,
  `exportNsb`, `importNsb` (базовые `openNsb`, `cancelNsbEdit`, `saveNsb`
  уже перенесены)
- Сводка (6): `summaryResources`, `summaryTotalCost`, `matchesFilter`,
  `hiddenCount`, `visibleCount`, `totalCount` — снимает плейсхолдер
  Summary View в `src/index.html`
- Проект, печать, экспорт (6): `projectFilled`, `saveProjectModal`,
  `download`, `downloadBlob`, `doPrint`, `printPage` (сервисы export.js
  уже дают JSON/CSV/Excel — останется подключить UI)

### Фаза 5 — Гант (16 функций, самая сложная)

`toggleGantt`, `ganttData`, `ganttLinkLines`, `trackGanttLink`,
`ganttBarStyle`, `ganttSecBarStyle`, `startGanttDrag`, `resetGanttShift`,
`ganttLinkClick`, `removePred`, `ganttDateLabel`, `ganttTicks`,
`ganttDayWidth`, `buildGanttSVG`, `exportGanttPng`, `exportGanttSvg` —
снимает плейсхолдер Gantt View в `src/index.html`.

Переносить последней: тянет за собой форматирование, drag-and-drop строк
и экспорт SVG/PNG.

## Известные заглушки на текущий момент

| Место | Что | Статус |
|---|---|---|
| `src/index.html` (Gantt View) | «В разработке...» | закрывается фазой 5 |
| `src/index.html` (Summary View) | «В разработке...» | закрывается фазой 4 |

Бывшие заглушки UI (12 функций) реализованы и покрыты тестами;
`problemCount()` реализован через сервис validation.
