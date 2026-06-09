-- =============================================
-- LIGA ORIENTAL - Esquema de Base de Datos
-- =============================================

-- 1. Tabla de usuarios (vinculada a Auth)
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  rol text DEFAULT 'usuario',
  estado text DEFAULT 'pendiente',
  fecha_registro timestamptz DEFAULT now()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON usuarios FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins pueden ver/editar todos los usuarios"
  ON usuarios FOR ALL
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- Trigger: crear fila en usuarios al registrarse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, rol, estado)
  VALUES (
    NEW.id,
    NEW.email,
    'usuario',
    'pendiente'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Torneos
CREATE TABLE IF NOT EXISTS torneos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE torneos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Torneos visibles para usuarios autenticados"
  ON torneos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar torneos"
  ON torneos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden actualizar torneos"
  ON torneos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden eliminar torneos"
  ON torneos FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 3. Equipos
CREATE TABLE IF NOT EXISTS equipos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  torneo_id bigint REFERENCES torneos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  dia_semana text,
  logo text,
  pts integer DEFAULT 0,
  pj integer DEFAULT 0,
  v integer DEFAULT 0,
  e integer DEFAULT 0,
  p integer DEFAULT 0,
  gf integer DEFAULT 0,
  gc integer DEFAULT 0,
  vallas_invictas integer DEFAULT 0
);

ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipos visibles para autenticados"
  ON equipos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar equipos"
  ON equipos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden actualizar equipos"
  ON equipos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden eliminar equipos"
  ON equipos FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 4. Jugadores
CREATE TABLE IF NOT EXISTS jugadores (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  torneo_id bigint REFERENCES torneos(id) ON DELETE CASCADE,
  ci text,
  nombre text NOT NULL,
  posicion text,
  pierna text,
  foto text,
  goles integer DEFAULT 0,
  pj integer DEFAULT 0,
  mvps integer DEFAULT 0,
  amarillas integer DEFAULT 0,
  rojas integer DEFAULT 0,
  vallas_invictas integer DEFAULT 0,
  hattricks integer DEFAULT 0,
  dobletes integer DEFAULT 0,
  pokers integer DEFAULT 0,
  matches_con_gol integer DEFAULT 0,
  wins integer DEFAULT 0,
  clean_wins integer DEFAULT 0,
  brace_mvp integer DEFAULT 0,
  hattrick_mvp integer DEFAULT 0,
  poker_mvp integer DEFAULT 0
);

ALTER TABLE jugadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jugadores visibles para autenticados"
  ON jugadores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar jugadores"
  ON jugadores FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden actualizar jugadores"
  ON jugadores FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden eliminar jugadores"
  ON jugadores FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 5. Relación jugador-equipo
CREATE TABLE IF NOT EXISTS jugador_equipo (
  jugador_id bigint REFERENCES jugadores(id) ON DELETE CASCADE,
  equipo_id bigint REFERENCES equipos(id) ON DELETE CASCADE,
  PRIMARY KEY (jugador_id, equipo_id)
);

ALTER TABLE jugador_equipo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vinculos visibles para autenticados"
  ON jugador_equipo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar vinculos"
  ON jugador_equipo FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden eliminar vinculos"
  ON jugador_equipo FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 6. Fixture
CREATE TABLE IF NOT EXISTS fixture (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  torneo_id bigint REFERENCES torneos(id) ON DELETE CASCADE,
  dia_semana text,
  fecha text,
  hora text,
  equipo_local_id bigint REFERENCES equipos(id) ON DELETE CASCADE,
  equipo_visitante_id bigint REFERENCES equipos(id) ON DELETE CASCADE
);

ALTER TABLE fixture ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fixture visible para autenticados"
  ON fixture FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar fixture"
  ON fixture FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden eliminar fixture"
  ON fixture FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 7. Resultados
CREATE TABLE IF NOT EXISTS resultados (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  torneo_id bigint REFERENCES torneos(id) ON DELETE CASCADE,
  fixture_id bigint REFERENCES fixture(id) ON DELETE SET NULL,
  equipo_local_id bigint REFERENCES equipos(id) ON DELETE CASCADE,
  equipo_visitante_id bigint REFERENCES equipos(id) ON DELETE CASCADE,
  goles_local integer DEFAULT 0,
  goles_visitante integer DEFAULT 0,
  mvp_id bigint REFERENCES jugadores(id) ON DELETE SET NULL,
  estado text DEFAULT 'pendiente'
);

ALTER TABLE resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resultados visibles para autenticados"
  ON resultados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar resultados"
  ON resultados FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden actualizar resultados"
  ON resultados FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden eliminar resultados"
  ON resultados FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 8. Goles
CREATE TABLE IF NOT EXISTS goles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resultado_id bigint REFERENCES resultados(id) ON DELETE CASCADE,
  jugador_id bigint REFERENCES jugadores(id) ON DELETE CASCADE,
  equipo_id bigint REFERENCES equipos(id) ON DELETE CASCADE,
  minuto integer
);

ALTER TABLE goles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goles visibles para autenticados"
  ON goles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar goles"
  ON goles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden eliminar goles"
  ON goles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 9. Tarjetas
CREATE TABLE IF NOT EXISTS tarjetas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resultado_id bigint REFERENCES resultados(id) ON DELETE CASCADE,
  jugador_id bigint REFERENCES jugadores(id) ON DELETE CASCADE,
  equipo_id bigint REFERENCES equipos(id) ON DELETE CASCADE,
  tipo text,
  minuto integer
);

ALTER TABLE tarjetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tarjetas visibles para autenticados"
  ON tarjetas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar tarjetas"
  ON tarjetas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden eliminar tarjetas"
  ON tarjetas FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 10. Sanciones
CREATE TABLE IF NOT EXISTS sanciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  torneo_id bigint REFERENCES torneos(id) ON DELETE CASCADE,
  jugador_id bigint REFERENCES jugadores(id) ON DELETE CASCADE,
  motivo text,
  tipo text,
  fecha_inicio text,
  fecha_fin text,
  activa boolean DEFAULT true
);

ALTER TABLE sanciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sanciones visibles para autenticados"
  ON sanciones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar sanciones"
  ON sanciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden actualizar sanciones"
  ON sanciones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo admins pueden eliminar sanciones"
  ON sanciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );
