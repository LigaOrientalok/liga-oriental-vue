import { supabase } from './supabase'
import { sanitizarImgSrc } from './helpers'
import { useToastStore } from '../stores/toastStore'

const MAX_RETRIES = 2
const RETRY_DELAY = 1000

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isNetworkError(error) {
  return !error?.code && (error?.message?.includes('Failed to fetch') ||
    error?.message?.includes('NetworkError') ||
    error?.message?.includes('network') ||
    error?.message?.includes('ERR_INTERNET_DISCONNECTED'))
}

async function handleError(context, error, retryFn = null) {
  if (error) {
    console.error(context, error)

    if (isNetworkError(error) && retryFn) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        await sleep(RETRY_DELAY * attempt)
        try {
          const result = await retryFn()
          return result
        } catch (retryError) {
          if (attempt === MAX_RETRIES) {
            console.error(`${context} (after ${MAX_RETRIES} retries):`, retryError)
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
      toast.error(`Error: ${error.message || 'Error inesperado'}`)
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
    const { data, error } = await supabase.from('torneos').update(updates).eq('id', id).select()
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
    const { data, error } = await supabase.from('equipos').update(updates).eq('id', id).select()
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
    const { data, error } = await supabase.from('jugadores').update(updates).eq('id', id).select()
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
    const { data, error } = await supabase.from('resultados').update(updates).eq('id', id).select()
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
    const { data, error } = await supabase.from('sanciones').update(updates).eq('id', id).select()
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
    const { data, error } = await supabase.from('configuracion').update(updates).eq('id', id).select()
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
    const { data, error } = await supabase.from('pagos').update(updates).eq('id', id).select()
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
    const { data, error } = await supabase.from('sponsors').update(updates).eq('id', id).select().single()
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

  async createMedia(titulo, descripcion, tipo, contenido) {
    const user = (await supabase.auth.getUser()).data.user
    const { data, error } = await supabase.from('liga_media').insert({
      titulo, descripcion, tipo, contenido, uploaded_by: user?.id || null
    }).select().single()
    if (error) handleError('Error creating media:', error)
    return data
  },

  async updateMedia(id, updates) {
    const { data, error } = await supabase.from('liga_media').update(updates).eq('id', id).select().single()
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
    return data
  },

  async deleteComment(id) {
    const { error } = await supabase.from('liga_media_comments').delete().eq('id', id)
    if (error) handleError('Error deleting comment:', error)
  }
}
