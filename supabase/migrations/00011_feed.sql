-- Feed de actividad
CREATE TABLE IF NOT EXISTS actividad (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo text NOT NULL,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mensaje text NOT NULL,
  referencia_id bigint,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE actividad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feed visible para todos" ON actividad FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sistema inserta actividad" ON actividad FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger: log goles automaticamente
CREATE OR REPLACE FUNCTION log_gol_actividad()
RETURNS TRIGGER AS $$
DECLARE
  jug_nombre text; eq_nombre text;
BEGIN
  SELECT nombre INTO jug_nombre FROM jugadores WHERE id = NEW.jugador_id;
  SELECT nombre INTO eq_nombre FROM equipos WHERE id = NEW.equipo_id;
  INSERT INTO actividad (tipo, mensaje, referencia_id)
  VALUES ('gol', format('⚽ %s metió gol para %s', jug_nombre, eq_nombre), NEW.resultado_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS log_gol_actividad_trigger ON goles;
CREATE TRIGGER log_gol_actividad_trigger AFTER INSERT ON goles FOR EACH ROW EXECUTE FUNCTION log_gol_actividad();
