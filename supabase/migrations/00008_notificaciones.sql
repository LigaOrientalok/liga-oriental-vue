-- =============================================
-- Notificaciones in-app
-- =============================================

CREATE TABLE IF NOT EXISTS notificaciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('like', 'comment', 'mention')),
  mensaje text NOT NULL,
  media_id bigint REFERENCES liga_media(id) ON DELETE CASCADE,
  leida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus notificaciones"
  ON notificaciones FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuarios marcan como leidas"
  ON notificaciones FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger: notificar al dueño de la media cuando alguien da like
CREATE OR REPLACE FUNCTION notify_media_owner()
RETURNS TRIGGER AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT uploaded_by INTO owner_id FROM liga_media WHERE id = NEW.media_id;
  IF owner_id IS NOT NULL AND owner_id != auth.uid() THEN
    INSERT INTO notificaciones (user_id, tipo, mensaje, media_id)
    VALUES (
      owner_id,
      CASE WHEN TG_TABLE_NAME = 'liga_media_likes' THEN 'like' ELSE 'comment' END,
      CASE WHEN TG_TABLE_NAME = 'liga_media_likes' THEN 'A alguien le gustó tu publicación'
           ELSE 'Alguien comentó tu publicación'
      END,
      NEW.media_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_notify ON liga_media_likes;
CREATE TRIGGER on_like_notify
  AFTER INSERT ON liga_media_likes
  FOR EACH ROW EXECUTE FUNCTION notify_media_owner();

DROP TRIGGER IF EXISTS on_comment_notify ON liga_media_comments;
CREATE TRIGGER on_comment_notify
  AFTER INSERT ON liga_media_comments
  FOR EACH ROW EXECUTE FUNCTION notify_media_owner();
