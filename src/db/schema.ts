import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const requestTypes = sqliteTable('request_types', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const workflowVersions = sqliteTable('workflow_versions', {
  id: text('id').primaryKey(),
  requestTypeId: text('request_type_id').notNull().references(() => requestTypes.id),
  version: integer('version').notNull(),
  status: text('status', { enum: ['draft', 'published'] }).notNull(),
  definitionJson: text('definition_json').notNull(),
  createdAt: text('created_at').notNull(),
  publishedAt: text('published_at'),
}, (table) => [uniqueIndex('workflow_versions_type_version').on(table.requestTypeId, table.version)]);

export const requests = sqliteTable('requests', {
  id: text('id').primaryKey(),
  folio: text('folio').notNull().unique(),
  requestTypeId: text('request_type_id').notNull().references(() => requestTypes.id),
  workflowVersionId: text('workflow_version_id').notNull().references(() => workflowVersions.id),
  requesterId: text('requester_id').notNull(),
  status: text('status').notNull(),
  formDataJson: text('form_data_json').notNull(),
  concurrencyVersion: integer('concurrency_version').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const requestSteps = sqliteTable('request_steps', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => requests.id),
  stepIndex: integer('step_index').notNull(),
  kind: text('kind', { enum: ['approval', 'fulfillment'] }).notNull(),
  assigneeId: text('assignee_id'),
  status: text('status').notNull(),
  decidedAt: text('decided_at'),
}, (table) => [uniqueIndex('request_steps_request_index').on(table.requestId, table.stepIndex)]);

export const requestEvents = sqliteTable('request_events', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => requests.id),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  detailsJson: text('details_json').notNull(),
  createdAt: text('created_at').notNull(),
});

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => requests.id),
  objectKey: text('object_key').notNull().unique(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  createdAt: text('created_at').notNull(),
});

export const outboxEvents = sqliteTable('outbox_events', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => requests.id),
  kind: text('kind').notNull(),
  payloadJson: text('payload_json').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull(),
  deliveredAt: text('delivered_at'),
});
