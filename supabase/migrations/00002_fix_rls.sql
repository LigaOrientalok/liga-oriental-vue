-- Fix RLS infinite recursion by using SECURITY DEFINER functions

-- Function to check if current user is admin (no recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin');
$$;

-- Fix usuarios policies
DROP POLICY IF EXISTS "Admins pueden ver/editar todos los usuarios" ON usuarios;
DROP POLICY IF EXISTS "usuarios_delete_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin" ON usuarios;

CREATE POLICY "admin_select_usuarios" ON usuarios FOR SELECT USING (public.is_admin() OR auth.uid() = id);
CREATE POLICY "admin_insert_usuarios" ON usuarios FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_usuarios" ON usuarios FOR UPDATE USING (public.is_admin());
CREATE POLICY "admin_delete_usuarios" ON usuarios FOR DELETE USING (public.is_admin());

-- Fix all other tables with the same pattern
DO $func$
DECLARE
  tbl text;
  pol_name text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['torneos','equipos','jugadores','jugador_equipo','fixture','resultados','goles','tarjetas','sanciones'])
  LOOP
    -- Drop old admin policies
    FOR pol_name IN SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public' AND (policyname LIKE '%admin%' OR policyname LIKE '%Admin%')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_name, tbl);
    END LOOP;

    -- Drop old Spanish policies for admin
    FOR pol_name IN SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public' AND (policyname LIKE '%Solo admins%' OR policyname LIKE '%Admins%')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_name, tbl);
    END LOOP;

    -- Create single admin ALL policy
    EXECUTE format('CREATE POLICY admin_all_%I ON %I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())', tbl, tbl);

    -- Ensure select is allowed for authenticated users
    EXECUTE format('CREATE POLICY select_%I ON %I FOR SELECT TO authenticated USING (true)', tbl, tbl);
  END LOOP;
END;
$func$;
