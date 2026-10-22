import { ajustes, turnos } from '../lib/db.js';

// Datos públicos que la página necesita: turnos, precios, seña y datos de contacto y pago
export default async function handler(req, res) {
  try {
    const [a, t] = await Promise.all([ajustes(), turnos()]);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.json({
      WHATSAPP: a.whatsapp,
      EMAIL: a.email_contacto,
      SENA_PORCENTAJE: Number(a.sena_porcentaje),
      COTIZACION_USD: Number(a.cotizacion_usd),
      PAGO_USD: a.pago_usd,
      USDT_RED: a.usdt_red,
      USDT_WALLET: a.usdt_wallet,
      TURNOS: t.map(x => ({ id: x.id, nombre: x.nombre, horario: x.horario, precio: Number(x.precio) }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No pudimos cargar la configuración.' });
  }
}
