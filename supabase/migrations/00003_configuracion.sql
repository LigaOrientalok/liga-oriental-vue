-- Configuracion global de la app (logo, titulo, colores)
CREATE TABLE IF NOT EXISTS configuracion (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo text DEFAULT 'Liga Oriental',
  logo_url text,
  color_primario text DEFAULT '#eab308',
  color_secundario text DEFAULT '#3b82f6',
  fondo_oscuro text DEFAULT '#0b0e14',
  fondo_claro text DEFAULT '#f0f2f5',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_configuracion" ON configuracion
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_configuracion" ON configuracion
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "update_configuracion" ON configuracion
  FOR UPDATE USING (public.is_admin());

-- Insertar fila por defecto si no existe
INSERT INTO configuracion (titulo) VALUES ('Liga Oriental')
  ON CONFLICT DO NOTHING;
