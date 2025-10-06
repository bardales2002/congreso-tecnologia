function crearTabla(data) {
  if (!data.length) return '<p>No hay registros.</p>';

  const headers = Object.keys(data[0]);
  let html = '<table border="1" cellpadding="6"><thead><tr>';
  headers.forEach(h => html += `<th>${h}</th>`);
  html += '</tr></thead><tbody>';
  data.forEach(row => {
    html += '<tr>';
    headers.forEach(h => html += `<td>${row[h] ?? ''}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function formatearFechaISO(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', hour12:false
  });
}

function descargarCSV(data, nombre) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const filas = data.map(row =>
    headers.map(h => JSON.stringify(row[h] ?? '')).join(',')
  );
  const csv = [headers.join(','), ...filas].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = nombre + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function poblarSelect() {
  const sel = document.getElementById('sel-actividad');
  const res = await fetch('/api/actividades');
  const acts = await res.json();
  acts.forEach(a => {
    sel.insertAdjacentHTML('beforeend',
      `<option value="${a.id}">[${a.tipo}] ${a.nombre}</option>`);
  });
}
poblarSelect();

document.getElementById('btn-cargar').addEventListener('click', async () => {
  const sel = document.getElementById('sel-actividad');
  const tabla = document.getElementById('tabla-wrapper');
  let url, detalle, resumen;

  if (sel.value === 'general') {
    url = '/api/reporte/general';
    const json = await (await fetch(url)).json();
    detalle = json.porHora;
    resumen = [json.resumen];
 } else {
  url = '/api/reporte/actividad/' + sel.value;
  const json = await (await fetch(url)).json();

  detalle = json.detalle.map(r => ({
    ...r,
    fecha_hora: r.fecha_hora ? formatearFechaISO(r.fecha_hora) : r.fecha_hora
  }));

  resumen = [json.resumen];
}
  tabla.innerHTML =
    '<h3>Resumen</h3>'   + crearTabla(resumen) +
    '<h3>Detalle</h3>'    + crearTabla(detalle);

  window.__ultimoCSV = { detalle, resumen, nombre: sel.options[sel.selectedIndex].text };
});

document.getElementById('btn-descargar').addEventListener('click', () => {
  if (!window.__ultimoCSV) return alert('Primero haga clic en "Ver reporte".');
  const { detalle, nombre } = window.__ultimoCSV;
  descargarCSV(detalle, 'reporte_' + nombre.replace(/\s+/g,'_'));
});
