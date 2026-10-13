/**
 * Адаптер для совместимости со старым кодом
 * Переопределяет глобальные функции для работы с новым модульным кодом
 */

// Переопределяем глобальные функции из старых файлов
// Эти функции используются в index.html

// Из rounding.js
const ROUND_MODES = {
  kopecks: { label: 'копейки (2 знака)', digits: 2 },
  rubles: { label: 'рубли (0 знаков)', digits: 0 },
};

const ROUND_METHODS = {
  math: 'математическое (5 и выше — вверх)',
  bank: 'банковское (до ближайшего четного)',
  truncate: 'отбрасывание (вниз)',
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
        r = floor % 2 === 0 ? floor : floor + 1;
      } else {
        r = Math.round(scaled);
      }
      break;
    }
    case 'truncate':
      r = Math.floor(scaled);
      break;
    default:
      r = Math.sign(scaled) * Math.round(Math.abs(scaled));
  }
  return r / f;
}

function roundGrandTotal(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

// Экспортируем для совместимости
window.roundMoney = roundMoney;
window.roundGrandTotal = roundGrandTotal;
window.ROUND_MODES = ROUND_MODES;
window.ROUND_METHODS = ROUND_METHODS;

// Из office.js
function xmlEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildSpreadsheetML(sheetBlocks) {
  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<?mso-application progid="Excel.Sheet"?>');
  parts.push('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office"' +
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">');
  parts.push('<Styles>' +
    '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>' +
    '<Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1"/></Style>' +
    '<Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="10" ss:BOLD="1" ss:Color="#FFFFFF"/><Interior ss:Color="#172B4D" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>' +
    '<Style ss:ID="Money"><NumberFormat ss:Format="#,##0.00"/><Alignment ss:Horizontal="Right"/></Style>' +
    '<Style ss:ID="Num"><NumberFormat ss:Format="#,##0.####"/><Alignment ss:Horizontal="Right"/></Style>' +
    '<Style ss:ID="Section"><Font ss:FontName="Calibri" ss:Size="11" ss:BOLD="1"/><Interior ss:Color="#DEEBFF" ss:Pattern="Solid"/></Style>' +
    '<Style ss:ID="Total"><Font ss:FontName="Calibri" ss:Size="11" ss:BOLD="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>' +
    '</Styles>');
  for (const block of sheetBlocks) {
    parts.push(`<Worksheet ss:Name="${xmlEsc(block.name.slice(0, 31))}"><Table>`);
    for (const row of block.rows) {
      parts.push('<Row>');
      for (const cell of row) {
        if (cell == null) continue;
        const style = cell.s ? ` ss:StyleID="${cell.s}"` : '';
        if (cell.t === 's' || typeof cell.v === 'string') {
          parts.push(`<Cell${style}><Data ss:Type="String">${xmlEsc(cell.v)}</Data></Cell>`);
        } else if (typeof cell.v === 'number') {
          parts.push(`<Cell${style}><Data ss:Type="Number">${cell.v}</Data></Cell>`);
        } else {
          parts.push(`<Cell${style}/>`);
        }
      }
      parts.push('</Row>');
    }
    parts.push('</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"/></Worksheet>');
  }
  parts.push('</Workbook>');
  return parts.join('\n');
}

function svgToPng(svgMarkup, scale, callback) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = svgMarkup;
  const svg = wrapper.querySelector('svg');
  const W = Number(svg.getAttribute('width')) || 1200;
  const H = Number(svg.getAttribute('height')) || 600;
  const k = scale || 2;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W * k;
    canvas.height = H * k;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => callback(blob), 'image/png');
  };
  img.onerror = () => callback(null);
  img.src = url;
}

// Экспортируем для совместимости
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
