const estado = document.getElementById('estado');
const selAct = document.getElementById('sel-actividad');

fetch('/api/actividades')
  .then(r => r.json())
  .then(lista => {
    lista.forEach(a => {
      const opt   = document.createElement('option');
      opt.value   = a.id;
      opt.textContent = `[${a.tipo}] ${a.nombre}`;
      selAct.appendChild(opt);
    });
  })
  .catch(() => {
    estado.style.color = 'red';
    estado.textContent = '❌ No se pudo cargar la lista de actividades';
  });

function onScanSuccess(decodedText) {
  if (!selAct.value) {
    estado.style.color = 'red';
    estado.textContent = '❗ Selecciona una actividad';
    return;
  }

  html5QrcodeScanner.clear();               
  estado.style.color = 'black';
  estado.textContent = '⏳ Registrando asistencia…';

  fetch('/api/asistir', {
    method : 'POST',
    headers: { 'Content-Type':'application/json' },
    body   : JSON.stringify({
      qr          : decodedText,            
      idActividad : Number(selAct.value)    
    })
  })
  .then(r => r.json())
  .then(json => {
    if (json.ok) {
      estado.style.color = 'green';
      estado.textContent = '✅ Asistencia registrada';
    } else {
      estado.style.color = 'red';
      estado.textContent = '❌ ' + (json.msg || 'Error');
    }
    setTimeout(() => window.location.reload(), 3000);
  })
  .catch(() => {
    estado.style.color = 'red';
    estado.textContent = '❌ Error de red';
    setTimeout(() => window.location.reload(), 3000);
  });
}

const html5QrcodeScanner = new Html5QrcodeScanner(
  'qr-reader',
  { fps: 10, qrbox: 200 }
);
html5QrcodeScanner.render(onScanSuccess);
