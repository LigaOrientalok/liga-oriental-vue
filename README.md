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
- Login con email/contraseña, registro con aprobación manual

### 💳 Pagos (Mercado Pago)
- Edge Function `mp-create-preference` para crear preferencias de pago
- Edge Function `mp-webhook` para IPN y validación de pagos
- Moneda: UYU (Peso Uruguayo)
- Historial de pagos por usuario

### 📸 Galería Multimedia
- Subida de imágenes/videos a Supabase Storage
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
- Visible en la página de cada equipo

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

## 🛠️ Instalación

```bash
git clone https://github.com/LigaOrientalok/liga-oriental-vue.git
cd liga-oriental-vue
npm install
```

### Configuración

Crear archivo `.env`:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm run preview
```

## 🗄️ Base de Datos

Las migraciones están en `supabase/migrations/`. Aplicar en orden en el SQL Editor de Supabase:

1. `00001_init.sql` — Tablas base (torneos, equipos, jugadores, fixture, resultados, goles, tarjetas)
2. `00002_vinculos.sql` — Relación jugador-equipo
3. `00003_usuarios.sql` — Usuarios y roles
4. `00004_delegado_pagos.sql` — Rol delegado, pagos
5. `00005_sponsors.sql` — Sponsors
6. `00006_media.sql` — Galería multimedia
7. `00007_likes_comments.sql` — Likes y comentarios
8. `00008_notificaciones.sql` — Notificaciones
9. `00009_perfil.sql` — Columna nombre en usuarios
10. `00010_alineaciones.sql` — Alineaciones
11. `00011_feed.sql` — Feed de actividad
12. `00012_predicciones.sql` — Pronósticos
13. `00013_mvp_votos.sql` — Votación MVP
14. `00014_chat.sql` — Chat de equipo

### Edge Functions

```
supabase/functions/mp-create-preference/
supabase/functions/mp-webhook/
```

Requieren `MP_ACCESS_TOKEN` como secret en Supabase.

## 🌐 Deploy

- **Frontend:** Vercel (auto-deploy desde Master)
- **Base de datos:** Supabase
- **Storage:** Supabase Storage (bucket `liga-media`)

## 📱 PWA

La app es instalable como PWA en dispositivos móviles y desktop. Ofrece caché de assets y actualización automática del service worker.
