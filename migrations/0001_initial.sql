PRAGMA foreign_keys = ON;

CREATE TABLE request_types (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE workflow_versions (
  id TEXT PRIMARY KEY NOT NULL,
  request_type_id TEXT NOT NULL REFERENCES request_types(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  definition_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (request_type_id, version)
);

CREATE TABLE requests (
  id TEXT PRIMARY KEY NOT NULL,
  folio TEXT NOT NULL UNIQUE,
  request_type_id TEXT NOT NULL REFERENCES request_types(id),
  workflow_version_id TEXT NOT NULL REFERENCES workflow_versions(id),
  requester_id TEXT NOT NULL,
  status TEXT NOT NULL,
  form_data_json TEXT NOT NULL,
  concurrency_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE request_steps (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  step_index INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('approval', 'fulfillment')),
  assignee_id TEXT,
  status TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE (request_id, step_index)
);

CREATE TABLE request_events (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

CREATE INDEX requests_requester_created ON requests(requester_id, created_at);
CREATE INDEX request_steps_assignee_status ON request_steps(assignee_id, status);
CREATE INDEX request_events_request_created ON request_events(request_id, created_at);
CREATE INDEX outbox_events_status_created ON outbox_events(status, created_at);
