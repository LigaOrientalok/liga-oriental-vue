export const XP_PER_LEVEL = 80

export function calcularXP(j) {
  let xp = 0
  xp += (j.goles || 0) * 10
  xp += (j.pj || 0) * 5
  xp += (j.mvps || 0) * 25
  xp += (j.vallas_invictas || 0) * 15
  xp += (j.hattricks || 0) * 40
  xp += (j.dobletes || 0) * 20
  xp += (j.pokers || 0) * 80
  xp += (j.matches_con_gol || 0) * 5
  xp += (j.wins || 0) * 8
  xp += (j.clean_wins || 0) * 10
  xp += (j.brace_mvp || 0) * 30
  xp += (j.hattrick_mvp || 0) * 50
  xp += (j.poker_mvp || 0) * 100
  return xp
}

export function calcularNivel(xp) {
  return Math.floor(Math.sqrt(xp / XP_PER_LEVEL)) + 1
}

export function xpParaSiguienteNivel(nivel) {
  return XP_PER_LEVEL * (nivel * nivel)
}

export function getNivelColor(nivel) {
  if (nivel >= 12) return '#8b5cf6'
  if (nivel >= 9) return '#eab308'
  if (nivel >= 6) return '#94a3b8'
  if (nivel >= 3) return '#cd7f32'
  return '#8b949e'
}

export function getNivelLabel(nivel) {
  if (nivel >= 12) return 'LEYENDA'
  if (nivel >= 9) return 'ORO'
  if (nivel >= 6) return 'PLATA'
  if (nivel >= 3) return 'BRONCE'
  return 'PRINCIPIANTE'
}

export function calcularRating(j) {
  if (!j) return 0
  let media = 60 + ((j.goles || 0) * 0.5) + ((j.pj || 0) * 0.2) + ((j.mvps || 0) * 2.0)
  media -= ((j.amarillas || 0) * 0.5) + ((j.rojas || 0) * 2.0)
  media += calcularNivel(calcularXP(j)) * 0.5
  return Math.min(99, Math.max(10, Math.round(media)))
}
