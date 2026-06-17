-- =============================================
-- Alineaciones por partido
-- =============================================

CREATE TABLE IF NOT EXISTS alineaciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fixture_id bigint NOT NULL REFERENCES fixture(id) ON DELETE CASCADE,
  equipo_id bigint NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  jugador_id bigint NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
  titular boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(fixture_id, equipo_id, jugador_id)
);

ALTER TABLE alineaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alineaciones visibles para todos"
  ON alineaciones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Delegado/admin gestionan alineaciones"
  ON alineaciones FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'delegado'));

CREATE POLICY "Delegado/admin modifican alineaciones"
  ON alineaciones FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'delegado'))
  WITH CHECK (public.get_user_role() IN ('admin', 'delegado'));

CREATE POLICY "Delegado/admin borran alineaciones"
  ON alineaciones FOR DELETE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'delegado'));
