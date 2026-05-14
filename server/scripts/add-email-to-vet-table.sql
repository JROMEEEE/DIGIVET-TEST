-- Step 1: Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Adds email to vet_table so vet records can carry login credentials.

ALTER TABLE vet_table ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 2: If you also have a local PostgreSQL database (LOCAL_DATABASE_URL),
-- run the same statement there so the schema stays in sync:
--   psql $LOCAL_DATABASE_URL -c "ALTER TABLE vet_table ADD COLUMN IF NOT EXISTS email TEXT;"
--
-- After running both, trigger POST /api/sync/to-local so any existing email values
-- from Supabase are pulled into the local database.
