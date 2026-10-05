const form = document.querySelector('#reserva-form');
const clienteSelect = form.elements.cliente_id;
const rutaSelect = form.elements.ruta_id;
const quantity = form.elements.cantidad_pasajes;
const submit = form.querySelector('button[type="submit"]');
let rutas = [];

function updateTotal() {
  const ruta = rutas.find(r => String(r.id) === rutaSelect.value);
  const cantidad = Number(quantity.value);
  document.querySelector('#total').textContent = ruta && Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= 100
    ? money(Math.round(Number(ruta.precio) * 100) * cantidad / 100) : 'S/ 0.00';
}

async function loadOptions() {
  const [clientes, availableRutas] = await Promise.all([api('/api/clientes'), api('/api/rutas')]);
  rutas = availableRutas;
  for (const cliente of clientes) {
    clienteSelect.add(new Option(`${cliente.nombre} ${cliente.apellido} · DNI ${cliente.dni}`, cliente.id));
  }
  for (const ruta of rutas) {
    rutaSelect.add(new Option(`${ruta.origen} → ${ruta.destino} · ${dateLabel(ruta.fecha_salida)} ${ruta.hora_salida.slice(0, 5)} · ${money(ruta.precio)}`, ruta.id));
  }
  submit.disabled = !clientes.length || !rutas.length;
  if (submit.disabled) showMessage('Registra al menos un cliente y una ruta antes de crear una reserva.', 'info');
}

async function loadReservas() {
  const reservas = await api('/api/reservas');
  document.querySelector('#count').textContent = `${reservas.length} registradas`;
  renderRows(document.querySelector('#reservas-body'), reservas, [
    r => r.id, r => `${r.nombre} ${r.apellido}`, r => `${r.origen} → ${r.destino}`,
    r => `${dateLabel(r.fecha_salida)} ${r.hora_salida.slice(0, 5)}`,
    r => r.cantidad_pasajes, r => money(r.total), r => r.estado
  ]);
}

rutaSelect.addEventListener('change', updateTotal);
quantity.addEventListener('input', updateTotal);
form.addEventListener('submit', event => {
  event.preventDefault();
  saveForm(form, '/api/reservas', async () => { updateTotal(); await loadReservas(); });
});

Promise.all([loadOptions(), loadReservas()]).catch(err => showMessage(err.message, 'error'));
