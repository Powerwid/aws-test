const form = document.querySelector('#reserva-form');
const clienteSelect = form.elements.cliente_id;
const rutaSelect = form.elements.ruta_id;
const quantity = form.elements.cantidad_pasajes;
const submit = form.querySelector('button[type="submit"]');
const documentForm = document.querySelector('#documento-form');
const reservaSelect = documentForm.elements.reserva_id;
const uploadButton = documentForm.querySelector('button[type="submit"]');
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
    r => r.cantidad_pasajes, r => money(r.total), r => r.estado,
    r => {
      if (!r.documento_s3_key) return '—';
      const link = document.createElement('a');
      link.href = `/api/reservas/${r.id}/documento`;
      link.textContent = 'Ver documento';
      link.className = 'document-link';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      return link;
    }
  ]);
  const selected = reservaSelect.value;
  reservaSelect.replaceChildren(new Option('Selecciona una reserva', ''));
  for (const reserva of reservas) {
    reservaSelect.add(new Option(`#${reserva.id} · ${reserva.nombre} ${reserva.apellido} · ${reserva.origen} → ${reserva.destino}`, reserva.id));
  }
  reservaSelect.value = selected;
  uploadButton.disabled = !reservas.length;
}

rutaSelect.addEventListener('change', updateTotal);
quantity.addEventListener('input', updateTotal);
form.addEventListener('submit', event => {
  event.preventDefault();
  saveForm(form, '/api/reservas', async () => { updateTotal(); await loadReservas(); });
});

documentForm.addEventListener('submit', async event => {
  event.preventDefault();
  const file = documentForm.elements.documento.files[0];
  if (!file || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
    return showMessage('Selecciona un archivo PDF, JPG, JPEG o PNG.', 'error');
  }
  if (file.size > 5 * 1024 * 1024) {
    return showMessage('El archivo supera el máximo permitido de 5 MB.', 'error');
  }
  uploadButton.disabled = true;
  try {
    const data = new FormData();
    data.append('documento', file);
    const result = await api(`/api/reservas/${reservaSelect.value}/documento`, { method: 'POST', body: data });
    documentForm.elements.documento.value = '';
    showMessage(result.message);
    try {
      await loadReservas();
    } catch (err) {
      showMessage(`${result.message} No se pudo actualizar la lista: ${err.message}`, 'error');
    }
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    uploadButton.disabled = reservaSelect.options.length <= 1;
  }
});

Promise.all([loadOptions(), loadReservas()]).catch(err => showMessage(err.message, 'error'));
