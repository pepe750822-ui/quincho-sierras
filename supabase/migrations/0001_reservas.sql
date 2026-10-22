-- Reservas del quincho: turnos, ajustes, reservas (también funcionan como base de leads) y bloqueos manuales.
-- Todas las tablas tienen RLS activo y sin políticas: solo el servidor (service role) puede leer y escribir.

create table public.turnos (
  id text primary key,
  nombre text not null,
  horario text not null,
  desde time not null,
  hasta time not null,
  dia_siguiente boolean not null default false,
  precio numeric(12,2) not null check (precio >= 0),
  orden int not null default 0,
  activo boolean not null default true
);

create table public.ajustes (
  clave text primary key,
  valor text not null
);

create table public.reservas (
  id text primary key,
  created_at timestamptz not null default now(),
  fecha date not null,
  turno text not null references public.turnos(id),
  nombre text not null,
  apellido text not null,
  nacimiento date,
  telefono text not null,
  email text not null,
  personas int check (personas > 0),
  comentario text,
  total numeric(12,2) not null,
  sena numeric(12,2) not null,
  forma_pago text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'senado', 'pagado', 'cancelado')),
  mp_payment_id text,
  origen text not null default 'web',
  notas text
);
create index reservas_fecha_idx on public.reservas (fecha);
create index reservas_email_idx on public.reservas (email);

create table public.bloqueos (
  fecha date primary key,
  motivo text,
  created_at timestamptz not null default now()
);

alter table public.turnos enable row level security;
alter table public.ajustes enable row level security;
alter table public.reservas enable row level security;
alter table public.bloqueos enable row level security;

insert into public.turnos (id, nombre, horario, desde, hasta, dia_siguiente, precio, orden) values
  ('dia',      'Día',          '10:00 a 19:00',                    '10:00', '19:00', false, 180000, 1),
  ('noche',    'Noche',        '20:30 a 04:00',                    '20:30', '04:00', true,  220000, 2),
  ('completo', 'Día completo', '10:00 a 04:00 del día siguiente',  '10:00', '04:00', true,  350000, 3);

insert into public.ajustes (clave, valor) values
  ('sena_porcentaje', '30'),
  ('cotizacion_usd',  '1400'),
  ('horas_pendiente', '48'),
  ('whatsapp',        '5493510000000'),
  ('email_contacto',  'reservas@tuquincho.com.ar'),
  ('pago_usd',        'Transferencia a cuenta en USD · Banco Ejemplo · CBU 0000000000000000000000 · Titular: Nombre Apellido'),
  ('usdt_red',        'TRC20 (Tron)'),
  ('usdt_wallet',     'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

-- Fechas y turnos ocupados desde hoy. Una reserva pendiente ocupa su turno solo durante "horas_pendiente".
create or replace function public.ocupaciones()
returns table (fecha date, turno text)
language sql stable security definer set search_path = public as $$
  select r.fecha, r.turno
  from reservas r
  where r.fecha >= current_date
    and (r.estado in ('senado', 'pagado')
         or (r.estado = 'pendiente'
             and r.created_at > now() - make_interval(hours => coalesce((select valor::int from ajustes where clave = 'horas_pendiente'), 48))))
  union all
  select b.fecha, 'completo' from bloqueos b where b.fecha >= current_date
$$;

create or replace function public.turno_libre(p_fecha date, p_turno text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_turno = 'completo' then not exists (select 1 from ocupaciones() o where o.fecha = p_fecha)
    else not exists (select 1 from ocupaciones() o where o.fecha = p_fecha and o.turno in (p_turno, 'completo'))
  end
$$;

-- Crea la reserva calculando precio y seña en el servidor; un lock por fecha evita dos reservas simultáneas del mismo turno.
create or replace function public.crear_reserva(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_fecha date := (p->>'fecha')::date;
  v_turno text := p->>'turno';
  t turnos;
  v_pct numeric;
  v_sena numeric;
  v_id text;
begin
  select * into t from turnos where id = v_turno and activo;
  if not found then raise exception 'Turno inválido.'; end if;
  if v_fecha < (now() at time zone 'America/Argentina/Cordoba')::date then raise exception 'Esa fecha ya pasó.'; end if;
  if coalesce(p->>'nombre', '') = '' or coalesce(p->>'apellido', '') = '' or coalesce(p->>'email', '') = '' or coalesce(p->>'telefono', '') = '' then
    raise exception 'Faltan datos.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_fecha::text));
  if not turno_libre(v_fecha, v_turno) then
    raise exception 'Ese turno se acaba de ocupar. Elegí otra fecha u horario.';
  end if;

  select valor::numeric into v_pct from ajustes where clave = 'sena_porcentaje';
  v_sena := round(t.precio * coalesce(v_pct, 30) / 100);
  v_id := 'R-' || to_char(now() at time zone 'America/Argentina/Cordoba', 'YYMMDD') || '-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');

  insert into reservas (id, fecha, turno, nombre, apellido, nacimiento, telefono, email, personas, comentario, total, sena)
  values (v_id, v_fecha, v_turno, trim(p->>'nombre'), trim(p->>'apellido'), nullif(p->>'nacimiento', '')::date,
          trim(p->>'telefono'), lower(trim(p->>'email')), nullif(p->>'personas', '')::int, nullif(trim(p->>'comentario'), ''),
          t.precio, v_sena);

  return jsonb_build_object('id', v_id, 'total', t.precio, 'sena', v_sena);
end
$$;

revoke execute on function public.ocupaciones() from public, anon, authenticated;
revoke execute on function public.turno_libre(date, text) from public, anon, authenticated;
revoke execute on function public.crear_reserva(jsonb) from public, anon, authenticated;
grant execute on function public.ocupaciones() to service_role;
grant execute on function public.turno_libre(date, text) to service_role;
grant execute on function public.crear_reserva(jsonb) to service_role;
