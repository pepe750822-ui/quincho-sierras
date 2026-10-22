// Emails con Resend (https://resend.com). Sin RESEND_API_KEY no se envía nada y se avisa en los logs.
import { fechaLarga, peso, esc } from './util.js';

const NOMBRE_LUGAR = process.env.NOMBRE_LUGAR || 'Quincho en las Sierras';

export async function enviarEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) { console.warn('RESEND_API_KEY no configurada; email no enviado:', subject); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || `${NOMBRE_LUGAR} <onboarding@resend.dev>`, to, subject, html, text })
  });
  if (!r.ok) console.error('Error enviando email', r.status, await r.text());
}

export function emailRecibida(res, turno, mpLink, horas) {
  return enviarEmail({
    to: res.email,
    subject: `Recibimos tu reserva ${res.id} · ${NOMBRE_LUGAR}`,
    html: `<p>¡Hola ${esc(res.nombre)}!</p>
      <p>Apartamos el <b>${fechaLarga(res.fecha)}</b>, turno <b>${esc(turno.nombre)}</b> (${esc(turno.horario)}), por ${horas} horas.</p>
      <p>Para confirmar, aboná la seña de <b>${peso(res.sena)}</b>.${mpLink ? `<br><a href="${mpLink}">Pagar con Mercado Pago</a>` : ''}</p>
      <p>Si pagás en dólares o USDT, mandanos el comprobante por WhatsApp indicando la reserva ${res.id}.</p>
      <p>${NOMBRE_LUGAR}</p>`
  });
}

export function emailConfirmada(res, turno, formaPago) {
  return enviarEmail({
    to: res.email,
    subject: `Reserva confirmada: ${fechaLarga(res.fecha)} · ${NOMBRE_LUGAR}`,
    html: `<p>¡Hola ${esc(res.nombre)}!</p>
      <p>Recibimos tu seña y tu reserva <b>${res.id}</b> está <b>confirmada</b>.</p>
      <ul><li>Fecha: ${fechaLarga(res.fecha)}</li><li>Turno: ${esc(turno.nombre)} (${esc(turno.horario)})</li>
      <li>Personas: ${esc(res.personas)}</li><li>Seña abonada: ${peso(res.sena)} (${esc(formaPago)})</li>
      <li>Saldo a abonar el día del evento: ${peso(res.total - res.sena)}</li></ul>
      <p>Cualquier duda respondé este email o escribinos por WhatsApp.</p><p>${NOMBRE_LUGAR}</p>`
  });
}

export function avisoDueno(subject, text) {
  if (!process.env.EMAIL_DUENO) return;
  return enviarEmail({ to: process.env.EMAIL_DUENO, subject, text });
}
