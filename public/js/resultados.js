const sel = document.getElementById('sel-anio');
const anioActual = new Date().getFullYear();
for (let y = anioActual; y >= anioActual - 4; y--) {
  sel.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);
}

document.getElementById('btn-cargar').addEventListener('click', cargar);
cargar();

function cargar() {
  const anio = sel.value || anioActual;
  fetch('/api/resultados/' + anio)
    .then(r => r.json())
    .then(mostrar);
}

function mostrar(data) {
  const cont = document.getElementById('resultados-wrapper');
  if (!data.competencias.length) {
    cont.innerHTML = '<p>No hay resultados para este año.</p>';
    return;
  }

  let html = '';
  data.competencias.forEach(c => {
    html += `<h2>${c.actividad}</h2><div class="card">`;
    c.ganadores.forEach(g => {
      const medalla = g.puesto === 1 ? '🥇'
                    : g.puesto === 2 ? '🥈' : '🥉';
      html += `
        <div style="display:flex;align-items:center;margin-bottom:12px;">
          <img src="${g.foto || 'https://via.placeholder.com/80'}"
               alt="foto"
               style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-right:15px;">
          <div>
            <strong>${medalla} ${g.nombre}</strong><br>
            <small>${g.descripcion || ''}</small>
          </div>
        </div>`;
    });
    html += '</div>';
  });
  cont.innerHTML = html;
}
