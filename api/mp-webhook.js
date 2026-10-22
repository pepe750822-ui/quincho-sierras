import { obtenerPago } from '../lib/mp.js';
import { confirmarSena } from '../lib/reservas.js';
import { avisoDueno } from '../lib/mail.js';
import { leerBody } from '../lib/util.js';

// Mercado Pago avisa acá cada novedad de pago. Consultamos el pago a su API (no confiamos en el aviso) y confirmamos si está aprobado.
export default async function handler(req, res) {
  const body = leerBody(req);
  const q = req.query || {};
  const tipo = body.type || q.type || q.topic;
  const id = (body.data && body.data.id) || q['data.id'] || q.id;
  if (tipo !== 'payment' || !id) return res.status(200).json({ ok: true });

  try {
    const pago = await obtenerPago(id);
    if (pago.status === 'approved' && pago.external_reference) {
      const nueva = await confirmarSena(pago.external_reference, 'Pesos (Mercado Pago)', { mp_payment_id: String(pago.id) });
      if (nueva) await avisoDueno(`Seña acreditada: ${pago.external_reference}`, `Mercado Pago acreditó $${pago.transaction_amount} (pago ${pago.id}).`);
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
}
