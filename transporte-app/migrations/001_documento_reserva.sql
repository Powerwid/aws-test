-- Ejecutar una sola vez sobre la base existente `aws-test`.
-- Conserva las reservas y el resto de los datos actuales.
ALTER TABLE reservas
  ADD COLUMN documento_s3_key VARCHAR(500) NULL AFTER estado;
