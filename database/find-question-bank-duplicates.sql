-- Read-only report for question-bank entries that would violate the uniqueness
-- indexes in add-question-bank-uniqueness.sql. The query returns no rows when
-- both banks are clean.
with bank_items as (
  select
    'question'::text as bank_type,
    sessions.space_code,
    sessions.code as session_code,
    questions.session_code as session_id,
    questions.id,
    questions.title,
    questions.text as question,
    questions.created_at,
    questions.updated_at
  from edie_question_bank as questions
  join edie_sessions as sessions on sessions.id = questions.session_code

  union all

  select
    'poll'::text as bank_type,
    sessions.space_code,
    sessions.code as session_code,
    questions.session_code as session_id,
    questions.id,
    questions.title,
    questions.question,
    questions.created_at,
    questions.updated_at
  from edie_poll_question_bank as questions
  join edie_sessions as sessions on sessions.id = questions.session_code
),
duplicate_keys as (
  select
    bank_type,
    session_id,
    lower(btrim(question)) as normalized_question
  from bank_items
  group by bank_type, session_id, lower(btrim(question))
  having count(*) > 1
)
select
  items.bank_type,
  items.space_code,
  items.session_code,
  items.session_id,
  duplicates.normalized_question,
  count(*) as duplicate_count,
  jsonb_agg(
    jsonb_build_object(
      'id', items.id,
      'title', items.title,
      'question', items.question,
      'createdAt', items.created_at,
      'updatedAt', items.updated_at
    )
    order by items.created_at, items.id
  ) as duplicate_items
from duplicate_keys as duplicates
join bank_items as items
  on items.bank_type = duplicates.bank_type
  and items.session_id = duplicates.session_id
  and lower(btrim(items.question)) = duplicates.normalized_question
group by
  items.bank_type,
  items.space_code,
  items.session_code,
  items.session_id,
  duplicates.normalized_question
order by
  items.space_code,
  items.session_code,
  items.bank_type,
  duplicates.normalized_question;
