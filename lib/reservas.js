import { db } from './db.js';
import { emailConfirmada } from './mail.js';

export async function buscarReserva(id) {
  const rows = await db(`reservas?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

export async function turnoDe(id) {
  const rows = await db(`turnos?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0];
}

// Marca la seña como cobrada y avisa al cliente. Devuelve false si ya estaba confirmada.
export async function confirmarSena(id, formaPago, extra = {}) {
  const res = await buscarReserva(id);
  if (!res) throw new Error('No existe la reserva.');
  if (res.estado === 'senado' || res.estado === 'pagado') return false;
  await db(`reservas?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { estado: 'senado', forma_pago: formaPago, ...extra } });
  await emailConfirmada({ ...res, total: Number(res.total), sena: Number(res.sena) }, await turnoDe(res.turno), formaPago);
  return true;
}
