import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  varchar,
  doublePrecision,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// ============ ПОЛЬЗОВАТЕЛИ ============
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  passwordHash: text("password_hash"),
  displayName: varchar("display_name", { length: 120 }),
  avatarUrl: text("avatar_url"),
  bio: varchar("bio", { length: 300 }),
  // Телефон
  phone: varchar("phone", { length: 24 }).unique(),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  authProvider: varchar("auth_provider", { length: 20 }).default("local").notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ КОДЫ ПОДТВЕРЖДЕНИЯ ПО SMS ============
export const otpCodes = pgTable(
  "otp_codes",
  {
    id: serial("id").primaryKey(),
    target: varchar("target", { length: 64 }).notNull(), // телефон или код привязки
    kind: varchar("kind", { length: 20 }).notNull(), // phone | tg_link
    code: varchar("code", { length: 10 }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    attempts: integer("attempts").default(0).notNull(),
    usedAt: timestamp("used_at"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("otp_target_idx").on(t.target), index("otp_code_idx").on(t.code)]
);

// ============ СЕССИИ ============
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// ============ КАЗИНО ============
export const casinoHistory = pgTable("casino_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  amount: doublePrecision("amount").notNull(),
  result: varchar("result", { length: 20 }).notNull(),
  multiplier: doublePrecision("multiplier").notNull(),
  rolledNumber: integer("rolled_number").notNull(),
  payout: doublePrecision("payout").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ ЗАМЕТКИ ============
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestKey: varchar("guest_key", { length: 64 }),
  authorName: varchar("author_name", { length: 120 }),
  title: varchar("title", { length: 200 }),
  text: text("text"),
  filePath: text("file_path"),
  fileType: varchar("file_type", { length: 50 }),
  /** Пост виден всем в общей ленте */
  isPublic: boolean("is_public").default(false).notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  tags: varchar("tags", { length: 200 }),
  likes: integer("likes").default(0).notNull(),
  views: integer("views").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Лайки постов
export const noteLikes = pgTable("note_likes", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id").references(() => notes.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestKey: varchar("guest_key", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ ОБЩИЙ ЧАТ ============
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  username: varchar("username", { length: 100 }).notNull(),
  avatarUrl: text("avatar_url"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ ЛИЧНЫЕ СООБЩЕНИЯ ============
export const directMessages = pgTable(
  "direct_messages",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    recipientId: integer("recipient_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    text: text("text").notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("dm_sender_idx").on(t.senderId),
    index("dm_recipient_idx").on(t.recipientId),
  ]
);

// ============ ПЛЕЙЛИСТЫ ============
export const playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestKey: varchar("guest_key", { length: 64 }),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 400 }),
  emoji: varchar("emoji", { length: 12 }).default("🎵").notNull(),
  color: varchar("color", { length: 20 }).default("#6c5ce7").notNull(),
  isPublic: boolean("is_public").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Треки в плейлисте (метаданные денормализованы — воспроизведение без повторного поиска)
export const playlistTracks = pgTable(
  "playlist_tracks",
  {
    id: serial("id").primaryKey(),
    playlistId: integer("playlist_id")
      .references(() => playlists.id, { onDelete: "cascade" })
      .notNull(),
    trackId: varchar("track_id", { length: 120 }).notNull(),
    source: varchar("source", { length: 20 }).notNull(), // audius | itunes
    title: varchar("title", { length: 300 }).notNull(),
    artist: varchar("artist", { length: 300 }).notNull(),
    album: varchar("album", { length: 300 }),
    artwork: text("artwork"),
    streamUrl: text("stream_url").notNull(),
    duration: integer("duration").default(0).notNull(),
    genre: varchar("genre", { length: 100 }),
    isFull: boolean("is_full").default(false).notNull(),
    position: integer("position").default(0).notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [index("pt_playlist_idx").on(t.playlistId)]
);

// ============ ОПЫТ И УРОВНИ ============
export const userStats = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestKey: varchar("guest_key", { length: 64 }),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  coins: integer("coins").default(1000).notNull(),
  tracksPlayed: integer("tracks_played").default(0).notNull(),
  gamesPlayed: integer("games_played").default(0).notNull(),
  gamesWon: integer("games_won").default(0).notNull(),
  bestMultiplier: doublePrecision("best_multiplier").default(0).notNull(),
  postsCreated: integer("posts_created").default(0).notNull(),
  achievements: text("achievements").default("").notNull(),
  preferredArtists: text("preferred_artists").default("").notNull(),
  onboarded: boolean("onboarded").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============ ИСТОРИЯ ИГР КАЗИНО ============
export const gameRounds = pgTable("game_rounds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestKey: varchar("guest_key", { length: 64 }),
  game: varchar("game", { length: 24 }).notNull(),
  bet: doublePrecision("bet").notNull(),
  multiplier: doublePrecision("multiplier").default(0).notNull(),
  payout: doublePrecision("payout").default(0).notNull(),
  win: boolean("win").default(false).notNull(),
  detail: varchar("detail", { length: 120 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ AI-КАРТИНКИ ============
export const aiImages = pgTable("ai_images", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestKey: varchar("guest_key", { length: 64 }),
  prompt: varchar("prompt", { length: 500 }).notNull(),
  url: text("url").notNull(),
  style: varchar("style", { length: 40 }),
  width: integer("width").default(768).notNull(),
  height: integer("height").default(768).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ ИСТОРИЯ ПРОСЛУШИВАНИЙ (для микса и рекомендаций) ============
export const listeningHistory = pgTable(
  "listening_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestKey: varchar("guest_key", { length: 64 }),
    trackId: varchar("track_id", { length: 160 }).notNull(),
    source: varchar("source", { length: 20 }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    artist: varchar("artist", { length: 300 }).notNull(),
    artwork: text("artwork"),
    streamUrl: text("stream_url"),
    duration: integer("duration").default(0).notNull(),
    genre: varchar("genre", { length: 100 }),
    /** Сколько секунд реально прослушано — вес для рекомендаций */
    playedSeconds: integer("played_seconds").default(0).notNull(),
    liked: boolean("liked").default(false).notNull(),
    playedAt: timestamp("played_at").defaultNow().notNull(),
  },
  (t) => [
    index("lh_user_idx").on(t.userId),
    index("lh_guest_idx").on(t.guestKey),
    index("lh_artist_idx").on(t.artist),
  ]
);

// ============ ИЗБРАННЫЕ ГОРОДА (погода) ============
export const favoriteCities = pgTable("favorite_cities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestKey: varchar("guest_key", { length: 64 }),
  cityKey: varchar("city_key", { length: 80 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
