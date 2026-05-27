import { supabase } from './supabase'
import { sanitizarImgSrc } from './helpers'
import { useToastStore } from '../stores/toastStore'

function handleError(context, error) {
  if (error) {
    console.error(context, error)
    const toast = useToastStore()
    toast.error(`Error: ${error.message || 'Error de conexión con Supabase'}`)
    return true
  }
  return false
}

export const db = {
  async getTorneos() {
    const { data, error } = await supabase.from('torneos').select('*')
    if (handleError('Error fetching torneos:', error)) return []
    return data || []
  },

  async getTorneo(id) {
    const { data, error } = await supabase.from('torneos').select('*').eq('id', id).single()
    if (handleError('Error fetching torneo:', error)) return null
    return data
  },

  async createTorneo(nombre, descripcion) {
    const { data, error } = await supabase.from('torneos').insert([{ nombre, descripcion }]).select()
    if (handleError('Error creating torneo:', error)) return null
    return data?.[0]
  },

  async updateTorneo(id, updates) {
    const { data, error } = await supabase.from('torneos').update(updates).eq('id', id).select()
    if (handleError('Error updating torneo:', error)) return null
    return data?.[0]
  },

  async deleteTorneo(id) {
    const { data: eqs } = await supabase.from('equipos').select('id').eq('torneo_id', id)
    const eqIds = eqs?.map(e => e.id) || [0]
    await this._deleteAllResultsByEquipos(eqIds)
    await supabase.from('jugador_equipo').delete().in('equipo_id', eqIds)
    await supabase.from('equipos').delete().eq('torneo_id', id)
    const { error } = await supabase.from('torneos').delete().eq('id', id)
    handleError('Error deleting torneo:', error)
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
    if (handleError('Error fetching equipos:', error)) return []
    if (data) data.forEach(e => { e.logo = sanitizarImgSrc(e.logo) })
    return data || []
  },

  async createEquipo(torneoId, nombre, dia, logo) {
    const { data, error } = await supabase.from('equipos').insert([{ torneo_id: torneoId, nombre, dia_semana: dia, logo }]).select()
    if (handleError('Error creating equipo:', error)) return null
    return data?.[0]
  },

  async updateEquipo(id, updates) {
    const { data, error } = await supabase.from('equipos').update(updates).eq('id', id).select()
    if (handleError('Error updating equipo:', error)) return null
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
    if (handleError('Error creating jugador:', error)) return null
    return data?.[0]
  },

  async updateJugador(id, updates) {
    const { data, error } = await supabase.from('jugadores').update(updates).eq('id', id).select()
    if (handleError('Error updating jugador:', error)) return null
    return data?.[0]
  },

  async deleteJugador(id) {
    await supabase.from('jugador_equipo').delete().eq('jugador_id', id)
    const { error } = await supabase.from('jugadores').delete().eq('id', id)
    if (error) handleError('Error deleting jugador:', error)
  },

  async vincularJugadorEquipo(jugadorId, equipoId) {
    const { data, error } = await supabase.from('jugador_equipo').insert([{ jugador_id: jugadorId, equipo_id: equipoId }]).select()
    if (handleError('Error vinculando jugador:', error)) return null
    return data?.[0]
  },

  async getEquiposJugador(jugadorId) {
    const { data, error } = await supabase.from('jugador_equipo').select('equipo_id').eq('jugador_id', jugadorId)
    if (handleError('Error fetching equipos del jugador:', error)) return []
    return data?.map(e => e.equipo_id) || []
  },

  async getFixture(torneoId) {
    const { data, error } = await supabase.from('fixture').select('*').eq('torneo_id', torneoId)
    if (handleError('Error fetching fixture:', error)) return []
    return data || []
  },

  async createFixture(torneoId, dia, fecha, hora, localId, visitanteId) {
    const { data, error } = await supabase.from('fixture').insert([{ torneo_id: torneoId, dia_semana: dia, fecha, hora, equipo_local_id: localId, equipo_visitante_id: visitanteId }]).select()
    if (handleError('Error creating fixture:', error)) return null
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
    if (handleError('Error creating resultado:', error)) return null
    return data?.[0]
  },

  async getResultados(torneoId) {
    const { data, error } = await supabase.from('resultados').select('*').eq('torneo_id', torneoId)
    if (handleError('Error fetching resultados:', error)) return []
    return data || []
  },

  async createGol(resultadoId, jugadorId, equipoId, minuto) {
    const { data, error } = await supabase.from('goles').insert([{ resultado_id: resultadoId, jugador_id: jugadorId, equipo_id: equipoId, minuto }]).select()
    if (handleError('Error creating gol:', error)) return null
    return data?.[0]
  },

  async getGoles(resultadoId) {
    const { data, error } = await supabase.from('goles').select('*').eq('resultado_id', resultadoId)
    if (handleError('Error fetching goles:', error)) return []
    return data || []
  },

  async updateResultado(id, updates) {
    const { data, error } = await supabase.from('resultados').update(updates).eq('id', id).select()
    if (handleError('Error updating resultado:', error)) return null
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
    if (handleError('Error creating tarjeta:', error)) return null
    return data?.[0]
  },

  async getTarjetas(resultadoId) {
    const { data, error } = await supabase.from('tarjetas').select('*').eq('resultado_id', resultadoId)
    if (handleError('Error fetching tarjetas:', error)) return []
    return data || []
  }
}
