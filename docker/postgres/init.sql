-- Enable the pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension if needed for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'pgvector and uuid-ossp extensions initialized successfully.';
END $$;
