// Acceso a Supabase (PostgREST) con la clave secreta del servidor. Nunca se usa desde el navegador.
const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function db(path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  // Las claves viejas (JWT) también van en Authorization; las nuevas sb_secret_ solo en apikey
  if (KEY && KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error((data && data.message) || `Error de base de datos (${r.status})`);
  return data;
}

export const rpc = (fn, args = {}) => db(`rpc/${fn}`, { method: 'POST', body: args });

export async function ajustes() {
  const rows = await db('quincho_ajustes?select=clave,valor');
  return Object.fromEntries(rows.map(r => [r.clave, r.valor]));
}

export async function turnos() {
  return db('quincho_turnos?select=id,nombre,horario,desde,hasta,dia_siguiente,precio&activo=eq.true&order=orden');
}
