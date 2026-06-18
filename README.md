# ⚽ Liga Oriental

Aplicación web para la gestión de la Liga Oriental de fútbol. Administración de torneos, equipos, jugadores, fixture, estadísticas en vivo, pagos, y más.

## 🚀 Stack

- **Frontend:** Vue 3 (Composition API + `<script setup>`), Pinia, Vue Router
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **PWA:** vite-plugin-pwa (instalable en celular, funciona offline parcial)
- **Build:** Vite 8

## ✨ Funcionalidades

### 📊 Torneo & Estadísticas
- Creación y selección de múltiples torneos
- Tabla de posiciones con puntos, PJ, V/E/P, GF/GC, vallas invictas, rating
- Fixture generado automáticamente por día y horario
- Carga de resultados con goleadores, tarjetas, MVP
- Historial de partidos por equipo
- Ranking de jugadores por goles, asistencias, tarjetas, MVP, rating
- Comparador de jugadores lado a lado
- Gráfico de evolución de goles por fecha

### 👥 Roles de Usuario
- **Admin:** gestión completa (torneos, equipos, jugadores, fixture, sponsors, sanciones, usuarios)
- **Delegado:** ligado a un equipo, carga alineaciones, ve sanciones, paga cuotas
- **Usuario:** galería, likes, comentarios, predicciones, chat, votación MVP
- Login con email/contraseña, registro con aprobación manual y aceptación de política de privacidad

### 💳 Pagos (Mercado Pago)
- Edge Function `mp-create-preference` para crear preferencias de pago
- Edge Function `mp-webhook` para IPN y validación HMAC de pagos
- Moneda: UYU (Peso Uruguayo)
- Historial de pagos por usuario

### 📸 Galería Multimedia
- Subida de imágenes/videos a Supabase Storage con validación de tipo y tamaño
- Lightbox al clickear con navegación (Escape para cerrar)
- Likes ❤️ y comentarios 💬 con @menciones (autocomplete de jugadores y equipos)
- Solo admin puede eliminar; todos los aprobados pueden subir

### 📰 Feed de Actividad
- Timeline con goles, resultados, subidas de media, comentarios, predicciones
- Triggers automáticos en la base de datos

### 🔮 Pronósticos
- Predicción de resultados partido a partido
- Sistema de puntuación: 5 pts resultado exacto, 3 pts diferencia, 1 pt tendencia
- Ranking global de pronosticadores

### 🏆 Votación MVP
- Voto popular por partido finalizado (un voto por usuario por partido)
- Visible en la sección de fixture

### 💬 Chat de Equipo
- Chat en tiempo real por equipo (Supabase Realtime)
- Verificación de membresía del equipo vía RLS

### 🔔 Notificaciones
- Notificaciones push vía Browser Notification API
- Campanita de notificaciones en el header (likes, comentarios)
- Notificación al finalizar un partido

### ⚽ Modo Live
- Scoreboard en vivo con actualización automática cada 10s
- Agregado de goles en tiempo real
- Finalización de partido

### 📋 Alineaciones
- Editor de alineaciones por equipo por partido (jugadores titulares/suplentes)
- Badge 🔴 de sanciones activas en la selección de jugadores

### 👤 Perfil de Usuario
- Edición de nombre
- Historial de media subida y comentarios

### 📦 Exportación
- JSON, CSV, PDF de datos del torneo
- Respaldo y restauración de datos

### 🎯 Misiones / Logros
- Sistema de misiones con progreso y recompensas

### 🏠 Página Principal
- Galería multimedia como pantalla de inicio
- Banner rotativo de sponsors

### 🔒 Seguridad
- Auditoría completa de vulnerabilidades corregidas:
  - SQL injection: cubierto (queries parametrizadas vía Supabase SDK)
  - XSS: cubierto (sin `v-html`, sanitización de URLs, CSP implementado)
  - Open redirect: Origin validado contra whitelist en Edge Functions
  - Mass assignment: columnas permitidas explicitadas en cada `update*()`
  - Info disclosure: errores genéricos al usuario, logs solo en desarrollo
  - Storage: RLS con validación de extensiones (`storage.extension()`)
  - Chat: RLS verifica membresía del equipo
  - Iframes: `sanitizarIframeSrc()` solo permite YouTube/Vimeo/Google Drive vía HTTPS
  - Webhook Mercado Pago: HMAC-SHA256 con `x-mp-signature`
  - `console.error()` gateado con `import.meta.env.DEV`
- Content-Security-Policy vía meta tag
- RLS policies con `public.get_user_role()` SECURITY DEFINER

### 📋 Política de Privacidad
- Página `/privacidad` con 8 secciones (datos recopilados, cookies, MP, publicidad, contacto)
- Checkbox obligatorio al registrarse
- Email de contacto configurable vía store

## 🌐 Deploy

- **Frontend:** Vercel (auto-deploy desde Master)
- **Base de datos:** Supabase
- **Storage:** Supabase Storage (bucket `liga-media`)

## 📱 PWA

La app es instalable como PWA en dispositivos móviles y desktop. Ofrece caché de assets y actualización automática del service worker.

## 🗄️ Migraciones

Las migraciones de base de datos están en `supabase/migrations/` y deben ejecutarse en orden:

00001 → 00002 → ... → 00015

Incluyen schema inicial, RLS fix, pagos/delegado, feed, predicciones, MVP, chat, y seguridad.

## 🔧 Edge Functions

- **mp-create-preference:** Crea preferencia de pago en MP. Valida torneo/equipo, monto (1-100000), y Origin header contra whitelist.
- **mp-webhook:** Procesa IPN de MP. Valida firma HMAC con `x-mp-signature`. Usa `SUPABASE_SERVICE_ROLE_KEY` para actualizar estado.

Variables de entorno requeridas en Supabase:
- `MP_ACCESS_TOKEN`
- `MP_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (opcional, fallback a localhost + SUPABASE_URL)
