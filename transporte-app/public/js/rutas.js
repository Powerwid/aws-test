const form = document.querySelector('#ruta-form');

async function loadRutas() {
  const rutas = await api('/api/rutas');
  document.querySelector('#count').textContent = `${rutas.length} registradas`;
  renderRows(document.querySelector('#rutas-body'), rutas, [
    r => r.id, r => r.origen, r => r.destino,
    r => dateLabel(r.fecha_salida), r => r.hora_salida.slice(0, 5), r => money(r.precio)
  ]);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  saveForm(form, '/api/rutas', loadRutas);
});

loadRutas().catch(err => showMessage(err.message, 'error'));
