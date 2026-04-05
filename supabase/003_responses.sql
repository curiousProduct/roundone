-- ─── Responses ───────────────────────────────────────────────────────────────
create table if not exists responses (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews(id) on delete cascade,
  question_id   uuid not null references questions(id) on delete cascade,
  video_url     text,
  upload_status text not null default 'pending',  -- pending | uploaded | failed
  duration      integer,                          -- seconds
  created_at    timestamptz not null default now()
);

alter table responses enable row level security;

-- HR users can read responses belonging to their templates
create policy "Owner can select responses"
  on responses for select
  using (
    exists (
      select 1 from interviews i
      join templates t on t.id = i.template_id
      where i.id = responses.interview_id
        and t.created_by = auth.uid()
    )
  );

-- Candidates (unauthenticated) can insert responses
create policy "Anyone can insert responses"
  on responses for insert
  with check (true);


-- ─── Candidate-facing public read policies ────────────────────────────────────
-- These allow unauthenticated candidates to load their interview data by token.

-- Allow public read of candidates (candidate_id is only known from the interview row)
create policy "Public can read candidates"
  on candidates for select
  using (true);

-- Allow public read of templates (template content is not secret from candidates)
create policy "Public can read templates"
  on templates for select
  using (true);

-- Allow public read of questions
create policy "Public can read questions"
  on questions for select
  using (true);

-- Allow candidates to mark their own interview as submitted
create policy "Anyone can submit interview"
  on interviews for update
  using (true)
  with check (status = 'submitted');


-- ─── Supabase Storage: responses bucket ──────────────────────────────────────
-- Creates the "responses" bucket (public) for storing candidate video responses.
-- Run this block, then verify the bucket appears in Storage in the Supabase dashboard.

insert into storage.buckets (id, name, public)
values ('responses', 'responses', true)
on conflict (id) do nothing;

-- Allow anyone to upload to the responses bucket
create policy "Anyone can upload response videos"
  on storage.objects for insert
  with check (bucket_id = 'responses');

-- Allow anyone to read response videos (public bucket)
create policy "Anyone can read response videos"
  on storage.objects for select
  using (bucket_id = 'responses');
