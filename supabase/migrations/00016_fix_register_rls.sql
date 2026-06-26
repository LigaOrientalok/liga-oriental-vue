-- Fix: permitir que usuarios se inserten a si mismos en la tabla usuarios
CREATE POLICY "usuarios_insert_self" ON usuarios FOR INSERT WITH CHECK (auth.uid() = id);

-- Fix: idem para update, asi el usuario puede actualizar su propio perfil
CREATE POLICY "usuarios_update_self" ON usuarios FOR UPDATE USING (auth.uid() = id);

-- Fix: auto-aprobar usuarios nuevos en vez de dejarlos como 'pendiente'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, rol, estado, fecha_registro)
  VALUES (NEW.id, NEW.email, 'usuario', 'aprobado', now());
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;
