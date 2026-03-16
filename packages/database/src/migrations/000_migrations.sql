CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  executed_at TIMESTAMP DEFAULT NOW()
);