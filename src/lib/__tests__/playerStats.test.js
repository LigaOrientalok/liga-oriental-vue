import { describe, it, expect } from 'vitest'
import {
  XP_PER_LEVEL,
  calcularXP,
  calcularNivel,
  xpParaSiguienteNivel,
  getNivelColor,
  getNivelLabel,
  calcularRating,
} from '../playerStats'

describe('calcularXP', () => {
  it('returns 0 for empty object', () => {
    expect(calcularXP({})).toBe(0)
  })

  it('calculates XP from all fields', () => {
    const j = {
      goles: 2,
      pj: 3,
      mvps: 1,
      vallas_invictas: 1,
      hattricks: 0,
      dobletes: 1,
      pokers: 0,
      matches_con_gol: 2,
      wins: 1,
      clean_wins: 0,
      brace_mvp: 0,
      hattrick_mvp: 0,
      poker_mvp: 0,
    }
    const expected = 2 * 10 + 3 * 5 + 1 * 25 + 1 * 15 + 0 * 40 + 1 * 20 + 0 * 80 + 2 * 5 + 1 * 8 + 0 * 10 + 0 * 30 + 0 * 50 + 0 * 100
    expect(calcularXP(j)).toBe(expected)
  })

  it('handles partial fields', () => {
    expect(calcularXP({ goles: 5 })).toBe(50)
    expect(calcularXP({ mvps: 2, wins: 3 })).toBe(2 * 25 + 3 * 8)
  })
})

describe('calcularNivel', () => {
  it('returns 1 for 0 XP', () => {
    expect(calcularNivel(0)).toBe(1)
  })

  it('calculates level based on XP', () => {
    expect(calcularNivel(80)).toBe(2)
    expect(calcularNivel(320)).toBe(3)
    expect(calcularNivel(720)).toBe(4)
  })

  it('floors fractional levels', () => {
    expect(calcularNivel(100)).toBe(2)
    expect(calcularNivel(319)).toBe(2)
  })
})

describe('xpParaSiguienteNivel', () => {
  it('returns XP needed for next level', () => {
    expect(xpParaSiguienteNivel(1)).toBe(80)
    expect(xpParaSiguienteNivel(2)).toBe(320)
    expect(xpParaSiguienteNivel(3)).toBe(720)
  })
})

describe('getNivelColor', () => {
  it('returns PRINCIPIANTE color for nivel < 3', () => {
    expect(getNivelColor(1)).toBe('#8b949e')
    expect(getNivelColor(2)).toBe('#8b949e')
  })

  it('returns BRONCE color for nivel 3-5', () => {
    expect(getNivelColor(3)).toBe('#cd7f32')
    expect(getNivelColor(5)).toBe('#cd7f32')
  })

  it('returns PLATA color for nivel 6-8', () => {
    expect(getNivelColor(6)).toBe('#94a3b8')
    expect(getNivelColor(8)).toBe('#94a3b8')
  })

  it('returns ORO color for nivel 9-11', () => {
    expect(getNivelColor(9)).toBe('#eab308')
    expect(getNivelColor(11)).toBe('#eab308')
  })

  it('returns LEYENDA color for nivel >= 12', () => {
    expect(getNivelColor(12)).toBe('#8b5cf6')
    expect(getNivelColor(15)).toBe('#8b5cf6')
  })
})

describe('getNivelLabel', () => {
  it('returns PRINCIPIANTE for nivel < 3', () => {
    expect(getNivelLabel(1)).toBe('PRINCIPIANTE')
    expect(getNivelLabel(2)).toBe('PRINCIPIANTE')
  })

  it('returns BRONCE for nivel 3-5', () => {
    expect(getNivelLabel(3)).toBe('BRONCE')
    expect(getNivelLabel(5)).toBe('BRONCE')
  })

  it('returns PLATA for nivel 6-8', () => {
    expect(getNivelLabel(6)).toBe('PLATA')
    expect(getNivelLabel(8)).toBe('PLATA')
  })

  it('returns ORO for nivel 9-11', () => {
    expect(getNivelLabel(9)).toBe('ORO')
    expect(getNivelLabel(11)).toBe('ORO')
  })

  it('returns LEYENDA for nivel >= 12', () => {
    expect(getNivelLabel(12)).toBe('LEYENDA')
    expect(getNivelLabel(20)).toBe('LEYENDA')
  })
})

describe('calcularRating', () => {
  it('returns 0 for null input', () => {
    expect(calcularRating(null)).toBe(0)
    expect(calcularRating(undefined)).toBe(0)
  })

  it('returns minimum 10 for empty object', () => {
    const rating = calcularRating({})
    expect(rating).toBeGreaterThanOrEqual(10)
  })

  it('increases rating with positive stats', () => {
    const base = calcularRating({})
    const boosted = calcularRating({ goles: 5, mvps: 2 })
    expect(boosted).toBeGreaterThanOrEqual(base)
  })

  it('decreases rating with penalties', () => {
    const base = calcularRating({ goles: 5 })
    const penalized = calcularRating({ goles: 5, amarillas: 3, rojas: 1 })
    expect(penalized).toBeLessThanOrEqual(base)
  })

  it('caps at 99', () => {
    const rating = calcularRating({ goles: 100, mvps: 50, pj: 100 })
    expect(rating).toBeLessThanOrEqual(99)
  })
})
