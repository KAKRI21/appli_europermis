// src/db/schema.ts
//
// Schéma Drizzle — remplace la base Supabase (Lovable Cloud).
// Cible : Postgres hébergé sur Neon.
//
// Différences volontaires par rapport à l'ancien schéma Supabase :
//  - Les mots de passe ne sont JAMAIS dans `profiles` : table `credentials`
//    séparée, un seul champ sensible, plus facile à auditer / chiffrer.
//  - Nouvelle table `instructors` (n'existait pas côté Supabase : les
//    moniteurs n'avaient qu'un rôle, pas de fiche dédiée).
//  - `students.neph` est UNIQUE : c'est l'identifiant pivot pour dédupliquer
//    les imports Rapido (un élève ne doit jamais être créé deux fois).
//  - Champs ajoutés vus dans l'export Rapido réel mais absents de l'ancien
//    schéma : telephone_2/3/4, lieu_premier_permis.
//  - `rapido_import_runs` + `rapido_import_rows` : traçabilité complète de
//    chaque import (utile pour debug + audit RGPD : qui a importé quoi, quand).

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const appRole = pgEnum("app_role", ["admin", "instructor", "student"]);
export const importSourceEnum = pgEnum("import_source", ["seed", "manual", "rapido"]);
export const importRowStatusEnum = pgEnum("import_row_status", [
  "created",
  "updated",
  "skipped_duplicate",
  "error",
]);

// ---------------------------------------------------------------------------
// Comptes / identité
// ---------------------------------------------------------------------------

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull(),
  username: text("username").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex("profiles_email_idx").on(table.email),
  usernameIdx: uniqueIndex("profiles_username_idx").on(table.username),
}));

// Séparée de `profiles` à dessein : un seul hash, jamais exposé par erreur
// dans une requête `select *` sur profiles.
export const credentials = pgTable("credentials", {
  userId: uuid("user_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  mustResetPassword: boolean("must_reset_password").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  role: appRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userRoleIdx: uniqueIndex("user_roles_user_id_role_idx").on(table.userId, table.role),
}));

// ---------------------------------------------------------------------------
// Élèves
// ---------------------------------------------------------------------------

export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),

  civilite: text("civilite"),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),

  dateNaissance: text("date_naissance"), // conservé en texte JJ/MM/AAAA (source Rapido), voir note en bas de fichier
  lieuNaissance: text("lieu_naissance"),
  departementNaissance: text("departement_naissance"),
  paysNaissance: text("pays_naissance"),

  neph: varchar("neph", { length: 20 }),
  datePremierPermis: text("date_premier_permis"),
  lieuPremierPermis: text("lieu_premier_permis"), // absent de l'ancien schéma, présent dans l'export Rapido

  pkg: text("pkg").default("À définir"),
  hours: text("hours").default("0/20"),

  adresse: text("adresse"),
  codePostal: text("code_postal"),
  ville: text("ville"),
  pays: text("pays"),

  telephone: text("telephone"),
  telephone2: text("telephone_2"),
  telephone3: text("telephone_3"),
  telephone4: text("telephone_4"),
  email: text("email"),

  source: importSourceEnum("source").notNull().default("manual"),
  rapidoImportRowId: uuid("rapido_import_row_id").references(() => rapidoImportRows.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: uniqueIndex("students_user_id_idx").on(table.userId),
  // NEPH unique quand renseigné — c'est la clé de dédup pour l'import Rapido.
  nephIdx: uniqueIndex("students_neph_idx").on(table.neph),
}));

// ---------------------------------------------------------------------------
// Moniteurs — table qui n'existait pas côté Supabase
// ---------------------------------------------------------------------------

export const instructors = pgTable("instructors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),

  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  numeroAutorisation: text("numero_autorisation"), // n° d'autorisation d'enseigner (exigé par la DSR)
  telephone: text("telephone"),
  email: text("email"),
  actif: boolean("actif").notNull().default(true),

  source: importSourceEnum("source").notNull().default("manual"),
  rapidoImportRowId: uuid("rapido_import_row_id").references(() => rapidoImportRows.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: uniqueIndex("instructors_user_id_idx").on(table.userId),
}));

// ---------------------------------------------------------------------------
// Traçabilité des imports Rapido
// ---------------------------------------------------------------------------

export const rapidoImportRuns = pgTable("rapido_import_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: text("file_name").notNull(),
  importedByUserId: uuid("imported_by_user_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  role: appRole("role").notNull(), // student | instructor : un run importe un seul type
  totalRows: integer("total_rows").notNull().default(0),
  createdCount: integer("created_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const rapidoImportRows = pgTable("rapido_import_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => rapidoImportRuns.id, { onDelete: "cascade" }),
  rowNumber: integer("row_number").notNull(),
  status: importRowStatusEnum("status").notNull(),
  rawData: jsonb("raw_data").notNull(), // ligne brute du fichier, pour debug/replay
  errorMessage: text("error_message"),
  resultUserId: uuid("result_user_id").references(() => profiles.id, { onDelete: "set null" }),
}, (table) => ({
  runIdx: index("rapido_import_rows_run_idx").on(table.runId),
}));

// ---------------------------------------------------------------------------
// Relations (pour les requêtes Drizzle `with: {...}`)
// ---------------------------------------------------------------------------

export const profilesRelations = relations(profiles, ({ many, one }) => ({
  roles: many(userRoles),
  student: one(students, { fields: [profiles.id], references: [students.userId] }),
  instructor: one(instructors, { fields: [profiles.id], references: [instructors.userId] }),
  credentials: one(credentials, { fields: [profiles.id], references: [credentials.userId] }),
}));

export const studentsRelations = relations(students, ({ one }) => ({
  profile: one(profiles, { fields: [students.userId], references: [profiles.id] }),
  importRow: one(rapidoImportRows, {
    fields: [students.rapidoImportRowId],
    references: [rapidoImportRows.id],
  }),
}));

export const instructorsRelations = relations(instructors, ({ one }) => ({
  profile: one(profiles, { fields: [instructors.userId], references: [profiles.id] }),
}));

export const rapidoImportRunsRelations = relations(rapidoImportRuns, ({ many }) => ({
  rows: many(rapidoImportRows),
}));

export const rapidoImportRowsRelations = relations(rapidoImportRows, ({ one }) => ({
  run: one(rapidoImportRuns, { fields: [rapidoImportRows.runId], references: [rapidoImportRuns.id] }),
}));

// NOTE dates : les dates de naissance / premier permis restent en texte
// "JJ/MM/AAAA" comme dans Rapido plutôt que converties en `date` Postgres.
// Raison : les exports Rapido contiennent des valeurs vides, partielles ou
// mal formées (voir export réel analysé) — forcer un type `date` strict
// aurait fait échouer l'import sur des centaines de lignes. Si besoin de
// trier/filtrer par date plus tard, on ajoutera une colonne `date_naissance_iso`
// générée à l'import, en gardant le texte source intact à côté.
