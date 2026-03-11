const loginSection = document.getElementById('loginSection');
const reservasSection = document.getElementById('reservasSection');
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const tablaReservas = document.getElementById('tablaReservas');
const logoutBtn = document.getElementById('logoutBtn');

function hourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function getToken() {
  return localStorage.getItem('adminToken') || '';
}

function setLoggedIn(loggedIn) {
  loginSection.classList.toggle('hidden', loggedIn);
  reservasSection.classList.toggle('hidden', !loggedIn);
}

async function cargarReservas() {
  const token = getToken();
  const resp = await fetch('/api/reservas', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    setLoggedIn(false);
    return;
  }

  const data = await resp.json();
  if (!data.reservas.length) {
    tablaReservas.innerHTML = '<p>No hay reservas todavía.</p>';
    return;
  }

  const rows = data.reservas.map((r) => `
    <tr>
      <td>${r.nombre}</td>
      <td>${r.telefono}</td>
      <td>${r.fecha}</td>
      <td>${hourLabel(r.horaInicio)} - ${hourLabel(r.horaFin)}</td>
      <td>$${r.sena.toLocaleString('es-AR')}</td>
      <td>$${r.total.toLocaleString('es-AR')}</td>
      <td><button class="btn-secondary" data-id="${r.id}">Eliminar</button></td>
    </tr>
  `).join('');

  tablaReservas.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Teléfono</th>
          <th>Fecha</th>
          <th>Horario</th>
          <th>Seña</th>
          <th>Total</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  tablaReservas.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const del = await fetch(`/api/reservas/${btn.dataset.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (del.ok) cargarReservas();
    });
  });
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginStatus.textContent = 'Validando...';
  const payload = {
    usuario: document.getElementById('usuario').value,
    password: document.getElementById('password').value,
  };

  const resp = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();

  if (!resp.ok) {
    loginStatus.textContent = data.error || 'No se pudo iniciar sesión';
    return;
  }

  localStorage.setItem('adminToken', data.token);
  loginStatus.textContent = '';
  setLoggedIn(true);
  cargarReservas();
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  setLoggedIn(false);
});

if (getToken()) {
  setLoggedIn(true);
  cargarReservas();
}
