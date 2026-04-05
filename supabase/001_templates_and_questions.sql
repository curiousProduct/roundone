-- ─── Templates ────────────────────────────────────────────────────────────────
create table if not exists templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  company_id  uuid,                        -- linked once company onboarding is built
  created_by  uuid not null references auth.users(id) on delete cascade,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table templates enable row level security;

-- HR users can only see their own templates
create policy "Owner can select templates"
  on templates for select
  using (auth.uid() = created_by);

create policy "Owner can insert templates"
  on templates for insert
  with check (auth.uid() = created_by);

create policy "Owner can update templates"
  on templates for update
  using (auth.uid() = created_by);

create policy "Owner can delete templates"
  on templates for delete
  using (auth.uid() = created_by);

-- ─── Questions ────────────────────────────────────────────────────────────────
create table if not exists questions (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references templates(id) on delete cascade,
  order_index    integer not null,
  text           text not null,
  thinking_time  integer not null default 30,   -- seconds
  answer_time    integer not null default 90,   -- seconds
  created_at     timestamptz not null default now()
);

alter table questions enable row level security;

-- Questions inherit access from their parent template
create policy "Owner can select questions"
  on questions for select
  using (
    exists (
      select 1 from templates t
      where t.id = questions.template_id
        and t.created_by = auth.uid()
    )
  );

create policy "Owner can insert questions"
  on questions for insert
  with check (
    exists (
      select 1 from templates t
      where t.id = questions.template_id
        and t.created_by = auth.uid()
    )
  );

create policy "Owner can update questions"
  on questions for update
  using (
    exists (
      select 1 from templates t
      where t.id = questions.template_id
        and t.created_by = auth.uid()
    )
  );

create policy "Owner can delete questions"
  on questions for delete
  using (
    exists (
      select 1 from templates t
      where t.id = questions.template_id
        and t.created_by = auth.uid()
    )
  );
