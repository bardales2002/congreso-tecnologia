async function cargarActividades() {
  const res   = await fetch('/api/actividades');
  const lista = await res.json();
  const cont  = document.getElementById('contenedor-actividades');

  lista.forEach(act => {
    cont.insertAdjacentHTML(
      'beforeend',
      `<label>
         <input type="checkbox" value="${act.id}">
         [${act.tipo}] ${act.nombre}
       </label>`
    );
  });
}
cargarActividades();

document.getElementById('form-inscripcion')
  .addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;

    const datos = {
      nombre  : form.nombre.value,
      correo  : form.correo.value,
      colegio : form.colegio.value,
      telefono: form.telefono.value,
      tipo    : form.tipo.value,
      actividades: Array.from(
        document.querySelectorAll('#contenedor-actividades input:checked')
      ).map(cb => Number(cb.value))      
    };

    try {
      const res  = await fetch('/api/inscribir', {
        method : 'POST',
        headers: { 'Content-Type':'application/json' },
        body   : JSON.stringify(datos)
      });
      const json = await res.json();

      const msg = document.getElementById('mensaje');
      if (json.success) {
        msg.style.color = 'green';
        msg.textContent = '✅ Inscripción exitosa';
        form.reset();
        document.querySelectorAll('#contenedor-actividades input')
                .forEach(cb => cb.checked = false);
      } else {
        msg.style.color = 'red';
        msg.textContent = json.msg || '❌ Error al inscribirse';
      }
    } catch {
      const msg = document.getElementById('mensaje');
      msg.style.color = 'red';
      msg.textContent = '❌ Error de red';
    }
  });
