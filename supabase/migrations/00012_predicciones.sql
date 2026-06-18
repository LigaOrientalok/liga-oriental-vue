-- Predicciones de resultados
CREATE TABLE IF NOT EXISTS predicciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fixture_id bigint NOT NULL REFERENCES fixture(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goles_local integer NOT NULL,
  goles_visitante integer NOT NULL,
  puntos integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(fixture_id, user_id)
);
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Predicciones visibles para todos" ON predicciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios crean sus predicciones" ON predicciones FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuarios editan sus predicciones" ON predicciones FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Funcion para calcular puntos al finalizar un resultado
CREATE OR REPLACE FUNCTION calcular_puntos_predicciones()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'finalizado' THEN
    UPDATE predicciones SET puntos =
      CASE
        WHEN goles_local = NEW.goles_local AND goles_visitante = NEW.goles_visitante THEN 5
        WHEN (goles_local - goles_visitante) = (NEW.goles_local - NEW.goles_visitante) THEN 3
        WHEN (goles_local > goles_visitante AND NEW.goles_local > NEW.goles_visitante) OR
             (goles_local < goles_visitante AND NEW.goles_local < NEW.goles_visitante) OR
             (goles_local = goles_visitante AND NEW.goles_local = NEW.goles_visitante) THEN 1
        ELSE 0
      END
    WHERE fixture_id = NEW.fixture_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS calcular_puntos_predicciones_trigger ON resultados;
CREATE TRIGGER calcular_puntos_predicciones_trigger AFTER UPDATE OF estado ON resultados FOR EACH ROW EXECUTE FUNCTION calcular_puntos_predicciones();
