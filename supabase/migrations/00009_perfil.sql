-- =============================================
-- Agregar nombre visible a usuarios
-- =============================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre text;
