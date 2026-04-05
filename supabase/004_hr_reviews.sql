-- ─── HR Reviews ───────────────────────────────────────────────────────────────
create table if not exists hr_reviews (
  id           uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  reviewed_by  uuid not null references auth.users(id),
  rating       integer check (rating >= 1 and rating <= 5),
  notes        text,
  verdict      text check (verdict in ('shortlisted', 'rejected', 'under_review')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (interview_id)   -- one review record per interview
);

alter table hr_reviews enable row level security;

create policy "Reviewer can select hr_reviews"
  on hr_reviews for select
  using (reviewed_by = auth.uid());

create policy "Reviewer can insert hr_reviews"
  on hr_reviews for insert
  with check (reviewed_by = auth.uid());

create policy "Reviewer can update hr_reviews"
  on hr_reviews for update
  using (reviewed_by = auth.uid())
  with check (reviewed_by = auth.uid());

create policy "Reviewer can delete hr_reviews"
  on hr_reviews for delete
  using (reviewed_by = auth.uid());
