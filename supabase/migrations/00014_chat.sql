-- Chat de equipo
CREATE TABLE IF NOT EXISTS chat_mensajes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  equipo_id bigint NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mensaje text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE chat_mensajes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mensajes visibles" ON chat_mensajes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios envian mensajes" ON chat_mensajes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Habilitar realtime para chat
ALTER PUBLICATION supabase_realtime ADD TABLE chat_mensajes;
