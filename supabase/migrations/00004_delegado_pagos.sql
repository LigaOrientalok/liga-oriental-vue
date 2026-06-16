-- =============================================
-- Delegado rol + Pagos (Mercado Pago)
-- =============================================

-- Agregar columna equipo_id a usuarios para vincular delegados
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS equipo_id bigint REFERENCES equipos(id) ON DELETE SET NULL;

-- 11. Pagos
CREATE TABLE IF NOT EXISTS pagos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  torneo_id bigint REFERENCES torneos(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  equipo_id bigint REFERENCES equipos(id) ON DELETE SET NULL,
  concepto text NOT NULL,
  monto numeric(10,2) NOT NULL,
  moneda text DEFAULT 'ARS',
  estado text DEFAULT 'pendiente',
  metodo_pago text,
  mp_preference_id text,
  mp_payment_id text,
  mp_status text,
  fecha_creacion timestamptz DEFAULT now(),
  fecha_pago timestamptz
);

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pagos visibles para admins y propio usuario"
  ON pagos FOR SELECT
  TO authenticated
  USING (
    auth.uid() = usuario_id OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin') OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'delegado' AND equipo_id = pagos.equipo_id)
  );

CREATE POLICY "Admins pueden insertar pagos"
  ON pagos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Admins pueden actualizar pagos"
  ON pagos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Admins pueden eliminar pagos"
  ON pagos FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- Función para verificar si es delegado del equipo
CREATE OR REPLACE FUNCTION public.is_delegado_of(equipo_id_param bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol = 'delegado' AND equipo_id = equipo_id_param
  );
$$;

-- Políticas para que delegados vean datos de su equipo
-- Fixture: delegado ve todos (solo lectura), como los usuarios normales
-- Las políticas existentes ya permiten SELECT para authenticated
-- Solo necesitamos asegurar que delegados puedan ver su equipo en fixture/resultados

-- Actualizar política de usuarios para que delegados puedan ver su equipo
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON usuarios;
CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON usuarios FOR SELECT
  USING (
    auth.uid() = id OR
    (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')) OR
    (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'delegado'))
  );
