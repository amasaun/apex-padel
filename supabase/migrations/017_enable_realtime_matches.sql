-- Enable realtime for matches table
-- This allows clients to subscribe to INSERT, UPDATE, DELETE events

-- Enable realtime replication for the matches table
alter publication supabase_realtime add table matches;

-- Grant SELECT permission to authenticated users for realtime
-- (This is needed for realtime to work)
grant select on matches to authenticated;
grant select on matches to anon;
