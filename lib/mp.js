// Mercado Pago Checkout Pro. Sin MP_ACCESS_TOKEN no se crea link y el cliente ve las otras formas de pago.
import { fechaLarga } from './util.js';

const API = 'https://api.mercadopago.com';
const auth = () => ({ Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` });

export async function crearPreferencia(res, turno, base, horas) {
  if (!process.env.MP_ACCESS_TOKEN) return '';
  const r = await fetch(`${API}/checkout/preferences`, {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ title: `Seña ${fechaLarga(res.fecha)} · ${turno.nombre}`, quantity: 1, currency_id: 'ARS', unit_price: Number(res.sena) }],
      payer: { name: res.nombre, surname: res.apellido, email: res.email },
      external_reference: res.id,
      notification_url: `${base}/api/mp-webhook`,
      back_urls: { success: `${base}/?pago=ok`, pending: `${base}/?pago=pendiente`, failure: `${base}/?pago=error` },
      auto_return: 'approved',
      expires: true,
      expiration_date_to: new Date(Date.now() + horas * 3600 * 1000).toISOString()
    })
  });
  const j = await r.json();
  if (!r.ok) { console.error('Mercado Pago', r.status, j); return ''; }
  return j.init_point || '';
}

export async function obtenerPago(id) {
  const r = await fetch(`${API}/v1/payments/${encodeURIComponent(id)}`, { headers: auth() });
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}`);
  return r.json();
}
