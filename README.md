# Mensajería Anónima

Plataforma de mensajería mediante enlaces personales. Cada usuario tiene un
enlace público (`/u/tuusuario`) donde otras personas pueden escribirle —
pero, a diferencia de las apps de mensajes anónimos, el receptor **siempre
ve el @usuario** de quien envía el mensaje. Todo mensaje requiere una
cuenta registrada.

Stack: HTML + CSS + JavaScript (sin frameworks) · Supabase (Auth, Postgres,
RLS, Edge Functions, Storage) · Vercel.

> Nota sobre la estructura: el CSS se consolidó en un único
> `css/style.css` (en vez de un archivo por página) para que los tokens de
> diseño y los componentes compartidos vivan en un solo lugar y no se
> dupliquen ni se desincronicen. La lógica JS sí sigue el archivo por
> página que pedías (`auth.js`, `dashboard.js`, `messages.js`,
> `public-profile.js`, `settings.js`) más `supabase.js` y `layout.js` como
> utilidades compartidas.

---

## 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**.
2. Elige nombre, contraseña de base de datos y región.
3. Espera a que el proyecto termine de aprovisionarse.

## 2. Ejecutar el SQL

1. Abre **SQL Editor** en el panel de Supabase.
2. Pega el contenido completo de `supabase_schema.sql` (entregado como
   archivo independiente, fuera del ZIP).
3. Ejecuta. Esto crea las tablas, triggers, funciones y políticas RLS.

## 3. Configurar Auth

1. **Authentication → Providers**: deja **Email** habilitado.
2. **Authentication → Settings**:
   - Activa o desactiva "Confirm email" según prefieras (el código soporta
     ambos casos).
   - Define **Site URL** con tu dominio final (ej. `https://mensajeriaanonima.app`).

## 4. Configurar Redirect URLs

En **Authentication → URL Configuration → Redirect URLs**, agrega:

```
https://tu-dominio.vercel.app/login.html
https://tu-dominio.vercel.app/forgot-password.html
http://localhost:3000/login.html
http://localhost:3000/forgot-password.html
```

## 5. Configurar Storage (avatares)

El script SQL ya crea el bucket `avatars` público con políticas por
usuario. Si prefieres no usar avatares personalizados, no hace falta
ninguna acción extra: la app usa iniciales como avatar por defecto.

## 6. Configurar Edge Functions

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy send-message-notification
```

Luego crea un **Database Webhook** (Database → Webhooks):

- Tabla: `messages`
- Evento: `INSERT`
- Tipo: `Edge Function` → `send-message-notification`

## 7. Configurar proveedor de email (Resend)

1. Crea una cuenta en [resend.com](https://resend.com) y verifica tu
   dominio de envío.
2. Genera una API key.
3. Configúrala como secreto de la función:

```bash
supabase secrets set RESEND_API_KEY=tu_api_key
supabase secrets set APP_URL=https://tu-dominio.vercel.app
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles
automáticamente dentro de las Edge Functions de Supabase.

## 8. Configurar variables de entorno del frontend

El frontend es estático, así que las variables públicas se inyectan antes
de cargar `js/supabase.js`. Crea `env.js` (no está en el ZIP por
seguridad, créalo tú) y enlázalo en cada HTML **antes** de
`js/supabase.js`:

```html
<script>
  window.__MENSAJEA_ENV__ = {
    SUPABASE_URL: "https://tu-proyecto.supabase.co",
    SUPABASE_ANON_KEY: "tu-anon-key-publica",
  };
</script>
```

O simplemente reemplaza los valores por defecto directamente en
`js/supabase.js` (son la URL y la anon key, ambas públicas por diseño de
Supabase — la seguridad real la da RLS, no el secreto de estas claves).

**Nunca** coloques `SUPABASE_SERVICE_ROLE_KEY` ni `RESEND_API_KEY` en el
frontend; ambas viven únicamente como secretos de la Edge Function.

## 9. Ejecutar localmente

Al ser HTML/CSS/JS estático, cualquier servidor estático sirve:

```bash
npx serve .
# o
python3 -m http.server 3000
```

Para que la ruta `/u/username` funcione igual que en producción,
usa `vercel dev` (requiere la CLI de Vercel):

```bash
npm i -g vercel
vercel dev
```

## 10. Desplegar en Vercel

```bash
npm i -g vercel
vercel
vercel --prod
```

`vercel.json` ya incluye el rewrite necesario para `/u/:username` y
`cleanUrls` para rutas limpias. No hace falta configuración adicional.

## 11. Configurar dominio

En el panel de Vercel: **Settings → Domains** → agrega tu dominio y sigue
las instrucciones de DNS. Actualiza después la **Site URL** y los
**Redirect URLs** en Supabase con el dominio final.

## 12. Probar registro

Crea una cuenta desde `/register.html`. Verifica en Supabase → Table
Editor → `profiles` que se creó automáticamente el perfil (vía trigger).

## 13. Probar login

Inicia sesión desde `/login.html` con la cuenta creada. Debe redirigir a
`/dashboard.html`.

## 14. Probar el enlace

Copia tu enlace desde el dashboard, ábrelo en una pestaña de incógnito y
confirma que carga el perfil público.

## 15. Probar mensajes

Desde incógnito (sin sesión), escribe un mensaje y pulsa enviar: debe
pedirte registro/login y, tras completarlo, regresar al perfil para
enviar el mensaje. Con una segunda cuenta ya logueada, prueba enviar
varios mensajes seguidos a distintos perfiles sin volver a registrarte.

## 16. Probar email

Envía un mensaje y revisa en `email_notifications` que se creó el
registro con `status = sent`. Si desactivas notificaciones en
`/settings.html`, el siguiente mensaje debe quedar como `skipped`.

## 17. Probar bloqueo

Bloquea a un usuario desde un mensaje recibido (`/messages.html`) y
confirma que ese usuario ya no puede enviarte mensajes (la política RLS
lo impide incluso si manipula la petición desde DevTools).

## 18. Probar enlace pausado

Activa "Pausar mi enlace" en Configuración y confirma que tu perfil
público muestra el estado de pausa y rechaza nuevos mensajes.

## 19. Probar recarga

Recarga directamente `/dashboard.html`, `/messages.html`, `/settings.html`
y `/u/tuusuario`. Ninguna debe mostrar un 404 de Vercel.

## 20. Solucionar problemas comunes

| Problema | Causa probable |
|---|---|
| `/u/usuario` da 404 en Vercel | Falta desplegar con el `vercel.json` incluido, o el rewrite no llegó a producción. Revisa **Deployments → Source**. |
| No llega el correo de notificación | Revisa `email_notifications.error_message`, verifica el dominio en Resend y el secreto `RESEND_API_KEY`. |
| "Ese nombre de usuario ya está en uso" al registrarse con uno libre | Puede haber quedado un perfil huérfano; revisa la tabla `profiles`. |
| Mensajes no se envían (`no autorizado`) | El trigger `enforce_sender_identity` bloquea `sender_id` falsificado — confirma que el usuario tiene sesión válida. |
| La sesión no persiste al recargar | Verifica que `persistSession: true` esté en `js/supabase.js` y que no estés en modo incógnito con cookies bloqueadas. |

---

## Notas de seguridad

- Las contraseñas nunca se guardan en `profiles`; las gestiona
  exclusivamente Supabase Auth.
- `sender_id` se valida en la base de datos (trigger + RLS), nunca se
  confía en el valor enviado desde el frontend.
- Bloqueos y enlaces pausados se aplican a nivel de RLS, no solo en
  JavaScript.
- El correo de notificación nunca incluye el contenido del mensaje.
- "Eliminar cuenta" desactiva el perfil desde el cliente
  (`is_active = false`). Borrar por completo la cuenta de
  `auth.users` requiere una Edge Function con la `service role key`
  (no incluida por defecto, ya que esa clave nunca debe existir en el
  frontend); puedes extender `send-message-notification` o crear una
  función `delete-account` dedicada siguiendo el mismo patrón.
