-- Fix: permitir que usuarios se inserten a si mismos en la tabla usuarios
-- (necesario como fallback si el trigger on_auth_user_created no existe o falla)

CREATE POLICY "usuarios_insert_self" ON usuarios FOR INSERT WITH CHECK (auth.uid() = id);

-- Fix: idem para update, asi el usuario puede actualizar su propio perfil
CREATE POLICY "usuarios_update_self" ON usuarios FOR UPDATE USING (auth.uid() = id);
