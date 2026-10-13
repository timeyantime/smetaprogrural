/* СметаПро — офлайн-экспорт в XLSX (SpreadsheetML 2003) и PNG (SVG→canvas).
   Без внешних библиотек: файл .xls открывается в Excel/LibreOffice;
   картинка Ганта рисуется через сериализацию SVG в <canvas> (data-URL, без сетевых запросов). */

function xmlEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/* sheetBlocks: [{ name, rows: [[{v?, s?, t?}, ...], ...] }]
   s — стиль: Default | Header | Title | Money | Num | Section | Total */
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

/* Рендер SVG-строки в PNG без сети: svg → data-URL → Image → canvas → toBlob. */
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

/* Функции объявлены как function declarations — они автоматически становятся
   глобальными при загрузке файла классическим <script> (так подключен office.js). */

/* ES-модульный экспорт: единый источник SpreadsheetML-логики.
   Сервис services/export.js импортирует отсюда buildSpreadsheetML/xmlEsc,
   а не дублирует их. */
export { xmlEsc, buildSpreadsheetML, svgToPng };
