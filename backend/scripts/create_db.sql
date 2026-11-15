-- Creates the backend's database role and its two databases (development + tests).
-- Run once as the PostgreSQL superuser, through scripts/create_db.ps1 (it passes the password from .env).
-- Safe to run again: existing objects are left alone.

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'db_user')\gexec

SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8''', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db_name')\gexec

SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8''', :'test_db_name', :'db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'test_db_name')\gexec
