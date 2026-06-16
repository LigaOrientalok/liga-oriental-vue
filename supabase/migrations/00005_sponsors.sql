-- =============================================
-- Sponsors (banners rotativos)
-- =============================================

CREATE TABLE IF NOT EXISTS sponsors (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'imagen' CHECK (tipo IN ('imagen', 'video')),
  contenido text NOT NULL,
  link text,
  activo boolean DEFAULT true,
  orden integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sponsors visibles para todos"
  ON sponsors FOR SELECT
  TO anon, authenticated
  USING (activo = true);

CREATE POLICY "Admins pueden gestionar sponsors"
  ON sponsors FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
