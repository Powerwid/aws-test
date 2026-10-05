const form = document.querySelector('#cliente-form');

async function loadClientes() {
  const clientes = await api('/api/clientes');
  document.querySelector('#count').textContent = `${clientes.length} registrados`;
  renderRows(document.querySelector('#clientes-body'), clientes, [
    c => c.id, c => `${c.nombre} ${c.apellido}`, c => c.dni, c => c.telefono, c => c.email
  ]);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  saveForm(form, '/api/clientes', loadClientes);
});

loadClientes().catch(err => showMessage(err.message, 'error'));
