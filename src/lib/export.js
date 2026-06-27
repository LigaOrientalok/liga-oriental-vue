import { supabase } from './supabase'
import { db } from './db'
import { escapeHtml } from './helpers'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'
import { useTorneoStore } from '../stores/torneoStore'

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function csvEscape(val) {
  const s = String(val || '')
  if (s.includes(',') || s.includes('"') || s.includes('\n') || /^[=+\-@]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export async function exportarJSON(torneoId) {
  const toast = useToastStore()
  try {
    const [torneo, equipos, jugadores, fixture, resultados] = await Promise.all([
      db.getTorneo(torneoId),
      db.getEquipos(torneoId),
      db.getJugadores(torneoId),
      db.getFixture(torneoId),
      db.getResultados(torneoId)
    ])
    const data = { torneo, equipos, jugadores, fixture, resultados, fecha_exportacion: new Date().toISOString() }
    const json = JSON.stringify(data, null, 2)
    downloadFile(json, `liga-oriental-${torneo?.nombre || 'datos'}-${Date.now()}.json`, 'application/json')
    toast.success('JSON exportado')
  } catch (e) {
    toast.error('Error exportando JSON')
    if (import.meta.env.DEV) console.error(e)
  }
}

export async function exportarCSV(torneoId) {
  const toast = useToastStore()
  try {
    const [equipos, jugadores] = await Promise.all([
      db.getEquipos(torneoId),
      db.getJugadores(torneoId)
    ])
    let csv = 'TABLA DE POSICIONES\n\n'
    csv += 'Pos,Equipo,PJ,V,E,P,GF,GC,DF,PTS\n'
    const sorted = [...equipos].sort((a, b) => (b.pts || 0) - (a.pts || 0))
    sorted.forEach((e, i) => {
      csv += `${i + 1},${csvEscape(e.nombre)},${e.pj||0},${e.v||0},${e.e||0},${e.p||0},${e.gf||0},${e.gc||0},${(e.gf||0)-(e.gc||0)},${e.pts||0}\n`
    })
    csv += '\n\nJUGADORES\n\n'
    csv += 'Nombre,Posicion,Goles,PJ,MVP,Amarillas,Rojas\n'
    jugadores.forEach(j => {
      csv += `${csvEscape(j.nombre)},${j.posicion},${j.goles||0},${j.pj||0},${j.mvps||0},${j.amarillas||0},${j.rojas||0}\n`
    })
    downloadFile(csv, `liga-oriental-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;')
    toast.success('CSV exportado')
  } catch (e) {
    toast.error('Error exportando CSV')
    if (import.meta.env.DEV) console.error(e)
  }
}

export async function exportarPDF(torneoId) {
  const toast = useToastStore()
  try {
    const [torneo, equipos, jugadores] = await Promise.all([
      db.getTorneo(torneoId),
      db.getEquipos(torneoId),
      db.getJugadores(torneoId)
    ])
    const sorted = [...equipos].sort((a, b) => (b.pts || 0) - (a.pts || 0))
    const topGoleadores = [...jugadores].sort((a, b) => (b.goles || 0) - (a.goles || 0)).slice(0, 10)
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      h1 { color: #eab308; border-bottom: 3px solid #eab308; padding-bottom: 10px; }
      h2 { color: #333; margin-top: 30px; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
      th { background: #eab308; color: black; font-weight: bold; }
      tr:nth-child(even) { background: #f9f9f9; }
    </style></head><body>
    <h1> LIGA ORIENTAL - ${escapeHtml(torneo?.nombre || '')}</h1>
    <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
    <h2> Tabla de Posiciones</h2>
    <table><thead><tr><th>Pos</th><th>Equipo</th><th>PJ</th><th>V</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DF</th><th>PTS</th></tr></thead><tbody>`
    sorted.forEach((e, i) => {
      html += `<tr><td>${i+1}</td><td>${escapeHtml(e.nombre)}</td><td>${e.pj||0}</td><td>${e.v||0}</td><td>${e.e||0}</td><td>${e.p||0}</td><td>${e.gf||0}</td><td>${e.gc||0}</td><td>${(e.gf||0)-(e.gc||0)}</td><td><strong>${e.pts||0}</strong></td></tr>`
    })
    html += `</tbody></table>
    <h2> Top Goleadores</h2>
    <table><thead><tr><th>Jugador</th><th>Goles</th><th>PJ</th><th>MVP</th></tr></thead><tbody>`
    topGoleadores.forEach(j => {
      html += `<tr><td>${escapeHtml(j.nombre)}</td><td>${j.goles||0}</td><td>${j.pj||0}</td><td>${j.mvps||0}</td></tr>`
    })
    html += `</tbody></table>
    <p style="margin-top:40px;text-align:center;color:#666;font-size:12px;">Documento generado - Liga Oriental</p>
    </body></html>`

    downloadFile(html, `liga-oriental-${torneo?.nombre || 'datos'}-${Date.now()}.html`, 'text/html;charset=utf-8')
    toast.success('HTML listo. Abrí el archivo y usá Ctrl+P para imprimir/PDF.')
  } catch (e) {
    toast.error('Error exportando PDF')
    if (import.meta.env.DEV) console.error(e)
  }
}

export async function respaldarDatos() {
  const auth = useAuthStore()
  const toast = useToastStore()
  try {
    await auth.soloAdmin()
  } catch {
    toast.error('Solo administradores')
    return
  }
  try {
    const torneos = await db.getTorneos()
    const data = { torneos: [], fecha_respaldo: new Date().toISOString() }
    for (const t of torneos) {
      const [equipos, jugadores, fixture, resultados] = await Promise.all([
        db.getEquipos(t.id), db.getJugadores(t.id), db.getFixture(t.id), db.getResultados(t.id)
      ])
      const resIds = resultados.length > 0 ? resultados.map(r => r.id) : [0]
      const [golesResp, tarjetasResp] = await Promise.all([
        supabase.from('goles').select('*').in('resultado_id', resIds),
        supabase.from('tarjetas').select('*').in('resultado_id', resIds)
      ])
      data.torneos.push({
        torneo: t, equipos, jugadores, fixture, resultados,
        goles: golesResp?.data || [],
        tarjetas: tarjetasResp?.data || []
      })
    }
    const json = JSON.stringify(data, null, 2)
    downloadFile(json, `respaldo-liga-oriental-${Date.now()}.json`, 'application/json')
    toast.success('Respaldo completado')
  } catch (e) {
    toast.error('Error en respaldo')
    if (import.meta.env.DEV) console.error(e)
  }
}

export async function restaurarRespaldo() {
  const auth = useAuthStore()
  try { await auth.soloAdmin() } catch { return }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const toast = useToastStore()
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.torneos || !Array.isArray(data.torneos)) {
        toast.error('Formato de respaldo invalido')
        return
      }
      toast.success(`Restaurando ${data.torneos.length} torneo(s)...`)
      for (const t of data.torneos) {
        if (t.torneo?.id) {
          const { nombre, descripcion } = t.torneo
          const nuevo = await db.createTorneo(nombre, descripcion)
          if (!nuevo) continue
          const torneoId = nuevo.id
          const eqMap = {}
          for (const eq of (t.equipos || [])) {
            const created = await db.createEquipo(torneoId, eq.nombre, eq.dia_semana, eq.logo)
            if (created) eqMap[eq.id] = created.id
          }
          for (const j of (t.jugadores || [])) {
            const created = await db.createJugador(torneoId, j.ci, j.nombre, j.posicion, j.pierna, j.foto)
            if (created && j.equipos?.length) {
              for (const eqId of j.equipos) {
                if (eqMap[eqId]) await db.vincularJugadorEquipo(created.id, eqMap[eqId])
              }
            }
          }
          for (const f of (t.fixture || [])) {
            await db.createFixture(torneoId, f.dia_semana, f.fecha, f.hora, eqMap[f.equipo_local_id] || f.equipo_local_id, eqMap[f.equipo_visitante_id] || f.equipo_visitante_id)
          }
          for (const r of (t.resultados || [])) {
            await db.createResultado(torneoId, r.fixture_id, eqMap[r.equipo_local_id] || r.equipo_local_id, eqMap[r.equipo_visitante_id] || r.equipo_visitante_id, r.goles_local, r.goles_visitante, r.mvp_id)
          }
        }
      }
      toast.success('Respaldo restaurado correctamente. Recarga la pagina.')
      setTimeout(() => location.reload(), 1500)
    } catch (e) {
      if (import.meta.env.DEV) console.error(e)
      toast.error('Error al restaurar. Verificá que el archivo sea válido.')
    }
  }
  input.click()
}

export async function recomputarEstadisticas(torneoId) {
  const auth = useAuthStore()
  const toast = useToastStore()
  try {
    await auth.soloAdmin()
  } catch {
    toast.error('Solo administradores')
    return
  }
  if (!confirm('Recomputar todas las estadisticas desde cero? Esto sobreescribira los datos actuales.')) return

  toast.success('Recomputando estadisticas...')
  try {
    const [equipos, jugadores, fixture, resultados] = await Promise.all([
      db.getEquipos(torneoId), db.getJugadores(torneoId),
      db.getFixture(torneoId), db.getResultados(torneoId)
    ])
    const resIds = resultados.length > 0 ? resultados.map(r => r.id) : [0]
    const [golesResp, tarjetasResp] = await Promise.all([
      supabase.from('goles').select('*').in('resultado_id', resIds),
      supabase.from('tarjetas').select('*').in('resultado_id', resIds)
    ])
    const allGoles = golesResp?.data || []
    const allTarjetas = tarjetasResp?.data || []

    const eqStats = {}
    for (const eq of equipos) eqStats[eq.id] = { pj: 0, v: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, vallas_invictas: 0 }
    const jStats = {}
    for (const j of jugadores) jStats[j.id] = { goles: 0, pj: 0, mvps: 0, amarillas: 0, rojas: 0 }

    for (const res of resultados) {
      const e1s = eqStats[res.equipo_local_id]
      const e2s = eqStats[res.equipo_visitante_id]
      if (!e1s || !e2s) continue
      e1s.pj++; e1s.gf += res.goles_local; e1s.gc += res.goles_visitante
      e2s.pj++; e2s.gf += res.goles_visitante; e2s.gc += res.goles_local
      if (res.goles_local > res.goles_visitante) { e1s.v++; e1s.pts += 3; e2s.p++ }
      else if (res.goles_visitante > res.goles_local) { e2s.v++; e2s.pts += 3; e1s.p++ }
      else { e1s.e++; e2s.e++; e1s.pts++; e2s.pts++ }
      if (res.goles_visitante === 0) e1s.vallas_invictas++
      if (res.goles_local === 0) e2s.vallas_invictas++

      const resGoles = allGoles.filter(g => g.resultado_id === res.id)
      const playersThisMatch = new Set()
      for (const g of resGoles) {
        if (jStats[g.jugador_id]) { jStats[g.jugador_id].goles++; playersThisMatch.add(g.jugador_id) }
      }
      for (const pid of playersThisMatch) if (jStats[pid]) jStats[pid].pj++

      const resTarjetas = allTarjetas.filter(t => t.resultado_id === res.id)
      for (const t of resTarjetas) {
        if (!jStats[t.jugador_id]) continue
        if (t.tipo === 'A') jStats[t.jugador_id].amarillas++
        else jStats[t.jugador_id].rojas++
      }
      if (res.mvp_id && jStats[res.mvp_id]) jStats[res.mvp_id].mvps++
    }

    const updatePromises = []
    for (const [id, s] of Object.entries(eqStats)) updatePromises.push(db.updateEquipo(parseInt(id), s))
    for (const [id, s] of Object.entries(jStats)) updatePromises.push(db.updateJugador(parseInt(id), s))
    await Promise.all(updatePromises)

    toast.success('Estadisticas recalculadas')
  } catch (e) {
    toast.error('Error al recomputar')
    if (import.meta.env.DEV) console.error(e)
  }
}
