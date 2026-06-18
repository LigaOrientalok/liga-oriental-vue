<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { useTorneoStore } from '../stores/torneoStore'
import { useAuthStore } from '../stores/authStore'
import { db } from '../lib/db'
import { calcularXP, calcularNivel, xpParaSiguienteNivel, getNivelColor, getNivelLabel, calcularRating, XP_PER_LEVEL } from '../lib/playerStats'

const torneo = useTorneoStore()
const auth = useAuthStore()

const jugadores = ref([])
const loading = ref(false)
const selectedPlayerId = ref(null)
const playerData = ref(null)

const MISIONES = [
  { id: 'first_match', label: 'Primer Partido', icon: '📋', xp: 10, tipo: 'general', check: (j, ctx) => (j.pj || 0) >= 1 },
  { id: 'ten_matches', label: '10 Partidos', icon: '📋📋', xp: 40, tipo: 'general', check: (j, ctx) => (j.pj || 0) >= 10 },
  { id: 'twenty_matches', label: '20 Partidos', icon: '📋📋📋', xp: 80, tipo: 'general', check: (j, ctx) => (j.pj || 0) >= 20 },
  { id: 'thirty_matches', label: '30 Partidos', icon: '📋📋📋📋', xp: 120, tipo: 'general', check: (j, ctx) => (j.pj || 0) >= 30 },
  { id: 'fifty_matches', label: '50 Partidos', icon: '📋📋📋📋📋', xp: 180, tipo: 'general', check: (j, ctx) => (j.pj || 0) >= 50 },
  { id: 'first_mvp', label: 'Primer MVP', icon: '🏆', xp: 30, tipo: 'general', check: (j, ctx) => (j.mvps || 0) >= 1 },
  { id: 'five_mvps', label: '5 MVPs', icon: '🏆🏆', xp: 80, tipo: 'general', check: (j, ctx) => (j.mvps || 0) >= 5 },
  { id: 'ten_mvps', label: '10 MVPs', icon: '🏆🏆🏆', xp: 150, tipo: 'general', check: (j, ctx) => (j.mvps || 0) >= 10 },
  { id: 'twenty_mvps', label: '20 MVPs', icon: '🏆🏆🏆🏆', xp: 250, tipo: 'general', check: (j, ctx) => (j.mvps || 0) >= 20 },
  { id: 'never_red', label: 'Nunca Expulsado', icon: '🟡', xp: 30, tipo: 'general', check: (j, ctx) => (j.rojas || 0) === 0 },
  { id: 'fair_play_10', label: 'Fair Play (10 PJ sin rojas)', icon: '🟢', xp: 50, tipo: 'general', check: (j, ctx) => (j.rojas || 0) === 0 && (j.pj || 0) >= 10 },
  { id: 'perfect', label: 'Juego Perfecto', icon: '💎', xp: 40, tipo: 'general', check: (j, ctx) => (j.goles || 0) > ((j.amarillas || 0) + (j.rojas || 0)) },
  { id: 'no_cards_3', label: '3 Partidos sin Tarjeta', icon: '🟢🟢🟢', xp: 35, tipo: 'general', check: (j, ctx) => ctx?.rachaSinTarjeta3 === true },
  { id: 'no_cards_5', label: '5 Partidos sin Tarjeta', icon: '🟢🟢🟢🟢🟢', xp: 60, tipo: 'general', check: (j, ctx) => (ctx?.rachaSinTarjetaMax || 0) >= 5 },
  { id: 'no_cards_10', label: '10 Partidos sin Tarjeta', icon: '✨🟢✨', xp: 120, tipo: 'general', check: (j, ctx) => (ctx?.rachaSinTarjetaMax || 0) >= 10 },
  { id: 'two_teams', label: 'Dos Equipos', icon: '🔄', xp: 40, tipo: 'general', check: (j, ctx) => (j.equipos?.length || 0) >= 2 },
  { id: 'five_wins', label: '5 Victorias', icon: '🏅', xp: 60, tipo: 'general', check: (j, ctx) => (ctx?.wins || 0) >= 5 },
  { id: 'ten_wins', label: '10 Victorias', icon: '🏅🏅', xp: 120, tipo: 'general', check: (j, ctx) => (ctx?.wins || 0) >= 10 },
  { id: 'hundred_club', label: 'Club 90 (Rating)', icon: '💯', xp: 80, tipo: 'general', check: (j, ctx) => calcularRating(j) >= 90 },
  { id: 'debut_goal', label: 'Gol en el Debut', icon: '⚽✨', xp: 30, tipo: 'general', check: (j, ctx) => ctx?.debutGoal === true },
  { id: 'profile_complete', label: 'Perfil Completo', icon: '📸', xp: 15, tipo: 'general', check: (j, ctx) => j.foto && !j.foto.includes('Sin Foto') },
  { id: 'champion', label: 'Campeon', icon: '🏆', xp: 150, tipo: 'general', check: (j, ctx) => ctx?.esCampeon === true },
  { id: 'top_scorer', label: 'Goleador del Torneo', icon: '⚽👑', xp: 120, tipo: 'general', check: (j, ctx) => ctx?.esGoleador === true },
  { id: 'legend', label: 'Leyenda', icon: '👑', xp: 200, tipo: 'general', check: (j, ctx) => calcularNivel(calcularXP(j)) >= 10 },
  { id: 'super_legend', label: 'Super Leyenda', icon: '👑👑', xp: 400, tipo: 'general', check: (j, ctx) => calcularNivel(calcularXP(j)) >= 15 },

  { id: 'first_goal', label: 'Primer Gol', icon: '⚽', xp: 20, tipo: 'field', check: (j, ctx) => (j.goles || 0) >= 1 },
  { id: 'five_goals', label: '5 Goles', icon: '⚽⚽', xp: 50, tipo: 'field', check: (j, ctx) => (j.goles || 0) >= 5 },
  { id: 'ten_goals', label: '10 Goles', icon: '⚽⚽⚽', xp: 100, tipo: 'field', check: (j, ctx) => (j.goles || 0) >= 10 },
  { id: 'twenty_goals', label: '20 Goles', icon: '⚽⚽⚽⚽', xp: 180, tipo: 'field', check: (j, ctx) => (j.goles || 0) >= 20 },
  { id: 'thirty_goals', label: '30 Goles', icon: '⚽⚽⚽⚽⚽', xp: 280, tipo: 'field', check: (j, ctx) => (j.goles || 0) >= 30 },
  { id: 'doblete', label: 'Doblete', icon: '⚽⚽', xp: 30, tipo: 'field', check: (j, ctx) => (j.dobletes || 0) >= 1 },
  { id: 'three_dobletes', label: '3 Dobletes', icon: '⚽⚽⚽⚽⚽⚽', xp: 60, tipo: 'field', check: (j, ctx) => (j.dobletes || 0) >= 3 },
  { id: 'ten_dobletes', label: '10 Dobletes', icon: '⚽⚽💥', xp: 120, tipo: 'field', check: (j, ctx) => (j.dobletes || 0) >= 10 },
  { id: 'hat_trick', label: 'Hat Trick', icon: '🎩', xp: 60, tipo: 'field', check: (j, ctx) => (j.hattricks || 0) >= 1 },
  { id: 'five_hattricks', label: '5 Hat Tricks', icon: '🎩🎩🎩', xp: 200, tipo: 'field', check: (j, ctx) => (j.hattricks || 0) >= 5 },
  { id: 'poker', label: ' Poker', icon: '🎩🎩', xp: 100, tipo: 'field', check: (j, ctx) => (j.pokers || 0) >= 1 },
  { id: 'two_pokers', label: '2  Poker', icon: '🎩🎩🎩🎩', xp: 200, tipo: 'field', check: (j, ctx) => (j.pokers || 0) >= 2 },
  { id: 'goal_per_game', label: 'Promedio Gol (1+ por partido)', icon: '📊', xp: 80, tipo: 'field', check: (j, ctx) => (j.pj || 0) > 0 && (j.goles || 0) >= (j.pj || 0) },
  { id: 'super_gpg', label: 'Super Promedio (1.5+ por partido)', icon: '📊📊', xp: 150, tipo: 'field', check: (j, ctx) => (j.pj || 0) >= 2 && (j.goles || 0) >= (j.pj || 0) * 1.5 },
  { id: 'prolific_20', label: 'Prolifico (G+M >= 20)', icon: '💪', xp: 80, tipo: 'field', check: (j, ctx) => (j.goles || 0) + (j.mvps || 0) >= 20 },
  { id: 'prolific_40', label: 'Super Prolifico (G+M >= 40)', icon: '💪💪', xp: 180, tipo: 'field', check: (j, ctx) => (j.goles || 0) + (j.mvps || 0) >= 40 },
  { id: 'double_digit', label: 'Doble Digito', icon: '🔟', xp: 100, tipo: 'field', check: (j, ctx) => (j.goles || 0) >= 10 && (j.mvps || 0) >= 5 },
  { id: 'five_scored', label: 'Gol en 5 Partidos', icon: '⚽📅', xp: 60, tipo: 'field', check: (j, ctx) => (ctx?.matchesConGol || 0) >= 5 },
  { id: 'ten_scored', label: 'Gol en 10 Partidos', icon: '⚽📅📅', xp: 120, tipo: 'field', check: (j, ctx) => (ctx?.matchesConGol || 0) >= 10 },
  { id: 'golden_match', label: 'Partido Dorado (Gol + MVP)', icon: '🏆⚽', xp: 40, tipo: 'field', check: (j, ctx) => (ctx?.goldenMatch || 0) >= 1 },
  { id: 'brace_mvp', label: 'Doblete MVP', icon: '🏆⚽⚽', xp: 60, tipo: 'field', check: (j, ctx) => (ctx?.braceMVP || 0) >= 1 },
  { id: 'hattrick_mvp', label: 'Hat Trick MVP', icon: '🏆🎩', xp: 100, tipo: 'field', check: (j, ctx) => (ctx?.hattrickMVP || 0) >= 1 },
  { id: 'poker_mvp', label: ' Poker MVP', icon: '🏆🎩🎩', xp: 200, tipo: 'field', check: (j, ctx) => (ctx?.pokerMVP || 0) >= 1 },
  { id: 'five_win_goals', label: '5 Goles en Victorias', icon: '⚽🏅', xp: 60, tipo: 'field', check: (j, ctx) => (ctx?.winGoals || 0) >= 5 },
  { id: 'ten_win_goals', label: '10 Goles en Victorias', icon: '⚽🏅🏅', xp: 120, tipo: 'field', check: (j, ctx) => (ctx?.winGoals || 0) >= 10 },

  { id: 'first_clean', label: 'Valla Invicta', icon: '🧤', xp: 30, tipo: 'por', check: (j, ctx) => (j.vallas_invictas || 0) >= 1 },
  { id: 'five_clean', label: '5 Vallas Invictas', icon: '🧤🧤', xp: 90, tipo: 'por', check: (j, ctx) => (j.vallas_invictas || 0) >= 5 },
  { id: 'ten_clean', label: '10 Vallas Invictas', icon: '🧤🧤🧤', xp: 160, tipo: 'por', check: (j, ctx) => (j.vallas_invictas || 0) >= 10 },
  { id: 'twenty_clean', label: '20 Vallas Invictas', icon: '🧤🧤🧤🧤', xp: 260, tipo: 'por', check: (j, ctx) => (j.vallas_invictas || 0) >= 20 },
  { id: 'thirty_clean', label: '30 Vallas Invictas', icon: '🧤🧤🧤🧤🧤', xp: 380, tipo: 'por', check: (j, ctx) => (j.vallas_invictas || 0) >= 30 },
  { id: 'clean_debut', label: 'Debut Invicto', icon: '🧤✨', xp: 25, tipo: 'por', check: (j, ctx) => ctx?.vallaInvictaDebut === true },
  { id: 'clean_streak_3', label: '3 Vallas Consecutivas', icon: '🧤🧤🧤', xp: 80, tipo: 'por', check: (j, ctx) => ctx?.vallasConsecutivas3 === true },
  { id: 'clean_streak_5', label: '5 Vallas Consecutivas', icon: '🧤🧤🧤🧤🧤', xp: 140, tipo: 'por', check: (j, ctx) => (ctx?.maxCleanStreak || 0) >= 5 },
  { id: 'clean_streak_10', label: '10 Vallas Consecutivas', icon: '🔟🧤', xp: 280, tipo: 'por', check: (j, ctx) => (ctx?.maxCleanStreak || 0) >= 10 },
  { id: 'por_mvp', label: 'Portero MVP', icon: '🧤🏆', xp: 50, tipo: 'por', check: (j, ctx) => (j.mvps || 0) >= 1 },
  { id: 'penalty_hero', label: 'Heroe (5 MVPs)', icon: '🙌', xp: 120, tipo: 'por', check: (j, ctx) => (j.mvps || 0) >= 5 },
  { id: 'goalie_golden', label: 'Actuacion Dorada (MVP + VI)', icon: '🧤🏆✨', xp: 60, tipo: 'por', check: (j, ctx) => (ctx?.cleanMVP || 0) >= 1 },
  { id: 'goalie_diamond', label: '5 Actuaciones Doradas', icon: '💎🧤', xp: 160, tipo: 'por', check: (j, ctx) => (ctx?.cleanMVP || 0) >= 5 },
  { id: 'goalie_goal', label: 'Portero Goleador', icon: '🧤⚽', xp: 100, tipo: 'por', check: (j, ctx) => (j.goles || 0) >= 1 },
  { id: 'iron_wall', label: 'Muro (-1 gol x partido)', icon: '🧱', xp: 100, tipo: 'por', check: (j, ctx) => (j.pj || 0) >= 3 && (ctx?.gcTotal || 0) / (j.pj || 1) < 1 },
  { id: 'iron_wall_05', label: 'Fortaleza (-0.5 gol x partido)', icon: '🏰', xp: 200, tipo: 'por', check: (j, ctx) => (j.pj || 0) >= 5 && (ctx?.gcTotal || 0) / (j.pj || 1) < 0.5 },
  { id: 'goalie_wall', label: 'VI > Goles Recibidos', icon: '🧤🧱', xp: 80, tipo: 'por', check: (j, ctx) => (j.vallas_invictas || 0) > (ctx?.gcTotal || 0) - (j.vallas_invictas || 0) },
  { id: 'lowest_ga', label: 'Menos Vencido del Torneo', icon: '🧤👑', xp: 100, tipo: 'por', check: (j, ctx) => ctx?.menosVencido === true },
  { id: 'goalie_five_wins', label: '5 Victorias', icon: '🧤🏅', xp: 60, tipo: 'por', check: (j, ctx) => (ctx?.wins || 0) >= 5 },
  { id: 'goalie_ten_wins', label: '10 Victorias', icon: '🧤🏅🏅', xp: 120, tipo: 'por', check: (j, ctx) => (ctx?.wins || 0) >= 10 },
  { id: 'goalie_prolific', label: 'Prolifico (VI + V >= 15)', icon: '🧤💪', xp: 80, tipo: 'por', check: (j, ctx) => (j.vallas_invictas || 0) + (ctx?.wins || 0) >= 15 },
  { id: 'goalie_super_prolific', label: 'Super Prolifico (VI + V >= 30)', icon: '🧤💪💪', xp: 180, tipo: 'por', check: (j, ctx) => (j.vallas_invictas || 0) + (ctx?.wins || 0) >= 30 },
  { id: 'goalie_mvp_plus', label: 'Portero MVP+ (MVPs >= 5)', icon: '🧤🏆🏆', xp: 100, tipo: 'por', check: (j, ctx) => (j.mvps || 0) >= 5 },
  { id: 'goalie_iron_5', label: '5 Partidos sin Recibir Gol', icon: '🧤0️⃣', xp: 60, tipo: 'por', check: (j, ctx) => (ctx?.gcTotal || 0) === 0 && (j.pj || 0) >= 5 },
]

function misionesParaPosicion(posicion) {
  if (posicion === 'POR') return MISIONES.filter(m => m.tipo === 'general' || m.tipo === 'por')
  return MISIONES.filter(m => m.tipo === 'general' || m.tipo === 'field')
}

async function computeExtraStats(jugador) {
  if (!torneo.torneoActual || !jugador) return {}
  try {
    const [resultados, fixture] = await Promise.all([
      db.getResultados(torneo.torneoActual),
      db.getFixture(torneo.torneoActual)
    ])
    const resIds = resultados.length > 0 ? resultados.map(r => r.id) : [0]
    const [golesResp, tarjetasResp] = await Promise.all([
      supabase.from('goles').select('*').in('resultado_id', resIds),
      supabase.from('tarjetas').select('*').in('resultado_id', resIds)
    ])
    const allGoles = golesResp?.data || []
    const allTarjetas = tarjetasResp?.data || []
    const equipoIds = jugador.equipos || []

    let hattricks = 0; let dobletes = 0; let pokers = 0
    let rachaSinTarjeta3 = false; let vallaInvictaDebut = false; let vallasConsecutivas3 = false
    let maxCleanStreak = 0; let rachaSinTarjetaMax = 0; let debutGoal = false
    let matchesConGol = new Set(); let goldenMatch = 0; let braceMVP = 0; let hattrickMVP = 0; let pokerMVP = 0
    let gcTotal = 0; let cleanMVP = 0

    const matchCards = {}
    for (const t of allTarjetas.filter(t => t.jugador_id === jugador.id)) {
      if (!matchCards[t.resultado_id]) matchCards[t.resultado_id] = { ama: 0, roj: 0 }
      if (t.tipo === 'R') matchCards[t.resultado_id].roj++
      else matchCards[t.resultado_id].ama++
    }
    const matchGoles = {}
    for (const g of allGoles.filter(g => g.jugador_id === jugador.id)) {
      matchGoles[g.resultado_id] = (matchGoles[g.resultado_id] || 0) + 1
    }

    const matchEntries = []
    for (const r of resultados) {
      const golesEnMatch = matchGoles[r.id] || 0
      const cards = matchCards[r.id] || { ama: 0, roj: 0 }
      const jugEsLocal = equipoIds.includes(r.equipo_local_id)
      const jugEsVisit = equipoIds.includes(r.equipo_visitante_id)
      if (!jugEsLocal && !jugEsVisit && golesEnMatch === 0 && cards.ama === 0 && cards.roj === 0) continue

      matchEntries.push({
        resultado_id: r.id, goles: golesEnMatch, tarjetas: cards,
        golesRecibidos: jugEsLocal ? r.goles_visitante : jugEsVisit ? r.goles_local : null,
        esLocal: jugEsLocal, esVisit: jugEsVisit,
        ganaron: jugEsLocal ? r.goles_local > r.goles_visitante : jugEsVisit ? r.goles_visitante > r.goles_local : false,
      })

      if (golesEnMatch >= 4) pokers++
      else if (golesEnMatch >= 3) hattricks++
      else if (golesEnMatch >= 2) dobletes++
      if (jugEsLocal || jugEsVisit) {
        const gRecibidos = jugEsLocal ? r.goles_visitante : r.goles_local
        gcTotal += gRecibidos
      }
      if (golesEnMatch > 0) matchesConGol.add(r.id)
      if (golesEnMatch >= 1 && r.mvp_id === jugador.id) goldenMatch++
      if (golesEnMatch >= 2 && r.mvp_id === jugador.id) braceMVP++
      if (golesEnMatch >= 3 && r.mvp_id === jugador.id) hattrickMVP++
      if (golesEnMatch >= 4 && r.mvp_id === jugador.id) pokerMVP++
      if (golesEnMatch === 0 && (jugEsLocal || jugEsVisit) && (jugEsLocal ? r.goles_visitante : r.goles_local) === 0 && r.mvp_id === jugador.id) cleanMVP++
    }

    let rachaClean = 0
    for (const m of matchEntries) {
      if (m.golesRecibidos === 0) { rachaClean++; if (rachaClean >= 3) vallasConsecutivas3 = true; maxCleanStreak = Math.max(maxCleanStreak, rachaClean) }
      else rachaClean = 0
    }
    if (matchEntries.length > 0 && matchEntries[0].golesRecibidos === 0) vallaInvictaDebut = true
    if (matchEntries.length > 0 && matchEntries[0].goles > 0) debutGoal = true

    let rachaSinCard = 0
    for (const m of matchEntries) {
      if (m.tarjetas.ama === 0 && m.tarjetas.roj === 0) { rachaSinCard++; if (rachaSinCard >= 3) rachaSinTarjeta3 = true; rachaSinTarjetaMax = Math.max(rachaSinTarjetaMax, rachaSinCard) }
      else rachaSinCard = 0
    }

    return {
      vallas_invictas: 0, hattricks: Math.max(0, hattricks - pokers), dobletes: Math.max(0, dobletes - hattricks - pokers), pokers,
      rachaSinTarjeta3, vallaInvictaDebut, vallasConsecutivas3, maxCleanStreak, rachaSinTarjetaMax, debutGoal,
      matches_con_gol: matchesConGol.size, goldenMatch, braceMVP, hattrickMVP, pokerMVP, gcTotal, cleanMVP,
      matchEntries, wins: 0, winGoals: 0, cleanWins: 0
    }
  } catch { return {} }
}

async function computePlayerContext(jugador, extra) {
  const ctx = { esCampeon: false, esGoleador: false, menosVencido: false, wins: 0, winGoals: 0, cleanWins: 0 }
  if (!torneo.torneoActual) return ctx
  try {
    const [equipos, jugadores] = await Promise.all([db.getEquipos(torneo.torneoActual), db.getJugadores(torneo.torneoActual)])
    const matchEntries = extra?.matchEntries || []
    const equipoIds = jugador.equipos || []
    if (equipos.length > 0 && equipoIds.length > 0) {
      const maxPts = Math.max(...equipos.filter(e => e.pj > 0).map(e => e.pts || 0), 0)
      const championTeams = equipos.filter(e => (e.pts || 0) === maxPts && e.pj > 0)
      ctx.esCampeon = championTeams.some(ct => equipoIds.includes(ct.id))
    }
    if (jugadores.length > 0) {
      const maxGoles = Math.max(...jugadores.map(j => j.goles || 0))
      ctx.esGoleador = maxGoles > 0 && (jugador.goles || 0) === maxGoles
    }
    if (jugador.posicion === 'POR') {
      const porJugadores = jugadores.filter(j => j.posicion === 'POR' && j.pj > 0)
      if (porJugadores.length > 0) {
        const ratios = porJugadores.map(j => ({ id: j.id, ratio: (extra?.gcTotal || 0) / j.pj }))
        const minRatio = Math.min(...ratios.map(x => x.ratio))
        ctx.menosVencido = ratios.find(x => x.id === jugador.id)?.ratio === minRatio
      }
    }
    for (const m of matchEntries) {
      if (m.ganaron) { ctx.wins++; if (m.goles > 0) ctx.winGoals++; if (m.golesRecibidos === 0) ctx.cleanWins++ }
    }
    return ctx
  } catch { return ctx }
}

const selectedPlayer = computed(() => {
  if (!selectedPlayerId.value) return null
  return jugadores.value.find(j => j.id === parseInt(selectedPlayerId.value))
})

const missions = computed(() => {
  const j = playerData.value?.jugador
  const ctx = { ...playerData.value?.ctx, ...playerData.value?.extra }
  if (!j) return []
  const lista = misionesParaPosicion(j.posicion)
  return lista.map(m => ({ ...m, completada: m.check(j, ctx), earned: m.check(j, ctx) ? m.xp : 0 }))
})

const completedMissions = computed(() => missions.value.filter(m => m.completada))
const totalMissionXP = computed(() => missions.value.reduce((s, m) => s + (m.earned || 0), 0))

watch(selectedPlayerId, async (id) => {
  if (!id) { playerData.value = null; return }
  const j = jugadores.value.find(p => p.id === parseInt(id))
  if (!j) return
  const extra = await computeExtraStats(j)
  const ctx = await computePlayerContext(j, extra)
  const enriched = { ...j, ...extra }
  playerData.value = { jugador: enriched, ctx }
})

async function loadData() {
  if (!torneo.torneoActual) return
  loading.value = true
  playerData.value = null
  try {
    jugadores.value = await db.getJugadores(torneo.torneoActual)
  } finally { loading.value = false }
}

watch(() => torneo.torneoActual, async () => { if (torneo.torneoActual) try { await loadData() } catch (e) { if (import.meta.env.DEV) console.error(e) } })
onMounted(async () => { if (torneo.torneoActual) try { await loadData() } catch (e) { if (import.meta.env.DEV) console.error(e) } })
</script>

<template>
  <section>
    <div v-if="loading" class="box spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
    <div v-else>
      <div class="box">
        <h3>🎯 Misiones</h3>
        <label class="label-accent">Seleccionar Jugador:</label>
        <select v-model="selectedPlayerId" style="padding:10px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
          <option :value="null">Seleccionar...</option>
          <option v-for="j in jugadores" :key="j.id" :value="j.id">{{ j.nombre }} {{ j.posicion === 'POR' ? '🧤' : '⚽' }}</option>
        </select>
      </div>

      <div v-if="!selectedPlayer" class="box" style="text-align:center; color:var(--text-muted); padding:30px;">Seleccioná un jugador para ver sus misiones</div>

      <template v-else-if="playerData">
        <div class="box">
          <div style="text-align:center;">
            <div style="display:flex; justify-content:center; align-items:center; gap:15px; margin-bottom:10px;">
              <span style="font-size:2.5rem; font-weight:bold;" :style="{ color: getNivelColor(calcularNivel(calcularXP(playerData.jugador))) }">
                {{ calcularNivel(calcularXP(playerData.jugador)) }}
              </span>
              <div>
                <h4 style="color:#eab308; margin:0;">{{ playerData.jugador.nombre }}</h4>
                <span
                  style="color:black; padding:2px 12px; border-radius:12px; font-weight:bold; font-size:0.75rem;"
                  :style="{ background: getNivelColor(calcularNivel(calcularXP(playerData.jugador))) }"
                >{{ getNivelLabel(calcularNivel(calcularXP(playerData.jugador))) }}</span>
                <div style="display:flex;gap:4px;margin-top:4px;justify-content:center;">
                  <span v-if="playerData.ctx?.esCampeon" style="background:#eab308;color:black;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:bold;">👑 CAMPEÓN</span>
                  <span v-if="playerData.ctx?.esGoleador" style="background:#22c55e;color:black;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:bold;">⚽ GOLEADOR</span>
                  <span v-if="playerData.ctx?.menosVencido" style="background:#3b82f6;color:white;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:bold;">🧤 MENOS VENCIDO</span>
                </div>
              </div>
              <span style="font-size:2rem; font-weight:bold; color:#eab308;">{{ calcularRating(playerData.jugador) }}</span>
            </div>
            <div style="background:#21262d; border-radius:10px; height:20px; overflow:hidden; margin-top:10px;">
              <div style="height:100%; border-radius:10px; transition:width 0.5s;"
                :style="{ width: Math.min(100, ((calcularXP(playerData.jugador) - xpParaSiguienteNivel(calcularNivel(calcularXP(playerData.jugador)) - 1)) / (xpParaSiguienteNivel(calcularNivel(calcularXP(playerData.jugador))) - xpParaSiguienteNivel(calcularNivel(calcularXP(playerData.jugador)) - 1))) * 100) + '%',
                background: 'linear-gradient(90deg, ' + getNivelColor(calcularNivel(calcularXP(playerData.jugador))) + ', #eab308)' }"
              ></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
              <span>{{ calcularXP(playerData.jugador) }} XP</span>
              <span>Sig. nivel: {{ xpParaSiguienteNivel(calcularNivel(calcularXP(playerData.jugador))) }} XP</span>
            </div>
          </div>
        </div>

        <div class="box">
          <h4 style="color:#eab308; margin:0 0 10px 0;">
            🎯 Misiones ({{ completedMissions.length }}/{{ missions.length }})
            <span style="font-size:0.8rem; color:var(--text-muted); margin-left:10px;">+{{ totalMissionXP }} XP de misiones</span>
          </h4>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:8px;">
            <div v-for="m in missions" :key="m.id"
              style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:8px; font-size:0.85rem;"
              :style="{ background: m.completada ? '#22c55e22' : '#21262d', opacity: m.completada ? 1 : 0.5 }"
>
              <span style="font-size:1.2rem;">{{ m.icon }}</span>
              <span style="flex:1;" :style="{ color: m.completada ? '#22c55e' : 'var(--text-muted)' }">{{ m.label }}</span>
              <span style="font-size:0.75rem; font-weight:bold;" :style="{ color: m.completada ? '#22c55e' : 'var(--text-muted)' }">
                {{ m.completada ? `+${m.xp}XP` : '—' }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <div v-else-if="selectedPlayer" class="box" style="text-align:center; color:var(--text-muted); padding:30px;">Calculando misiones...</div>
    </div>
  </section>
</template>
