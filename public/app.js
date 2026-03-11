const fechaInput = document.getElementById('fecha');
const horaSelect = document.getElementById('horaInicio');
const form = document.getElementById('reservaForm');
const statusEl = document.getElementById('status');

const WHATSAPP = '543814095236';

function hourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

async function cargarHorarios() {
  const fecha = fechaInput.value;
  if (!fecha) return;

  horaSelect.innerHTML = '<option value="">Cargando horarios...</option>';

  const resp = await fetch(`/api/slots?fecha=${fecha}`);
  const data = await resp.json();

  horaSelect.innerHTML = '<option value="">Seleccioná un horario</option>';
  data.slots.forEach((slot) => {
    const option = document.createElement('option');
    option.value = slot.hora;
    option.disabled = !slot.disponible;
    option.textContent = `${hourLabel(slot.hora)} ${slot.disponible ? '✅ disponible' : '❌ bloqueado'}`;
    horaSelect.appendChild(option);
  });
}

fechaInput.addEventListener('change', cargarHorarios);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.textContent = 'Procesando reserva...';

  const payload = {
    nombre: document.getElementById('nombre').value,
    telefono: document.getElementById('telefono').value,
    fecha: fechaInput.value,
    horaInicio: Number(horaSelect.value),
    notas: document.getElementById('notas').value,
  };

  const resp = await fetch('/api/reservas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  if (!resp.ok) {
    statusEl.textContent = data.error || 'No se pudo crear la reserva.';
    return;
  }

  statusEl.textContent = '¡Reserva creada! Abriendo confirmación por WhatsApp...';
  const reserva = data.reserva;
  const mensaje = `Hola Plazoleta Kids! Quiero confirmar la reserva.\nNombre: ${reserva.nombre}\nTeléfono: ${reserva.telefono}\nFecha: ${reserva.fecha}\nHorario: ${hourLabel(reserva.horaInicio)} a ${hourLabel(reserva.horaFin)}\nSeña: $80.000 ARS\nTotal: $180.000 ARS\nUbicación: Avenida Sarmiento 1389`;
  const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');

  form.reset();
  horaSelect.innerHTML = '<option value="">Seleccioná una fecha primero</option>';
});
