<script setup>
import { ref } from 'vue'
import { useConfigStore } from '../stores/configStore'

const config = useConfigStore()
const appName = config.titulo || 'Liga Oriental'
const email = config.email_contacto
</script>

<template>
  <section>
    <div class="box">
      <h2 style="color:#eab308; margin-bottom:20px;">🔒 Política de Privacidad</h2>
      <p style="color:var(--text-muted); margin-bottom:20px;">Última actualización: Junio 2026</p>

      <div style="color:var(--text); line-height:1.7; display:flex; flex-direction:column; gap:18px;">
        <div>
          <h4 style="color:white; margin-bottom:6px;">1. Datos que recopilamos</h4>
          <p>Al registrarte en {{ appName }}, recopilamos:</p>
          <ul style="padding-left:20px; color:var(--text-muted);">
            <li>Dirección de email</li>
            <li>Nombre de usuario</li>
            <li>Contenido que subís (fotos, comentarios, predicciones)</li>
            <li>Datos de navegación básicos (páginas visitadas)</li>
          </ul>
        </div>

        <div>
          <h4 style="color:white; margin-bottom:6px;">2. Uso de los datos</h4>
          <p>Usamos tus datos para:</p>
          <ul style="padding-left:20px; color:var(--text-muted);">
            <li>Autenticación y gestión de tu cuenta</li>
            <li>Mostrar tu actividad en la plataforma (comentarios, likes, predicciones)</li>
            <li>Generar estadísticas y rankings</li>
            <li>Enviarte notificaciones relacionadas con la app</li>
            <li>Procesar pagos de cuotas (a través de Mercado Pago)</li>
          </ul>
        </div>

        <div>
          <h4 style="color:white; margin-bottom:6px;">3. Almacenamiento y seguridad</h4>
          <p>Tus datos se almacenan en servidores de Supabase (AWS us-east-1) con cifrado en tránsito y en reposo. Las contraseñas se almacenan hasheadas. Implementamos medidas de seguridad estándar para proteger tu información.</p>
        </div>

        <div>
          <h4 style="color:white; margin-bottom:6px;">4. Compartición de datos</h4>
          <p>No compartimos tus datos personales con terceros, excepto:</p>
          <ul style="padding-left:20px; color:var(--text-muted);">
            <li><strong>Mercado Pago:</strong> para procesar pagos (solo datos necesarios para la transacción)</li>
            <li><strong>Supabase:</strong> como proveedor de infraestructura</li>
            <li><strong>Por requerimiento legal:</strong> si una autoridad competente lo solicita</li>
          </ul>
        </div>

        <div>
          <h4 style="color:white; margin-bottom:6px;">5. Tus derechos</h4>
          <p>Podés:</p>
          <ul style="padding-left:20px; color:var(--text-muted);">
            <li>Solicitar una copia de tus datos</li>
            <li>Solicitar la eliminación de tu cuenta y datos asociados</li>
            <li>Corregir información incorrecta (nombre, email)</li>
            <li>Desactivar notificaciones en cualquier momento</li>
          </ul>
          <p style="margin-top:6px;">Para ejercer tus derechos, escribinos a <strong style="color:#eab308;">{{ email }}</strong>.</p>
        </div>

        <div>
          <h4 style="color:white; margin-bottom:6px;">6. Cookies</h4>
          <p>Usamos cookies de sesión para mantener tu sesión iniciada. No usamos cookies de rastreo ni publicitarias. Podés deshabilitar las cookies desde tu navegador, pero algunas funciones pueden dejar de funcionar.</p>
        </div>

        <div>
          <h4 style="color:white; margin-bottom:6px;">7. Cambios en esta política</h4>
          <p>Podemos actualizar esta política periódicamente. Los cambios serán notificados a través de la app. El uso continuado de la plataforma implica la aceptación de los cambios.</p>
        </div>

        <div>
          <h4 style="color:white; margin-bottom:6px;">8. Contacto</h4>
          <p>Si tenés preguntas sobre esta política, contactanos:</p>
          <p style="color:#eab308;">{{ email }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
