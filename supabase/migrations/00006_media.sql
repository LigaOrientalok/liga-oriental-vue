-- =============================================
-- Media de la Liga (imágenes y videos)
-- =============================================

CREATE TABLE IF NOT EXISTS liga_media (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo text NOT NULL,
  descripcion text,
  tipo text NOT NULL DEFAULT 'imagen' CHECK (tipo IN ('imagen', 'video')),
  contenido text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE liga_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Media visible para usuarios autenticados"
  ON liga_media FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins pueden gestionar media"
  ON liga_media FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'delegado'));

CREATE POLICY "Admins pueden modificar cualquier media"
  ON liga_media FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admins o creador pueden eliminar media"
  ON liga_media FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin' OR auth.uid() = uploaded_by);
