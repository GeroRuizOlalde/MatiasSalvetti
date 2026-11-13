# Twitch: puntos por ver, chat, follow, subs y bits

La web usa la misma aplicación de Twitch del login. Lo nuevo es el **permiso del canal** (lo da Matías una sola vez) y una **tarea cada 5 minutos** que suma los puntos por ver.

Las URLs exactas de tu dominio están en el panel, en **Twitch → Datos para configurar**, con botón para copiar.

## 1. Variables en Vercel

En Settings → Environment Variables (Production), además de las que ya están:

| Variable | Qué es |
|---|---|
| `TWITCH_EVENTSUB_SECRET` | Una clave inventada, de 10 a 100 caracteres. Firma los avisos de Twitch. |
| `TWITCH_BROADCASTER_ID` | El ID numérico del canal. Si no lo sabés, dejalo vacío: después de conectar, el panel te lo muestra. |
| `CRON_SECRET` | Otra clave inventada, de 16 caracteres o más. Protege la tarea de 5 minutos. |

Para inventar una clave: `openssl rand -hex 24`, o cualquier generador de contraseñas. Después de cargarlas hay que volver a desplegar.

## 2. Consola de desarrolladores de Twitch

En https://dev.twitch.tv/console/apps → la aplicación de la web → **OAuth Redirect URLs**, agregá (sin borrar la de Supabase):

```
https://TU-DOMINIO/api/twitch/callback
```

## 3. Conectar el canal

1. Matías entra a la web con la cuenta del canal. Tiene que ser admin (se cambia en Panel → Usuarios).
2. Panel → **Twitch** → **Conectar canal de Twitch**.
3. Twitch muestra los permisos y toca **Autorizar**.

Los permisos que pide: `moderator:read:followers`, `channel:read:subscriptions`, `bits:read`, `moderator:read:chatters`, `user:read:chat`, `user:bot`, `channel:bot`.

Los tokens quedan guardados solo del lado del servidor y se renuevan solos. Si Twitch da de baja la autorización (cambio de contraseña, o se desconecta la app desde Twitch), el panel avisa que hay que conectar de nuevo.

Hacelo siempre desde el dominio real de la web, no desde una dirección de prueba de Vercel: Twitch manda los avisos al dominio desde el que se conectó.

## 4. Sincronizar los eventos

Al conectar se crean solos. Si alguno figura caído o «Sin crear», tocá **Sincronizar eventos**: crea los que faltan y reemplaza los caídos.

Eventos: empieza y termina el stream, follow, sub nueva, resub, subs regaladas, bits, raid y mensajes del chat.

Twitch los manda a `https://TU-DOMINIO/api/twitch/eventsub`. Solo funciona con https (no en localhost).

## 5. La tarea de 5 minutos

En Supabase → Database → Extensions, activá **pg_cron** y **pg_net**. Después, en el SQL Editor, corré esto cambiando el dominio y la clave (la misma de `CRON_SECRET`):

```sql
select cron.schedule(
  'chupetti-puntos-por-ver',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://TU-DOMINIO/api/cron/watch',
    headers := '{"Authorization": "Bearer TU_CRON_SECRET"}'::jsonb
  );
  $$
);
```

Para ver si corre: `select * from cron.job_run_details order by start_time desc limit 5;`
Para sacarla: `select cron.unschedule('chupetti-puntos-por-ver');`

Cada vez que corre: si el canal está en vivo, lee quién está en el chat y le suma los puntos de «ver» a los que tienen cuenta en la web. Si está offline no hace nada.

El intervalo de «ver» se configura en Panel → Puntos y misiones, pero la tarea corre cada 5 minutos: un intervalo menor a 5 no tiene efecto.

## Cómo se suman los puntos

- **Ver:** una acreditación por intervalo, solo con el stream en vivo.
- **Chat:** por mensaje, con tope por minuto. Un mensaje igual al anterior no cuenta.
- **Follow:** una sola vez por persona.
- **Sub o resub:** una por mes. Una sub regalada no le suma al que la recibe.
- **Subs regaladas:** por cada una, al que regala.
- **Bits:** por cada bit.

Si el evento es de alguien que todavía no entró a la web, queda guardado. Cuando se registra, se le acreditan el follow y la sub.

Los baneados y los bloqueados de puntos no suman.
