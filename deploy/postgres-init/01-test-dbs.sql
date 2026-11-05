-- Bases de datos para la suite de tests (Fase 8.1).
--
-- Este archivo se monta en /docker-entrypoint-initdb.d y se ejecuta SOLO la
-- primera vez que se inicializa el volumen de Postgres. Para un volumen que ya
-- existe, aplicar con: ./scripts/dev-db-init.sh
--
-- \gexec ejecuta el CREATE DATABASE unicamente si la base no existe. No se
-- puede usar un DO block porque CREATE DATABASE no corre dentro de una
-- transaccion.

SELECT 'CREATE DATABASE nca_unjbg_test OWNER unjbg'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nca_unjbg_test')\gexec

SELECT 'CREATE DATABASE nca_unjbg_e2e OWNER unjbg'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nca_unjbg_e2e')\gexec
