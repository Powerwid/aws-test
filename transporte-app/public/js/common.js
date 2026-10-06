// Funciones pequeñas compartidas por las tres páginas.
async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud.');
  return data;
}

function showMessage(text, type = 'success') {
  const message = document.querySelector('#message');
  message.textContent = text;
  message.className = `message ${type}`;
  message.hidden = false;
}

function renderRows(body, rows, columns) {
  body.replaceChildren();
  if (!rows.length) {
    const cell = document.createElement('td');
    cell.colSpan = columns.length;
    cell.className = 'empty';
    cell.textContent = 'Todavía no hay registros.';
    const row = document.createElement('tr');
    row.append(cell);
    body.append(row);
    return;
  }
  for (const record of rows) {
    const row = document.createElement('tr');
    for (const column of columns) {
      const cell = document.createElement('td');
      const value = column(record);
      if (value instanceof Node) cell.append(value);
      else cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  }
}

function money(value) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function dateLabel(value) {
  return value.split('-').reverse().join('/');
}

async function saveForm(form, url, afterSave) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const data = await api(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    form.reset();
    showMessage(data.message);
    try {
      await afterSave();
    } catch (err) {
      showMessage(`${data.message} No se pudo actualizar la lista: ${err.message}`, 'error');
    }
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    button.disabled = false;
  }
}
