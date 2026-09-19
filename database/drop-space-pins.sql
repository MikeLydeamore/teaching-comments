-- Run as the Neon project owner for databases created before accounts/ACL.
-- Space access is now controlled by edie_space_members; PINs are gone.
alter table edie_teacher_spaces
  drop column if exists pin_hash;
