-- Run these SQL statements in your Supabase SQL Editor
-- If the tables already exist, run this first to extend the connection handshake statuses:
-- ALTER TABLE connection_requests DROP CONSTRAINT IF EXISTS connection_requests_status_check;
-- ALTER TABLE connection_requests
--   ADD CONSTRAINT connection_requests_status_check
--   CHECK (status IN ('pending', 'accepted', 'rejected', 'hello', 'ack', 'ready', 'connected', 'failed'));

-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL,
  device_name text,
  created_at timestamptz DEFAULT now()
);

-- Connection requests table
CREATE TABLE connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_device_id text REFERENCES users(device_id),
  receiver_device_id text REFERENCES users(device_id),
  status text CHECK (status IN ('pending', 'accepted', 'rejected', 'hello', 'ack', 'ready', 'connected', 'failed')),
  created_at timestamptz DEFAULT now()
);

-- Messages table
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_device_id text,
  receiver_device_id text,
  content text,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Note: Depending on authentication methodology, you might want to adjust these policies.
-- Since the app is peer-to-peer and might not use Supabase Auth,
-- you can set policies to allow users to read/write based on their device_id supplied in the client (or leave wide open if using Anon key + RLS based on device_id row).
-- Example Wide-Open Policies for Anonymous (adjust as needed for true production security):
CREATE POLICY "Allow anon read/write users" ON users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write connection_requests" ON connection_requests FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write messages" ON messages FOR ALL TO anon USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for connection_requests and messages
alter publication supabase_realtime add table connection_requests;
alter publication supabase_realtime add table messages;
