import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export class SqliteDatabase {
  readonly connection: DatabaseSync

  /** Öffnet SQLite, setzt sicherheitsrelevante Pragmas und führt ausstehende Migrationen aus. */
  constructor (databasePath: string) {
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true })
    }

    this.connection = new DatabaseSync(databasePath)
    this.connection.exec('PRAGMA foreign_keys = ON;')
    if (databasePath !== ':memory:') {
      this.connection.exec('PRAGMA journal_mode = WAL;')
    }
    this.migrate()
  }

  /** Schließt die native SQLite-Verbindung kontrolliert. */
  close (): void {
    this.connection.close()
  }

  /** Erstellt das initiale Schema und die einmaligen Demonstrationsdaten atomar. */
  private migrate (): void {
    const version = this.connection.prepare('PRAGMA user_version').get() as { user_version: number }
    if (version.user_version >= 1) return

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

      INSERT INTO risks VALUES
        ('01J00000000000000000000001', 'R-024', 'Lieferengpass bei Kernkomponenten', 'Lieferkette', 'Lena Vogt', 22, 18, 'In Bearbeitung', '2026-07-18', '2026-07-01T08:00:00.000Z', '2026-07-07T10:30:00.000Z'),
        ('01J00000000000000000000002', 'R-019', 'Ausfall der zentralen Datenplattform', 'Technologie', 'Noah Weber', 20, 12, 'Überwacht', '2026-07-24', '2026-06-20T09:00:00.000Z', '2026-07-05T14:00:00.000Z'),
        ('01J00000000000000000000003', 'R-017', 'Verzögerung der regulatorischen Freigabe', 'Compliance', 'Mia Brandt', 16, 9, 'In Bearbeitung', '2026-08-02', '2026-06-12T11:00:00.000Z', '2026-07-03T09:15:00.000Z'),
        ('01J00000000000000000000004', 'R-011', 'Wissensverlust durch Personalwechsel', 'Organisation', 'Elias König', 12, 6, 'Offen', '2026-08-11', '2026-05-28T13:00:00.000Z', '2026-06-29T16:45:00.000Z'),
        ('01J00000000000000000000005', 'R-008', 'Budgetüberschreitung im Rollout', 'Finanzen', 'Sofia Kern', 15, 4, 'Geschlossen', '2026-06-30', '2026-05-05T07:30:00.000Z', '2026-06-30T12:00:00.000Z');

      PRAGMA user_version = 1;
      COMMIT;
    `)
  }
}
