import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  startsAt: text("starts_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  status: text("status").notNull().default("scheduled"),
  category: text("category").notNull().default("Live Event"),
  homeRow: text("home_row").notNull().default("show-series"),
  streamUrl: text("stream_url").notNull().default(""),
  providerBroadcastId: text("provider_broadcast_id").notNull().default(""),
  posterUrl: text("poster_url").notNull().default(""),
  gateType: text("gate_type").notNull().default("none"),
  gateCode: text("gate_code").notNull().default(""),
  gateMessage: text("gate_message").notNull().default("This broadcast is reserved for registered viewers."),
  creatorEmail: text("creator_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_events_creator_email").on(table.creatorEmail),
]);

export const viewerAccess = sqliteTable("viewer_access", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_viewer_access_event_email").on(table.eventId, table.email),
]);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const accounts = sqliteTable("accounts", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  subscriptionStatus: text("subscription_status").notNull().default("inactive"),
  subscriptionPlan: text("subscription_plan").notNull().default("viewer"),
  creatorAccess: integer("creator_access", { mode: "boolean" }).notNull().default(false),
  whipEndpoint: text("whip_endpoint").notNull().default(""),
  whipToken: text("whip_token").notNull().default(""),
  playbackUrl: text("playback_url").notNull().default(""),
  channelName: text("channel_name").notNull().default(""),
  channelSlug: text("channel_slug").notNull().default(""),
  channelDescription: text("channel_description").notNull().default(""),
  channelStatus: text("channel_status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const savedVideos = sqliteTable("saved_videos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountEmail: text("account_email").notNull().references(() => accounts.email, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_saved_videos_account_event").on(table.accountEmail, table.eventId),
]);
