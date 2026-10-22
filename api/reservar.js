import { rpc, ajustes } from '../lib/db.js';
import { turnoDe } from '../lib/reservas.js';
import { crearPreferencia } from '../lib/mp.js';
import { emailRecibida, avisoDueno } from '../lib/mail.js';
import { leerBody, siteUrl, fechaLarga, peso } from '../lib/util.js';

function validar(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '')) return 'Elegí una fecha.';
  if (!d.turno) return 'Elegí un turno.';
  if (!d.nombre || !d.apellido) return 'Completá nombre y apellido.';
  if (!d.nacimiento) return 'Completá tu fecha de nacimiento.';
  const n = new Date(d.nacimiento + 'T00:00:00Z'), h = new Date();
  let edad = h.getUTCFullYear() - n.getUTCFullYear();
  if (h < new Date(Date.UTC(h.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))) edad--;
  if (!(edad >= 18)) return 'Quien reserva tiene que ser mayor de 18 años.';
  if (String(d.telefono || '').replace(/\D/g, '').length < 8) return 'Revisá el teléfono.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || '')) return 'Revisá el email.';
  if (!d.acepto) return 'Para seguir tenés que aceptar el reglamento.';
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });
  const d = leerBody(req);
  const err = validar(d);
  if (err) return res.status(400).json({ ok: false, error: err });

  let creada;
  try {
    creada = await rpc('quincho_crear_reserva', { p: d });
  } catch (e) {
    return res.status(409).json({ ok: false, error: e.message });
  }

  const reserva = { ...d, id: creada.id, total: Number(creada.total), sena: Number(creada.sena), email: d.email.trim().toLowerCase() };
  const [turno, a] = await Promise.all([turnoDe(d.turno), ajustes()]);
  const horas = Number(a.horas_pendiente || 48);
  let mpLink = '';
  try { mpLink = await crearPreferencia(reserva, turno, siteUrl(req), horas); } catch (e) { console.error(e); }

  await Promise.allSettled([
    emailRecibida(reserva, turno, mpLink, horas),
    avisoDueno(`Nueva reserva ${reserva.id}: ${fechaLarga(reserva.fecha)} (${turno.nombre})`,
      `${reserva.nombre} ${reserva.apellido}\nTel: ${reserva.telefono}\nEmail: ${reserva.email}\nPersonas: ${reserva.personas}\n` +
      `Comentario: ${reserva.comentario || '-'}\nSeña: ${peso(reserva.sena)}\n\nEstado: pendiente de pago.`)
  ]);

  res.json({ ok: true, id: reserva.id, total: reserva.total, sena: reserva.sena, mpLink });
}
