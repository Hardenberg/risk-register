import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { hashPassword } from '../security/passwordHasher.js'

export class SqliteDatabase {
  readonly connection: DatabaseSync
  readonly databasePath: string

  /** Öffnet SQLite, setzt sicherheitsrelevante Pragmas und führt ausstehende Migrationen aus. */
  constructor (databasePath: string) {
    this.databasePath = databasePath
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true })
    }

    this.connection = new DatabaseSync(databasePath)
    this.connection.exec('PRAGMA foreign_keys = ON;')
    if (databasePath !== ':memory:') {
      this.connection.exec('PRAGMA journal_mode = WAL;')
    }
    this.migrate()

    // Seed optional demo data if requested or in test mode (unless explicitly disabled)
    if (process.env.SEED_DEMO_DATA === 'true' || (process.env.NODE_ENV === 'test' && process.env.SEED_DEMO_DATA !== 'false')) {
      this.seedDemoData()
    }
  }

  /** Schließt die native SQLite-Verbindung kontrolliert. */
  close (): void {
    this.connection.close()
  }

  /** Fügt Demodaten für Demonstrations- oder Testzwecke ein. */
  seedDemoData (): void {
    // Check if demo data already exists to avoid duplicate constraint errors
    const checkRow = this.connection.prepare("SELECT count(*) as count FROM risks WHERE id = '01J00000000000000000000001'").get() as { count: number }
    if (checkRow.count > 0) return

    this.connection.exec(`
      BEGIN;
      INSERT OR IGNORE INTO risks (
        id, reference, title, category, owner, initial_score, current_score,
        status, due_date, created_at, updated_at, description, review_date, review_cycle
      ) VALUES
        ('01J00000000000000000000001', 'R-024', 'Lieferengpass bei Kernkomponenten', 'Lieferkette', 'Lena Vogt', 22, 18, 'In Bearbeitung', '2026-07-18', '2026-07-01T08:00:00.000Z', '2026-07-07T10:30:00.000Z', 'Risiko von Lieferverzögerungen bei kritischen Kernkomponenten mit möglicher Auswirkung auf Produktion und Kundenliefertermine.', '2026-07-18', 'Fix'),
        ('01J00000000000000000000002', 'R-019', 'Ausfall der zentralen Datenplattform', 'Technologie', 'Noah Weber', 20, 12, 'Überwacht', '2026-07-24', '2026-06-20T09:00:00.000Z', '2026-07-05T14:00:00.000Z', 'Ausfallrisiko der zentralen Datenplattform mit Auswirkungen auf Reporting, Steuerung und operative Entscheidungen.', '2026-07-24', 'Fix'),
        ('01J00000000000000000000003', 'R-017', 'Verzögerung der regulatorischen Freigabe', 'Compliance', 'Mia Brandt', 16, 9, 'In Bearbeitung', '2026-08-02', '2026-06-12T11:00:00.000Z', '2026-07-03T09:15:00.000Z', 'Mögliche Verzögerung regulatorischer Freigaben mit Einfluss auf geplante Markteinführung und Projektmeilensteine.', '2026-08-02', 'Fix'),
        ('01J00000000000000000000004', 'R-011', 'Wissensverlust durch Personalwechsel', 'Organisation', 'Elias König', 12, 6, 'Offen', '2026-08-11', '2026-05-28T13:00:00.000Z', '2026-06-29T16:45:00.000Z', 'Schlüsselwissen ist auf wenige Personen verteilt und kann bei Personalwechseln verloren gehen.', '2026-08-11', 'Fix'),
        ('01J00000000000000000000005', 'R-008', 'Budgetüberschreitung im Rollout', 'Finanzen', 'Sofia Kern', 15, 4, 'Geschlossen', '2026-06-30', '2026-05-05T07:30:00.000Z', '2026-06-30T12:00:00.000Z', 'Budgetabweichungen im Rollout können zusätzliche Freigaben und Priorisierungsentscheidungen erforderlich machen.', '2026-06-30', 'Fix');
      COMMIT;
    `)
  }

  readSetting (key: string): string | null {
    const row = this.connection.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  /** Erstellt das initiale Schema und die einmaligen Demonstrationsdaten atomar. */
  private migrate (): void {
    const version = this.connection.prepare('PRAGMA user_version').get() as { user_version: number }
    if (version.user_version >= 9) return

    if (version.user_version === 0) {
      this.connection.exec(`
        BEGIN;
        CREATE TABLE risks (
          id TEXT PRIMARY KEY,
          reference TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          owner TEXT NOT NULL,
          initial_score INTEGER NOT NULL CHECK (initial_score BETWEEN 1 AND 25),
          current_score INTEGER NOT NULL CHECK (current_score BETWEEN 1 AND 25),
          status TEXT NOT NULL CHECK (status IN ('Offen', 'In Bearbeitung', 'Überwacht', 'Geschlossen')),
          due_date TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_risks_current_score ON risks (current_score DESC);

        PRAGMA user_version = 1;
        COMMIT;
      `)
    }

    if (version.user_version < 2) {
      this.connection.exec(`
        BEGIN;
        ALTER TABLE risks ADD COLUMN deleted_at TEXT;
        CREATE INDEX idx_risks_active_score ON risks (deleted_at, current_score DESC, created_at DESC);
        PRAGMA user_version = 2;
        COMMIT;
      `)
    }

    if (version.user_version < 3) {
      this.connection.exec(`
        BEGIN;
        ALTER TABLE risks ADD COLUMN description TEXT NOT NULL DEFAULT 'Keine Beschreibung hinterlegt.';
        ALTER TABLE risks ADD COLUMN review_date TEXT DEFAULT '2026-08-31';
        CREATE INDEX idx_risks_review_date ON risks (review_date);
        PRAGMA user_version = 3;
        COMMIT;
      `)
    }

    if (version.user_version < 4) {
      this.connection.exec(`
        BEGIN;
        ALTER TABLE risks ADD COLUMN review_cycle TEXT NOT NULL DEFAULT 'Fix';
        CREATE INDEX idx_risks_review_cycle ON risks (review_cycle);
        PRAGMA user_version = 4;
        COMMIT;
      `)
    }

    if (version.user_version < 5) {
      this.connection.exec(`
        BEGIN;
        CREATE TABLE risks_next (
          id TEXT PRIMARY KEY,
          reference TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          owner TEXT NOT NULL,
          initial_score INTEGER NOT NULL CHECK (initial_score BETWEEN 1 AND 25),
          current_score INTEGER NOT NULL CHECK (current_score BETWEEN 1 AND 25),
          status TEXT NOT NULL CHECK (status IN ('Offen', 'In Bearbeitung', 'Überwacht', 'Geschlossen')),
          due_date TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          description TEXT NOT NULL DEFAULT 'Keine Beschreibung hinterlegt.',
          review_date TEXT,
          review_cycle TEXT NOT NULL DEFAULT 'Fix'
        );

        INSERT INTO risks_next (
          id, reference, title, category, owner, initial_score, current_score,
          status, due_date, created_at, updated_at, deleted_at, description,
          review_date, review_cycle
        )
        SELECT
          id, reference, title, category, owner, initial_score, current_score,
          status, due_date, created_at, updated_at, deleted_at, description,
          review_date, review_cycle
        FROM risks;

        DROP TABLE risks;
        ALTER TABLE risks_next RENAME TO risks;

        CREATE INDEX idx_risks_current_score ON risks (current_score DESC);
        CREATE INDEX idx_risks_active_score ON risks (deleted_at, current_score DESC, created_at DESC);
        CREATE INDEX idx_risks_review_date ON risks (review_date);
        CREATE INDEX idx_risks_review_cycle ON risks (review_cycle);
        PRAGMA user_version = 5;
        COMMIT;
      `)
    }

    if (version.user_version < 6) {
      const timestamp = new Date().toISOString()
      const adminPasswordHash = hashPassword('admin123')
      this.connection.exec(`
        BEGIN;
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          department TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          active INTEGER NOT NULL CHECK (active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_users_active ON users (active);
        CREATE INDEX idx_users_email ON users (email);

        INSERT INTO users (
          id, username, name, email, department, password_hash, active,
          created_at, updated_at
        ) VALUES (
          '01J00000000000000000001000',
          'admin',
          'Admin User',
          'admin@example.local',
          'Risk Management',
          '${adminPasswordHash}',
          1,
          '${timestamp}',
          '${timestamp}'
        );

        PRAGMA user_version = 6;
        COMMIT;
      `)
    }

    if (version.user_version < 7) {
      const authTokenSecret = randomBytes(32).toString('base64url')
      this.connection.exec(`
        BEGIN;
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        INSERT OR IGNORE INTO app_settings (key, value)
        VALUES ('auth_token_secret', '${authTokenSecret}');
        PRAGMA user_version = 7;
        COMMIT;
      `)
    }

    if (version.user_version < 8) {
      this.connection.exec(`
        BEGIN;
        ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'User' CHECK (role IN ('Admin', 'User'));
        UPDATE users SET role = 'Admin' WHERE lower(username) = 'admin';
        INSERT OR IGNORE INTO app_settings (key, value) VALUES
          ('organization_name', 'Risk Register'),
          ('default_review_cycle', 'Fix'),
          ('review_reminder_days', '14'),
          ('high_risk_threshold', '10'),
          ('critical_risk_threshold', '16');
        PRAGMA user_version = 8;
        COMMIT;
      `)
    }

    if (version.user_version < 9) {
      this.connection.exec(`
        BEGIN;
        CREATE TABLE measures (
          id TEXT PRIMARY KEY,
          risk_id TEXT REFERENCES risks(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          owner TEXT NOT NULL,
          due_date TEXT,
          priority TEXT NOT NULL CHECK (priority IN ('Kritisch', 'Hoch', 'Normal')),
          status TEXT NOT NULL CHECK (status IN ('Offen', 'In Arbeit', 'Erledigt')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_measures_status_due_date ON measures (status, due_date);
        CREATE INDEX idx_measures_risk_id ON measures (risk_id);
        PRAGMA user_version = 9;
        COMMIT;
      `)
    }
  }
}
