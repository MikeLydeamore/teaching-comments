-- Apply with an owner connection before deploying synchronized expanded submissions.
alter table edie_submission_view_settings
  add column if not exists expanded_submission_id uuid
  references edie_submissions(id) on delete set null;
