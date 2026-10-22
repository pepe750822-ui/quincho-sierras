import crypto from 'node:crypto';
import { db, ajustes } from '../lib/db.js';
import { confirmarSena } from '../lib/reservas.js';
import { leerBody } from '../lib/util.js';

function autorizado(req) {
  const esperado = process.env.ADMIN_PASSWORD || '';
  const dado = String(req.headers['x-admin-password'] || '');
  if (!esperado || dado.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(dado), Buffer.from(esperado));
}

const FORMAS = { usd: 'Dólares (transferencia)', usdt: 'USDT', efectivo: 'Efectivo', transferencia: 'Transferencia en pesos' };
const AJUSTES_EDITABLES = ['sena_porcentaje', 'cotizacion_usd', 'horas_pendiente', 'whatsapp', 'email_contacto', 'pago_usd', 'usdt_red', 'usdt_wallet'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!autorizado(req)) return res.status(401).json({ error: 'Contraseña incorrecta.' });
  const b = leerBody(req);
  const id = encodeURIComponent(b.id || '');
  try {
    switch (b.accion) {
      case 'listar': {
        const [reservas, bloqueos, turnos, a] = await Promise.all([
          db('quincho_reservas?select=*&order=fecha.desc,created_at.desc&limit=1000'),
          db('quincho_bloqueos?select=*&order=fecha'),
          db('quincho_turnos?select=*&order=orden'),
          ajustes()
        ]);
        return res.json({ reservas, bloqueos, turnos, ajustes: a });
      }
      case 'confirmar':
        await confirmarSena(b.id, FORMAS[b.forma] || b.forma || 'Otro');
        return res.json({ ok: true });
      case 'pagado':
        await db(`quincho_reservas?id=eq.${id}`, { method: 'PATCH', body: { estado: 'pagado' } });
        return res.json({ ok: true });
      case 'cancelar':
        await db(`quincho_reservas?id=eq.${id}`, { method: 'PATCH', body: { estado: 'cancelado' } });
        return res.json({ ok: true });
      case 'notas':
        await db(`quincho_reservas?id=eq.${id}`, { method: 'PATCH', body: { notas: String(b.notas || '') } });
        return res.json({ ok: true });
      case 'bloquear':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha || '')) return res.status(400).json({ error: 'Fecha inválida.' });
        await db('quincho_bloqueos', { method: 'POST', body: { fecha: b.fecha, motivo: b.motivo || null }, prefer: 'resolution=merge-duplicates' });
        return res.json({ ok: true });
      case 'desbloquear':
        await db(`quincho_bloqueos?fecha=eq.${encodeURIComponent(b.fecha || '')}`, { method: 'DELETE' });
        return res.json({ ok: true });
      case 'precio':
        if (!(Number(b.precio) >= 0)) return res.status(400).json({ error: 'Precio inválido.' });
        await db(`quincho_turnos?id=eq.${id}`, { method: 'PATCH', body: { precio: Number(b.precio) } });
        return res.json({ ok: true });
      case 'ajuste':
        if (!AJUSTES_EDITABLES.includes(b.clave)) return res.status(400).json({ error: 'Ajuste desconocido.' });
        await db(`quincho_ajustes?clave=eq.${encodeURIComponent(b.clave)}`, { method: 'PATCH', body: { valor: String(b.valor ?? '') } });
        return res.json({ ok: true });
      default:
        return res.status(400).json({ error: 'Acción desconocida.' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
