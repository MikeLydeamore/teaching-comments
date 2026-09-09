-- Remove the retired submission starring and flagging features.
alter table edie_submissions
  drop column if exists starred,
  drop column if exists flagged;

alter table edie_submission_view_settings
  drop column if exists starred_only;
