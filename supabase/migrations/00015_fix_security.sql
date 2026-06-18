-- Fix: crear funcion get_user_role() que faltaba para las politicas RLS
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT rol FROM usuarios WHERE id = auth.uid()), 'usuario');
$$;

-- Fix: restringir INSERT en actividad al propio usuario
DROP POLICY IF EXISTS "Sistema inserta actividad" ON actividad;
CREATE POLICY "Sistema inserta actividad" ON actividad FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

-- Fix: Storage RLS para bucket liga-media
CREATE POLICY "Upload liga-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'liga-media');
CREATE POLICY "Select liga-media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'liga-media');
CREATE POLICY "Delete liga-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'liga-media' AND public.get_user_role() = 'admin');

-- Fix: chat_mensajes verifica membresia del equipo
DROP POLICY IF EXISTS "Usuarios envian mensajes" ON chat_mensajes;
CREATE POLICY "Usuarios envian mensajes" ON chat_mensajes FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND (
    public.get_user_role() = 'admin' OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND equipo_id = chat_mensajes.equipo_id)
  )
);
