-- =============================================
-- Likes y comentarios en galería multimedia
-- =============================================

CREATE TABLE IF NOT EXISTS liga_media_likes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  media_id bigint NOT NULL REFERENCES liga_media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(media_id, user_id)
);

CREATE TABLE IF NOT EXISTS liga_media_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  media_id bigint NOT NULL REFERENCES liga_media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contenido text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE liga_media_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE liga_media_comments ENABLE ROW LEVEL SECURITY;

-- ===== LIKES =====
CREATE POLICY "Likes visibles para todos"
  ON liga_media_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios pueden dar/quitar like"
  ON liga_media_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Creador o admin pueden borrar like"
  ON liga_media_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.get_user_role() = 'admin');

-- ===== COMENTARIOS =====
CREATE POLICY "Comentarios visibles para todos"
  ON liga_media_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios pueden comentar"
  ON liga_media_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Creador o admin pueden borrar comentario"
  ON liga_media_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.get_user_role() = 'admin');
