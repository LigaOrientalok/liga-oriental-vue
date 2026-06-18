-- Votacion MVP popular
CREATE TABLE IF NOT EXISTS mvp_votos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resultado_id bigint NOT NULL REFERENCES resultados(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jugador_id bigint NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(resultado_id, user_id)
);
ALTER TABLE mvp_votos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votos visibles para todos" ON mvp_votos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios votan una vez" ON mvp_votos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
