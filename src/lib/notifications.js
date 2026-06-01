export function pedirPermisoNotificaciones() {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones')
    return false
  }
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  Notification.requestPermission()
  return false
}

export function enviarNotificacion(titulo, opciones = {}) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const notif = new Notification(titulo, {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      ...opciones,
    })
    setTimeout(() => notif.close(), 8000)
    return notif
  } catch (e) {
    console.error('Error enviando notificación:', e)
  }
}

export function notificarResultado(equipoLocal, equipoVisitante, golesLocal, golesVisitante) {
  const titulo = '⚽ Resultado registrado'
  const cuerpo = `${equipoLocal} ${golesLocal} - ${golesVisitante} ${equipoVisitante}`
  enviarNotificacion(titulo, { body: cuerpo })
}

export function notificarPartidoProximo(equipoLocal, equipoVisitante, hora) {
  const titulo = '📅 Partido próximo'
  const cuerpo = `${equipoLocal} vs ${equipoVisitante} - ${hora}`
  enviarNotificacion(titulo, { body: cuerpo })
}
