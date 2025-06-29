/* ───────────────────────────────────────────────
   1. Cargar actividades al abrir la página
   ─────────────────────────────────────────────── */
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

/* ───────────────────────────────────────────────
   2. Enviar inscripción + actividades seleccionadas
   ─────────────────────────────────────────────── */
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
      // → nuevo: IDs de actividades marcadas
      actividades: Array.from(
        document.querySelectorAll('#contenedor-actividades input:checked')
      ).map(cb => Number(cb.value))      // p.ej. [1,3]
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
        // desmarca los checkboxes
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
