alter table edie_polls
  add column if not exists voting_ended_at timestamptz;
