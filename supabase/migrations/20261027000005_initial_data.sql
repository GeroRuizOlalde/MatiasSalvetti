-- =============================================================================
-- Datos iniciales reales (casinos, redes, configuración) y documentos legales
-- placeholder. Va como migración para que también llegue a producción.
-- =============================================================================

insert into public.casinos (name, slug, referral_url, code, sort_order) values
  ('1xSlots', '1xslots', 'https://1xslot.casino/es?tag=d_1692949m_8001c', null, 1),
  ('Winebet', 'winebet', 'https://refpa81228.com/L?tag=d_5111421m_79410c_&site=5111421&ad=79410', null, 2),
  ('Win Win', 'win-win', 'https://refpa98980.com/L?tag=d_5644985m_112010c_&site=5644985&ad=112010', null, 3)
on conflict (slug) do nothing;

insert into public.site_settings (key, value, is_public) values
  ('socials', '{
    "twitch": "https://www.twitch.tv/Chupetti",
    "kick": "https://kick.com/chupetti",
    "youtube": "https://www.youtube.com/@ChupettiClips",
    "instagram": "https://www.instagram.com/chupetticlips/",
    "tiktok": "https://www.tiktok.com/@chupetticlips",
    "discord": "https://discord.com/invite/ywKHXWNH4C",
    "whatsapp": "https://chat.whatsapp.com/GSwm8Vhu2yNFa1cL7smvBT"
  }'::jsonb, true),
  ('primary_platform', '"twitch"'::jsonb, true),
  ('stream_manual', '{"live": false, "platform": "twitch"}'::jsonb, true),
  ('next_stream', '{"at": null, "label": null}'::jsonb, true),
  ('home_stats', '{"years_streaming": null, "monthly_prizes": null}'::jsonb, true),
  ('responsible_gaming_helpline', '"[LÍNEA DE AYUDA]"'::jsonb, true),
  ('twitch_min_account_age_days', '0'::jsonb, true),
  ('level_curve', '{"base": 300, "exponent": 1.15}'::jsonb, true),
  ('overlay_token', to_jsonb(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')), false)
on conflict (key) do nothing;

insert into public.legal_documents (kind, version, title, content_md, published_at) values
  ('terms', 1, 'Bases y condiciones', $md$
> **[BORRADOR]** Este texto es un placeholder. Reemplazalo desde el panel por la versión revisada por un profesional antes de usar la web en serio.

## [1. Quién organiza]

[Datos del organizador.]

## [2. Requisitos para participar]

- [Ser mayor de 18 años.]
- [Tener una cuenta de Twitch.]
- [Otros requisitos.]

## [3. Calls, apuestas de balance, votaciones y sorteos]

[Cómo funciona cada dinámica, cómo se eligen ganadores y cómo se entregan los premios.]

## [4. Puntos, niveles y tienda]

[Los puntos no tienen valor monetario. Condiciones de canje.]

## [5. Exclusiones y sanciones]

[Multicuentas, abuso, baneos.]

## [6. Modificaciones]

[Cómo se avisan los cambios a estas bases.]
$md$, now()),
  ('privacy', 1, 'Política de privacidad', $md$
> **[BORRADOR]** Este texto es un placeholder. Reemplazalo desde el panel por la versión revisada por un profesional.

## Qué datos guardamos

- **Datos de Twitch** que nos da el login: ID, usuario, nombre visible, avatar y fecha de creación de la cuenta.
- **Tu confirmación de mayoría de edad** y la versión de las bases que aceptaste, con fecha.
- **IDs de cuenta de casino** que cargás para verificarte. En la web pública se muestran enmascarados.
- **Capturas de pantalla** de verificación. Se guardan en un almacenamiento privado que solo ve el administrador.
- **Tu actividad** en la web: calls, apuestas de balance, votos, participaciones, puntos y canjes.

## Para qué los usamos

[Para identificarte, verificar requisitos de participación, armar rankings, sortear premios y evitar multicuentas.]

## Con quién los compartimos

[Detalle.]

## Cuánto tiempo los guardamos

[Detalle.]

## Tus derechos

Podés borrar tu cuenta y tus datos desde tu perfil. [Otros derechos y contacto.]
$md$, now()),
  ('responsible_gaming', 1, 'Juego responsable', $md$
> **[BORRADOR]** Revisá y completá este texto desde el panel.

El juego es entretenimiento, no una forma de ganar plata. Esta web y los streams son solo para **mayores de 18 años**.

## Algunas reglas

- Poné un límite de plata y de tiempo antes de jugar, y respetalo.
- No juegues para recuperar lo que perdiste.
- No juegues con plata que necesitás para otras cosas.
- Si dejó de ser divertido, frená.

## Pedí ayuda

Si sentís que el juego te está afectando a vos o a alguien cercano, comunicate con {{helpline}}.
$md$, now())
on conflict (kind, version) do nothing;
