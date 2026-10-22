# Quincho en las Sierras: web y reservas

Página del quincho con reserva online: calendario, turno, datos del cliente, seña en pesos (Mercado Pago), dólares o USDT, emails automáticos y un panel de administración.

- **Página**: `public/index.html`. Si la API no responde, funciona en modo demo.
- **Panel**: `public/admin.html`, que se abre en `/admin` con la contraseña `ADMIN_PASSWORD`.
- **API** (funciones de Vercel en `api/`):
  - `config`: turnos, precios y datos de pago.
  - `disponibilidad`: días y turnos ocupados.
  - `reservar`: crea la reserva y el link de Mercado Pago, y manda los emails.
  - `mp-webhook`: recibe el aviso de pago de Mercado Pago y confirma la seña.
  - `admin`: acciones del panel.
- **Base de datos**: Supabase. El esquema está en `supabase/migrations/`. Las tablas tienen RLS activo sin políticas, así que solo el servidor accede con la clave secreta.

## Variables de entorno (Vercel > Settings > Environment Variables)

| Variable | Para qué |
|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta de Supabase (Project Settings > API Keys). Nunca va en la página. |
| `ADMIN_PASSWORD` | Contraseña del panel `/admin` |
| `MP_ACCESS_TOKEN` | Access Token de producción de Mercado Pago (Checkout Pro) |
| `RESEND_API_KEY` | Clave de Resend para mandar emails |
| `EMAIL_FROM` | Remitente, por ejemplo `Quincho <reservas@tudominio.com.ar>` (el dominio tiene que estar verificado en Resend) |
| `EMAIL_DUENO` | Email donde llegan los avisos de nuevas reservas y pagos |
| `SITE_URL` | Dirección pública del sitio (para volver desde Mercado Pago) |

Si falta `MP_ACCESS_TOKEN` no se crea el link de pago, y si falta `RESEND_API_KEY` no se mandan emails. El resto sigue funcionando.

## Reglas de reserva
- Hay tres turnos: Día, Noche y Día completo. El día completo ocupa los otros dos.
- Precio y seña se calculan en la base de datos, nunca en el navegador.
- Una reserva pendiente aparta su turno durante `horas_pendiente` (48 h por defecto). Si en ese tiempo no se paga la seña, el turno se libera solo.
- Los pagos en USD y USDT se confirman desde el panel. Al confirmar, al cliente le llega el email.
- Precios, seña, cotización y datos de pago se editan desde el panel, en la pestaña **Precios y datos**.
