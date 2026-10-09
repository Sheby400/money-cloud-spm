import './style.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const element = (id) => document.getElementById(id);
const money = (cents) => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
}).format(cents / 100);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

element('app').innerHTML = `
  <main class="mx-auto max-w-5xl p-5 md:p-10">
    <header class="mb-8">
      <p class="font-semibold text-teal-700">MONEYCLOUD · LABORATORIO CLOUD</p>
      <h1 class="mt-2 text-3xl font-bold">Mis finanzas</h1>
      <p class="text-slate-500">Demo académica. No introduzcas datos financieros reales.</p>
    </header>

    <div id="error" role="alert" class="mb-5 hidden rounded bg-red-100 p-3 text-red-900"></div>

    <section class="mb-8 grid gap-4 md:grid-cols-3">
      <article class="rounded-xl bg-white p-5 shadow-sm">
        <p>Ingresos</p>
        <strong id="income" class="text-2xl text-teal-700">—</strong>
      </article>
      <article class="rounded-xl bg-white p-5 shadow-sm">
        <p>Egresos</p>
        <strong id="expense" class="text-2xl text-rose-700">—</strong>
      </article>
      <article class="rounded-xl bg-slate-900 p-5 text-white">
        <p>Balance</p>
        <strong id="balance" class="text-2xl">—</strong>
      </article>
    </section>

    <section class="grid gap-6 md:grid-cols-5">
      <form id="form" class="space-y-4 rounded-xl bg-white p-5 shadow-sm md:col-span-2">
        <h2 class="text-xl font-bold">Nuevo movimiento</h2>
        <label class="block">Tipo
          <select id="type" class="mt-1 block w-full rounded border p-2">
            <option value="income">Ingreso</option>
            <option value="expense">Egreso</option>
          </select>
        </label>
        <label class="block">Descripción
          <input id="description" required minlength="2" maxlength="100"
            class="mt-1 block w-full rounded border p-2" placeholder="Ej. Transporte" />
        </label>
        <label class="block">Categoría
          <input id="category" required minlength="2" maxlength="40"
            class="mt-1 block w-full rounded border p-2" placeholder="Ej. Escuela" />
        </label>
        <label class="block">Monto (MXN)
          <input id="amount" type="number" min="0.01" max="1000000" step="0.01" required
            class="mt-1 block w-full rounded border p-2" placeholder="150.00" />
        </label>
        <button class="w-full rounded bg-teal-700 px-5 py-3 text-white hover:bg-teal-800">
          Guardar movimiento
        </button>
      </form>

      <div class="rounded-xl bg-white p-5 shadow-sm md:col-span-3">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-xl font-bold">Movimientos</h2>
          <select id="filter" aria-label="Filtrar movimientos" class="rounded border p-2">
            <option value="all">Todos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Egresos</option>
          </select>
        </div>
        <div id="list" class="space-y-3">Cargando...</div>
      </div>
    </section>
  </main>
`;

let transactions = [];

function showError(message) {
  element('error').textContent = message;
  element('error').classList.remove('hidden');
}

function render() {
  const selected = element('filter').value;
  const items = transactions.filter((item) => selected === 'all' || item.type === selected);

  element('list').innerHTML = items.length
    ? items.map((item) => `
        <article class="flex items-center justify-between gap-2 border-b pb-3">
          <div>
            <p class="font-semibold">${escapeHtml(item.description)}</p>
            <p class="text-xs text-slate-500">
              ${escapeHtml(item.category)} · ${escapeHtml(item.createdAt.slice(0, 10))}
            </p>
          </div>
          <div class="text-right">
            <p class="font-bold ${item.type === 'income' ? 'text-teal-700' : 'text-rose-700'}">
              ${item.type === 'income' ? '+' : '−'}${money(item.amountCents)}
            </p>
            <button class="delete text-xs underline" data-id="${item.id}">Eliminar</button>
          </div>
        </article>
      `).join('')
    : '<p class="text-slate-500">Sin movimientos</p>';
}

async function refresh() {
  try {
    const [list, summary] = await Promise.all([
      request('/api/v1/transactions'),
      request('/api/v1/summary'),
    ]);
    transactions = list.data;
    element('income').textContent = money(summary.data.incomeCents);
    element('expense').textContent = money(summary.data.expenseCents);
    element('balance').textContent = money(summary.data.balanceCents);
    render();
    element('error').classList.add('hidden');
  } catch (error) {
    showError(`No se pudo conectar con la API: ${error.message}`);
  }
}

element('filter').addEventListener('change', render);

element('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const amountCents = Math.round(Number(element('amount').value) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    showError('Monto inválido');
    return;
  }

  const button = event.target.querySelector('button');
  button.disabled = true;
  try {
    await request('/api/v1/transactions', {
      method: 'POST',
      body: JSON.stringify({
        type: element('type').value,
        description: element('description').value,
        category: element('category').value,
        amountCents,
      }),
    });
    event.target.reset();
    await refresh();
  } catch (error) {
    showError(`No se pudo guardar: ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

element('list').addEventListener('click', async (event) => {
  const button = event.target.closest('.delete');
  if (!button || !confirm('¿Eliminar este movimiento?')) return;

  try {
    await request(`/api/v1/transactions/${encodeURIComponent(button.dataset.id)}`, {
      method: 'DELETE',
    });
    await refresh();
  } catch (error) {
    showError(`No se pudo eliminar: ${error.message}`);
  }
});

refresh();