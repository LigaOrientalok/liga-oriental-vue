import { supabase } from './supabase'
import { sanitizarImgSrc } from './helpers'
import { useToastStore } from '../stores/toastStore'

const MAX_RETRIES = 2
const RETRY_DELAY = 1000

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function pickAllowed(updates, allowed) {
  const sanitized = {}
  for (const k of allowed) {
    if (k in updates) sanitized[k] = updates[k]
  }
  return sanitized
}

function isNetworkError(error) {
  return !error?.code && (error?.message?.includes('Failed to fetch') ||
    error?.message?.includes('NetworkError') ||
    error?.message?.includes('network') ||
    error?.message?.includes('ERR_INTERNET_DISCONNECTED'))
}

function logError(context, error) {
  if (import.meta.env.DEV) console.error(context, error)
}

async function handleError(context, error, retryFn = null) {
  if (error) {
    logError(context, error)

    if (isNetworkError(error) && retryFn) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        await sleep(RETRY_DELAY * attempt)
        try {
          const result = await retryFn()
          return result
        } catch (retryError) {
          if (attempt === MAX_RETRIES) {
            logError(`${context} (after ${MAX_RETRIES} retries):`, retryError)
          }
        }
      }
    }

    const toast = useToastStore()
    if (isNetworkError(error)) {
      toast.error('Error de conexión. Verificá tu internet.')
    } else if (error.code === 'PGRST116') {
      toast.warning('No se encontraron datos')
    } else {
      toast.error('Ocurrió un error. Intentalo de nuevo.')
    }
    return { error: true, data: null }
  }
  return { error: false, data: null }
}

export const db = {
  async getTorneos() {
    const { data, error } = await supabase.from('torneos').select('*')
    const result = await handleError('Error fetching torneos:', error)
    if (result?.error) return []
    return data || []
  },

  async getTorneo(id) {
    const { data, error } = await supabase.from('torneos').select('*').eq('id', id).single()
    const result = await handleError('Error fetching torneo:', error)
    if (result?.error) return null
    return data
  },

  async createTorneo(nombre, descripcion) {
    const { data, error } = await supabase.from('torneos').insert([{ nombre, descripcion }]).select()
    const result = await handleError('Error creating torneo:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async updateTorneo(id, updates) {
    const allowed = pickAllowed(updates, ['nombre', 'descripcion'])
    const { data, error } = await supabase.from('torneos').update(allowed).eq('id', id).select()
    const result = await handleError('Error updating torneo:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async deleteTorneo(id) {
    const { data: eqs } = await supabase.from('equipos').select('id').eq('torneo_id', id)
    const eqIds = eqs?.map(e => e.id) || [0]
    await this._deleteAllResultsByEquipos(eqIds)
    await supabase.from('jugador_equipo').delete().in('equipo_id', eqIds)
    await supabase.from('equipos').delete().eq('torneo_id', id)
    const { error } = await supabase.from('torneos').delete().eq('id', id)
    if (error) handleError('Error deleting torneo:', error)
  },

  async _deleteAllResultsByEquipos(equipoIds) {
    const { data: res } = await supabase.from('resultados').select('id').in('equipo_local_id', equipoIds)
    const resIds = res?.map(r => r.id) || [0]
    await supabase.from('goles').delete().in('resultado_id', resIds)
    await supabase.from('tarjetas').delete().in('resultado_id', resIds)
    await supabase.from('resultados').delete().in('id', resIds)
    await supabase.from('fixture').delete().in('equipo_local_id', equipoIds)
  },

  async getEquipos(torneoId) {
    const { data, error } = await supabase.from('equipos').select('*').eq('torneo_id', torneoId)
    const result = await handleError('Error fetching equipos:', error)
    if (result?.error) return []
    if (data) data.forEach(e => { e.logo = sanitizarImgSrc(e.logo) })
    return data || []
  },

  async createEquipo(torneoId, nombre, dia, logo) {
    const { data, error } = await supabase.from('equipos').insert([{ torneo_id: torneoId, nombre, dia_semana: dia, logo }]).select()
    const result = await handleError('Error creating equipo:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async updateEquipo(id, updates) {
    const allowed = pickAllowed(updates, ['nombre', 'dia_semana', 'logo'])
    const { data, error } = await supabase.from('equipos').update(allowed).eq('id', id).select()
    const result = await handleError('Error updating equipo:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async deleteEquipo(id) {
    await this._deleteAllResultsByEquipos([id])
    await supabase.from('jugador_equipo').delete().eq('equipo_id', id)
    const { error } = await supabase.from('equipos').delete().eq('id', id)
    if (error) handleError('Error deleting equipo:', error)
  },

  async getJugadores(torneoId) {
    const { data: jugadores, error } = await supabase.from('jugadores').select('*').eq('torneo_id', torneoId)
    if (error) { handleError('Error fetching jugadores:', error); return [] }
    const { data: equipos } = await supabase.from('equipos').select('id').eq('torneo_id', torneoId)
    const equipoIds = equipos?.map(e => e.id) || []
    if (equipoIds.length > 0) {
      const { data: vinculos } = await supabase.from('jugador_equipo').select('*').in('equipo_id', equipoIds)
      if (vinculos) {
        jugadores.forEach(j => {
          j.equipos = vinculos.filter(v => v.jugador_id === j.id).map(v => v.equipo_id)
        })
      }
    }
    if (jugadores) jugadores.forEach(j => { j.foto = sanitizarImgSrc(j.foto) })
    return jugadores
  },

  async createJugador(torneoId, ci, nombre, posicion, pierna, foto) {
    const { data, error } = await supabase.from('jugadores').insert([{ torneo_id: torneoId, ci, nombre, posicion, pierna, foto }]).select()
    const result = await handleError('Error creating jugador:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async updateJugador(id, updates) {
    const allowed = pickAllowed(updates, ['ci', 'nombre', 'posicion', 'pierna', 'foto'])
    const { data, error } = await supabase.from('jugadores').update(allowed).eq('id', id).select()
    const result = await handleError('Error updating jugador:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async deleteJugador(id) {
    await supabase.from('jugador_equipo').delete().eq('jugador_id', id)
    const { error } = await supabase.from('jugadores').delete().eq('id', id)
    if (error) handleError('Error deleting jugador:', error)
  },

  async vincularJugadorEquipo(jugadorId, equipoId) {
    const { data, error } = await supabase.from('jugador_equipo').insert([{ jugador_id: jugadorId, equipo_id: equipoId }]).select()
    const result = await handleError('Error vinculando jugador:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async getEquiposJugador(jugadorId) {
    const { data, error } = await supabase.from('jugador_equipo').select('equipo_id').eq('jugador_id', jugadorId)
    const result = await handleError('Error fetching equipos del jugador:', error)
    if (result?.error) return []
    return data?.map(e => e.equipo_id) || []
  },

  async getFixture(torneoId) {
    const { data, error } = await supabase.from('fixture').select('*').eq('torneo_id', torneoId)
    const result = await handleError('Error fetching fixture:', error)
    if (result?.error) return []
    return data || []
  },

  async createFixture(torneoId, dia, fecha, hora, localId, visitanteId) {
    const { data, error } = await supabase.from('fixture').insert([{ torneo_id: torneoId, dia_semana: dia, fecha, hora, equipo_local_id: localId, equipo_visitante_id: visitanteId }]).select()
    const result = await handleError('Error creating fixture:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async updateFixture(id, updates) {
    const allowed = pickAllowed(updates, ['dia_semana', 'fecha', 'hora', 'equipo_local_id', 'equipo_visitante_id'])
    const { data, error } = await supabase.from('fixture').update(allowed).eq('id', id).select()
    const result = await handleError('Error updating fixture:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async deleteFixture(id) {
    const { error } = await supabase.from('fixture').delete().eq('id', id)
    if (error) handleError('Error deleting fixture:', error)
  },

  async createResultado(torneoId, fixtureId, localId, visitanteId, golesLocal, golesVisitante, mvpId) {
    const { data, error } = await supabase.from('resultados').insert([{
      torneo_id: torneoId, fixture_id: fixtureId,
      equipo_local_id: localId, equipo_visitante_id: visitanteId,
      goles_local: golesLocal, goles_visitante: golesVisitante,
      mvp_id: mvpId, estado: 'finalizado'
    }]).select()
    const result = await handleError('Error creating resultado:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async getResultados(torneoId) {
    const { data, error } = await supabase.from('resultados').select('*').eq('torneo_id', torneoId)
    const result = await handleError('Error fetching resultados:', error)
    if (result?.error) return []
    return data || []
  },

  async createGol(resultadoId, jugadorId, equipoId, minuto) {
    const { data, error } = await supabase.from('goles').insert([{ resultado_id: resultadoId, jugador_id: jugadorId, equipo_id: equipoId, minuto }]).select()
    const result = await handleError('Error creating gol:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async getGoles(resultadoId) {
    const { data, error } = await supabase.from('goles').select('*').eq('resultado_id', resultadoId)
    const result = await handleError('Error fetching goles:', error)
    if (result?.error) return []
    return data || []
  },

  async updateResultado(id, updates) {
    const allowed = pickAllowed(updates, ['goles_local', 'goles_visitante', 'mvp_id', 'estado'])
    const { data, error } = await supabase.from('resultados').update(allowed).eq('id', id).select()
    const result = await handleError('Error updating resultado:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async deleteResultado(id) {
    const { error } = await supabase.from('resultados').delete().eq('id', id)
    if (error) handleError('Error deleting resultado:', error)
  },

  async deleteGolesByResultado(resultadoId) {
    const { error } = await supabase.from('goles').delete().eq('resultado_id', resultadoId)
    if (error) handleError('Error deleting goles:', error)
  },

  async deleteTarjetasByResultado(resultadoId) {
    const { error } = await supabase.from('tarjetas').delete().eq('resultado_id', resultadoId)
    if (error) handleError('Error deleting tarjetas:', error)
  },

  async createTarjeta(resultadoId, jugadorId, equipoId, tipo, minuto) {
    const { data, error } = await supabase.from('tarjetas').insert([{ resultado_id: resultadoId, jugador_id: jugadorId, equipo_id: equipoId, tipo, minuto }]).select()
    const result = await handleError('Error creating tarjeta:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async getTarjetas(resultadoId) {
    const { data, error } = await supabase.from('tarjetas').select('*').eq('resultado_id', resultadoId)
    const result = await handleError('Error fetching tarjetas:', error)
    if (result?.error) return []
    return data || []
  },

  async getSanciones(torneoId) {
    const { data, error } = await supabase.from('sanciones').select('*').eq('torneo_id', torneoId)
    const result = await handleError('Error fetching sanciones:', error)
    if (result?.error) return []
    return data || []
  },

  async createSancion(torneoId, jugadorId, motivo, tipo, fechaInicio, fechaFin) {
    const { data, error } = await supabase.from('sanciones').insert([{
      torneo_id: torneoId, jugador_id: jugadorId, motivo, tipo,
      fecha_inicio: fechaInicio, fecha_fin: fechaFin, activa: true
    }]).select()
    const result = await handleError('Error creating sancion:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async updateSancion(id, updates) {
    const allowed = pickAllowed(updates, ['motivo', 'tipo', 'fecha_inicio', 'fecha_fin', 'activa'])
    const { data, error } = await supabase.from('sanciones').update(allowed).eq('id', id).select()
    const result = await handleError('Error updating sancion:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async deleteSancion(id) {
    const { error } = await supabase.from('sanciones').delete().eq('id', id)
    if (error) handleError('Error deleting sancion:', error)
  },

  async getConfig() {
    const { data, error } = await supabase.from('configuracion').select('*').limit(1).maybeSingle()
    const result = await handleError('Error fetching config:', error)
    if (result?.error) return null
    return data
  },

  async updateConfig(id, updates) {
    const allowed = pickAllowed(updates, ['titulo', 'logo_url', 'color_primario', 'color_secundario', 'fondo_oscuro', 'fondo_claro'])
    const { data, error } = await supabase.from('configuracion').update(allowed).eq('id', id).select()
    const result = await handleError('Error updating config:', error)
    if (result?.error) return null
    return data?.[0]
  },

  // Pagos
  async getPagos(torneoId) {
    const { data, error } = await supabase.from('pagos').select('*').eq('torneo_id', torneoId)
    const result = await handleError('Error fetching pagos:', error)
    if (result?.error) return []
    return data || []
  },

  async getPagosByEquipo(equipoId) {
    const { data, error } = await supabase.from('pagos').select('*').eq('equipo_id', equipoId)
    const result = await handleError('Error fetching pagos de equipo:', error)
    if (result?.error) return []
    return data || []
  },

  async createPago(torneoId, usuarioId, equipoId, concepto, monto) {
    const { data, error } = await supabase.from('pagos').insert([{
      torneo_id: torneoId, usuario_id: usuarioId, equipo_id: equipoId,
      concepto, monto, estado: 'pendiente'
    }]).select()
    const result = await handleError('Error creating pago:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async updatePago(id, updates) {
    const allowed = pickAllowed(updates, ['concepto', 'monto', 'estado', 'mp_preference_id', 'mp_payment_id'])
    const { data, error } = await supabase.from('pagos').update(allowed).eq('id', id).select()
    const result = await handleError('Error updating pago:', error)
    if (result?.error) return null
    return data?.[0]
  },

  async deletePago(id) {
    const { error } = await supabase.from('pagos').delete().eq('id', id)
    if (error) handleError('Error deleting pago:', error)
  },

  // Sponsors
  async getSponsors() {
    const { data, error } = await supabase.from('sponsors').select('*').order('orden', { ascending: true })
    if (error) handleError('Error fetching sponsors:', error)
    return data || []
  },

  async createSponsor(nombre, tipo, contenido, link, orden) {
    const { data, error } = await supabase.from('sponsors').insert({
      nombre, tipo, contenido, link, orden
    }).select().single()
    if (error) handleError('Error creating sponsor:', error)
    return data
  },

  async updateSponsor(id, updates) {
    const allowed = pickAllowed(updates, ['nombre', 'tipo', 'contenido', 'link', 'orden', 'activo'])
    const { data, error } = await supabase.from('sponsors').update(allowed).eq('id', id).select().single()
    if (error) handleError('Error updating sponsor:', error)
    return data
  },

  async deleteSponsor(id) {
    const { error } = await supabase.from('sponsors').delete().eq('id', id)
    if (error) handleError('Error deleting sponsor:', error)
  },

  // Liga Media
  async getMedia() {
    const { data, error } = await supabase.from('liga_media').select('*').order('created_at', { ascending: false })
    if (error) handleError('Error fetching media:', error)
    return data || []
  },

  async uploadFile(file) {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
    const MAX_SIZE = 10 * 1024 * 1024
    if (!ALLOWED_TYPES.includes(file.type)) {
      useToastStore().error('Tipo de archivo no permitido. Solo imágenes y videos.')
      return null
    }
    if (file.size > MAX_SIZE) {
      useToastStore().error('Archivo muy grande. Máximo 10MB.')
      return null
    }
    const userId = (await supabase.auth.getUser()).data.user?.id || 'anonymous'
    const ext = file.name.split('.').pop()
    const filePath = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('liga-media').upload(filePath, file)
    if (error) handleError('Error uploading file:', error)
    const { data: { publicUrl } } = supabase.storage.from('liga-media').getPublicUrl(filePath)
    return publicUrl
  },

  async createMedia(titulo, descripcion, tipo, contenido) {
    const user = (await supabase.auth.getUser()).data.user
    const { data, error } = await supabase.from('liga_media').insert({
      titulo, descripcion, tipo, contenido, uploaded_by: user?.id || null
    }).select().single()
    if (error) handleError('Error creating media:', error)
    if (data) {
      await supabase.from('actividad').insert({ tipo: 'media', usuario_id: user?.id, mensaje: `📸 Se subió "${titulo}"`, referencia_id: data.id })
    }
    return data
  },

  async updateMedia(id, updates) {
    const allowed = pickAllowed(updates, ['titulo', 'descripcion', 'tipo', 'contenido'])
    const { data, error } = await supabase.from('liga_media').update(allowed).eq('id', id).select().single()
    if (error) handleError('Error updating media:', error)
    return data
  },

  async deleteMedia(id) {
    const { error } = await supabase.from('liga_media').delete().eq('id', id)
    if (error) handleError('Error deleting media:', error)
  },

  // ---- Likes ----
  async getMediaLikes(mediaId) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    const { count } = await supabase.from('liga_media_likes').select('*', { count: 'exact', head: true }).eq('media_id', mediaId)
    let userLiked = false
    if (userId) {
      const { data: myLike } = await supabase.from('liga_media_likes').select('id').eq('media_id', mediaId).eq('user_id', userId).maybeSingle()
      userLiked = !!myLike
    }
    return { count: count || 0, userLiked }
  },

  async toggleLike(mediaId) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return
    const { data: existing } = await supabase.from('liga_media_likes').select('id').eq('media_id', mediaId).eq('user_id', userId).maybeSingle()
    if (existing) {
      await supabase.from('liga_media_likes').delete().eq('id', existing.id)
    } else {
      await supabase.from('liga_media_likes').insert({ media_id: mediaId, user_id: userId })
    }
    const userId2 = (await supabase.auth.getUser()).data.user?.id
    const { count } = await supabase.from('liga_media_likes').select('*', { count: 'exact', head: true }).eq('media_id', mediaId)
    let userLiked = false
    if (userId2) {
      const { data: myLike } = await supabase.from('liga_media_likes').select('id').eq('media_id', mediaId).eq('user_id', userId2).maybeSingle()
      userLiked = !!myLike
    }
    return { count: count || 0, userLiked }
  },

  // ---- Comments ----
  async getMediaComments(mediaId) {
    const { data, error } = await supabase
      .from('liga_media_comments')
      .select('id, media_id, user_id, contenido, created_at')
      .eq('media_id', mediaId)
      .order('created_at', { ascending: true })
    if (error) handleError('Error fetching comments:', error)
    const userIds = [...new Set((data || []).map(c => c.user_id))]
    const userMap = {}
    if (userIds.length) {
      const { data: users } = await supabase.from('usuarios').select('id, email').in('id', userIds)
      if (users) users.forEach(u => { userMap[u.id] = u.email?.split('@')[0] || 'Usuario' })
    }
    return (data || []).map(c => ({ ...c, username: userMap[c.user_id] || 'Usuario' }))
  },

  async addComment(mediaId, contenido) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return
    const { data, error } = await supabase.from('liga_media_comments').insert({ media_id: mediaId, user_id: userId, contenido }).select().single()
    if (error) handleError('Error adding comment:', error)
    if (data) {
      await supabase.from('actividad').insert({ tipo: 'comentario', usuario_id: userId, mensaje: `💬 Se comentó "${contenido.substring(0, 50)}"`, referencia_id: mediaId })
    }
    return data
  },

  async deleteComment(id) {
    const { error } = await supabase.from('liga_media_comments').delete().eq('id', id)
    if (error) handleError('Error deleting comment:', error)
  },

  // ---- Notifications ----
  async getNotificaciones() {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) handleError('Error fetching notifications:', error)
    return data || []
  },

  async marcarLeida(id) {
    const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    if (error) handleError('Error marking notification as read:', error)
  },

  async marcarTodasLeidas() {
    const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('leida', false)
    if (error) handleError('Error marking all notifications as read:', error)
  },

  async notifCount() {
    const { count, error } = await supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('leida', false)
    if (error) return 0
    return count || 0
  },

  // ---- Alineaciones ----
  async getAlineaciones(fixtureId) {
    const { data, error } = await supabase.from('alineaciones').select('*').eq('fixture_id', fixtureId)
    if (error) handleError('Error fetching alineaciones:', error)
    return data || []
  },

  async setAlineacion(fixtureId, equipoId, jugadorId, titular = true) {
    const { error } = await supabase.from('alineaciones').upsert({
      fixture_id: fixtureId, equipo_id: equipoId, jugador_id: jugadorId, titular
    }, { onConflict: 'fixture_id,equipo_id,jugador_id' })
    if (error) handleError('Error setting alineacion:', error)
  },

  async removeAlineacion(fixtureId, equipoId, jugadorId) {
    const { error } = await supabase.from('alineaciones').delete()
      .eq('fixture_id', fixtureId).eq('equipo_id', equipoId).eq('jugador_id', jugadorId)
    if (error) handleError('Error removing alineacion:', error)
  },

  // ---- Sanciones activas para un jugador ----
  async getSancionesJugador(jugadorId) {
    const { data, error } = await supabase.from('sanciones').select('*')
      .eq('jugador_id', jugadorId).eq('activa', true)
    if (error) handleError('Error fetching sanciones:', error)
    return data || []
  },

  // ---- @mentions search ----
  async searchMentionables(query) {
    if (!query || query.length < 1) return { jugadores: [], equipos: [] }
    const q = `%${query}%`
    const [jugRes, eqRes] = await Promise.all([
      supabase.from('jugadores').select('id, nombre').ilike('nombre', q).limit(5),
      supabase.from('equipos').select('id, nombre').ilike('nombre', q).limit(5)
    ])
    return {
      jugadores: jugRes.data || [],
      equipos: eqRes.data || []
    }
  },

  // ---- Feed ----
  async getFeed(limit = 20) {
    const { data, error } = await supabase.from('actividad').select('*').order('created_at', { ascending: false }).limit(limit)
    if (error) handleError('Error fetching feed:', error)
    return data || []
  },

  async logActividad(tipo, mensaje, referenciaId = null) {
    const user = (await supabase.auth.getUser()).data.user
    const { error } = await supabase.from('actividad').insert({
      tipo, usuario_id: user?.id || null, mensaje, referencia_id: referenciaId
    })
    if (error) handleError('Error logging activity:', error)
  },

  // ---- Predicciones ----
  async getPredicciones(fixtureId) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    const [allPreds, myPred] = await Promise.all([
      supabase.from('predicciones').select('*, usuarios!inner(email)').eq('fixture_id', fixtureId),
      userId ? supabase.from('predicciones').select('*').eq('fixture_id', fixtureId).eq('user_id', userId).maybeSingle() : { data: null }
    ])
    return {
      all: allPreds.data || [],
      mine: myPred.data || null
    }
  },

  async setPrediccion(fixtureId, golesLocal, golesVisitante) {
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return
    const { error } = await supabase.from('predicciones').upsert({
      fixture_id: fixtureId, user_id: user.id, goles_local: golesLocal, goles_visitante: golesVisitante,
    }, { onConflict: 'fixture_id,user_id' })
    if (error) handleError('Error saving prediccion:', error)
    await supabase.from('actividad').insert({ tipo: 'prediccion', usuario_id: user.id, mensaje: `🔮 Se pronosticó ${golesLocal}-${golesVisitante}` })
  },

  async getRankingPredicciones() {
    const { data, error } = await supabase
      .from('predicciones')
      .select('user_id, usuarios!inner(email), puntos')
      .order('puntos', { ascending: false })
    if (error) handleError('Error fetching ranking:', error)
    const rank = {}
    for (const p of data || []) {
      if (!rank[p.user_id]) rank[p.user_id] = { email: p.usuarios?.email?.split('@')[0] || p.user_id, puntos: 0 }
      rank[p.user_id].puntos += (p.puntos || 0)
    }
    return Object.values(rank).sort((a, b) => b.puntos - a.puntos)
  },

  // ---- MVP ----
  async getMvpVotos(resultadoId) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    const [votos, miVoto] = await Promise.all([
      supabase.from('mvp_votos').select('*, jugadores!inner(nombre)').eq('resultado_id', resultadoId),
      userId ? supabase.from('mvp_votos').select('*').eq('resultado_id', resultadoId).eq('user_id', userId).maybeSingle() : { data: null }
    ])
    return { votos: votos.data || [], miVoto: miVoto.data || null }
  },

  async votarMvp(resultadoId, jugadorId) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return
    const { error } = await supabase.from('mvp_votos').upsert({
      resultado_id: resultadoId, user_id: userId, jugador_id: jugadorId
    }, { onConflict: 'resultado_id,user_id' })
    if (error) handleError('Error voting MVP:', error)
  },

  // ---- Chat ----
  async getMensajes(equipoId) {
    const { data, error } = await supabase
      .from('chat_mensajes')
      .select('*, usuarios!inner(email)')
      .eq('equipo_id', equipoId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (error) handleError('Error fetching messages:', error)
    return (data || []).map(m => ({
      ...m,
      username: m.usuarios?.email?.split('@')[0] || 'Usuario'
    }))
  },

  async enviarMensaje(equipoId, mensaje) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return
    const { error } = await supabase.from('chat_mensajes').insert({
      equipo_id: equipoId, user_id: userId, mensaje
    })
    if (error) handleError('Error sending message:', error)
  }
}
