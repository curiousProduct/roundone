-- ─── Candidates ──────────────────────────────────────────────────────────────
create table if not exists candidates (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid,                        -- linked once company onboarding is built
  name       text not null,
  email      text not null,
  created_at timestamptz not null default now()
);

alter table candidates enable row level security;

-- Any authenticated user can create candidate records
create policy "Authenticated users can insert candidates"
  on candidates for insert
  with check (auth.role() = 'authenticated');

-- HR users can read candidates linked to their interviews
create policy "Authenticated users can select candidates"
  on candidates for select
  using (auth.role() = 'authenticated');

-- ─── Interviews ───────────────────────────────────────────────────────────────
create table if not exists interviews (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  template_id  uuid not null references templates(id) on delete cascade,
  company_id   uuid,
  token        text not null unique,
  status       text not null default 'pending',  -- pending | submitted | reviewed
  expires_at   timestamptz not null,
  sent_at      timestamptz,
  submitted_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table interviews enable row level security;

-- Access is scoped to HR users who own the template
create policy "Owner can select interviews"
  on interviews for select
  using (
    exists (
      select 1 from templates t
      where t.id = interviews.template_id
        and t.created_by = auth.uid()
    )
  );

create policy "Owner can insert interviews"
  on interviews for insert
  with check (
    exists (
      select 1 from templates t
      where t.id = interviews.template_id
        and t.created_by = auth.uid()
    )
  );

create policy "Owner can update interviews"
  on interviews for update
  using (
    exists (
      select 1 from templates t
      where t.id = interviews.template_id
        and t.created_by = auth.uid()
    )
  );

-- Candidates can look up their own interview by token (no auth required)
create policy "Public can select interview by token"
  on interviews for select
  using (true);
