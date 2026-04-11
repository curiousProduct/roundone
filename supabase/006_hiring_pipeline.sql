-- ── 006_hiring_pipeline.sql ──────────────────────────────────────────────────
-- Hiring pipeline: job openings → stages → candidate applications → results
-- Stage 1 is always async_video; stages 2-5 are always live_interview.
-- HR manually advances candidates through stages.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE job_openings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  uuid,
  created_by  uuid REFERENCES auth.users(id),
  title       text NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE pipeline_stages (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_opening_id uuid REFERENCES job_openings(id) ON DELETE CASCADE,
  order_index    integer NOT NULL CHECK (order_index BETWEEN 1 AND 5),
  name           text NOT NULL,
  type           text NOT NULL DEFAULT 'live_interview'
                   CHECK (type IN ('async_video', 'live_interview')),
  template_id    uuid REFERENCES templates(id),
  created_at     timestamp with time zone DEFAULT now(),
  UNIQUE (job_opening_id, order_index)
);

-- Stage 1 must always be async_video
CREATE OR REPLACE FUNCTION enforce_stage_rules()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_index = 1 AND NEW.type <> 'async_video' THEN
    RAISE EXCEPTION 'Stage 1 must be of type async_video';
  END IF;
  IF NEW.order_index > 1 AND NEW.type <> 'live_interview' THEN
    RAISE EXCEPTION 'Stages 2-5 must be of type live_interview';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_stage_rules
BEFORE INSERT OR UPDATE ON pipeline_stages
FOR EACH ROW EXECUTE FUNCTION enforce_stage_rules();

-- Max 5 stages per job opening
CREATE OR REPLACE FUNCTION enforce_max_stages()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM pipeline_stages
    WHERE job_opening_id = NEW.job_opening_id
  ) >= 5 THEN
    RAISE EXCEPTION 'A job opening cannot have more than 5 pipeline stages';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_max_stages
BEFORE INSERT ON pipeline_stages
FOR EACH ROW EXECUTE FUNCTION enforce_max_stages();

CREATE TABLE candidate_applications (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_opening_id      uuid REFERENCES job_openings(id) ON DELETE CASCADE,
  company_id          uuid,
  candidate_id        uuid REFERENCES candidates(id),
  current_stage_index integer DEFAULT 1,
  overall_status      text DEFAULT 'active'
                        CHECK (overall_status IN ('active', 'hired', 'rejected')),
  created_at          timestamp with time zone DEFAULT now()
);

CREATE TABLE stage_results (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id     uuid REFERENCES candidate_applications(id) ON DELETE CASCADE,
  stage_id           uuid REFERENCES pipeline_stages(id),
  status             text DEFAULT 'pending'
                       CHECK (status IN ('pending', 'in_progress', 'passed', 'failed')),
  interview_id       uuid REFERENCES interviews(id),
  scheduled_at       timestamp with time zone,
  interviewer_email  text,
  meet_link          text,
  platform           text CHECK (platform IN ('google_meet', 'zoom', 'teams', 'other')),
  notes              text,
  rating             integer CHECK (rating BETWEEN 1 AND 5),
  updated_at         timestamp with time zone DEFAULT now(),
  created_at         timestamp with time zone DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_pipeline_stages_job_opening  ON pipeline_stages (job_opening_id);
CREATE INDEX idx_applications_job_opening     ON candidate_applications (job_opening_id);
CREATE INDEX idx_applications_candidate       ON candidate_applications (candidate_id);
CREATE INDEX idx_stage_results_application    ON stage_results (application_id);
CREATE INDEX idx_stage_results_stage          ON stage_results (stage_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE job_openings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_results         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR sees own job openings"
  ON job_openings FOR ALL
  USING (created_by = auth.uid());

CREATE POLICY "HR sees own pipeline stages"
  ON pipeline_stages FOR ALL
  USING (
    job_opening_id IN (
      SELECT id FROM job_openings WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "HR sees own applications"
  ON candidate_applications FOR ALL
  USING (company_id = auth.uid());

CREATE POLICY "HR sees own stage results"
  ON stage_results FOR ALL
  USING (
    application_id IN (
      SELECT id FROM candidate_applications WHERE company_id = auth.uid()
    )
  );
