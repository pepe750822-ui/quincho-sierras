import { rpc } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    const rows = await rpc('quincho_ocupaciones');
    const ocupados = {};
    for (const { fecha, turno } of rows) (ocupados[fecha] ||= []).includes(turno) || ocupados[fecha].push(turno);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ocupados });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No pudimos cargar la disponibilidad.' });
  }
}
