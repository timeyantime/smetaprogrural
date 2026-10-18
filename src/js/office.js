/* СметаHome — офлайн утилиты: экранирование XML и PNG-экспорт (SVG→canvas).
   Экспорт в Excel удалён по требованию пользователя (см. README «⛔ Запрещено»). */

function xmlEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

/* Функции объявлены как function declarations — они автоматически становятся
   глобальными при загрузке файла классическим <script> (так подключен office.js). */

/* ES-модульный экспорт: единый источник SpreadsheetML-логики.
   Сервис services/export.js импортирует отсюда xmlEsc,
   а не дублирует их. */
export { xmlEsc, svgToPng };
