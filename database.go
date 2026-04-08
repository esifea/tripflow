package main

import (
	"database/sql"
	"encoding/json"
	"log"

	_ "modernc.org/sqlite"
)

var db *sql.DB

func initDB(dbPath string) error {
	var err error
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	// Enable WAL mode
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return err
	}

	// Enable foreign keys
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return err
	}

	return runMigrations()
}

func runMigrations() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS trips (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			token TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL DEFAULT 'Untitled Trip',
			start_date TEXT DEFAULT '',
			end_date TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			trip_id INTEGER NOT NULL,
			day_number INTEGER NOT NULL DEFAULT 1,
			start_time TEXT DEFAULT '',
			end_time TEXT DEFAULT '',
			title TEXT NOT NULL,
			description TEXT DEFAULT '',
			location TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			trip_id INTEGER NOT NULL,
			action TEXT NOT NULL,
			detail TEXT DEFAULT '',
			snapshot_data TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_trips_token ON trips(token)`,
		`CREATE INDEX IF NOT EXISTS idx_events_trip_id ON events(trip_id)`,
		`CREATE INDEX IF NOT EXISTS idx_history_trip_id ON history(trip_id)`,
	}

	// ALTER TABLE migrations - errors ignored because SQLite has no ADD COLUMN IF NOT EXISTS
	alterMigrations := []string{
		`ALTER TABLE trips ADD COLUMN destination TEXT DEFAULT ''`,
		`ALTER TABLE events ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE trips ADD COLUMN memo TEXT DEFAULT ''`,
		`ALTER TABLE trips ADD COLUMN checklist TEXT DEFAULT '[]'`,
		`ALTER TABLE trips ADD COLUMN last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
	}

	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			log.Printf("Migration error: %v\nSQL: %s", err, m)
			return err
		}
	}

	for _, m := range alterMigrations {
		if _, err := db.Exec(m); err != nil {
			// Ignore "duplicate column" - column already exists from a prior run
			log.Printf("[INFO] ALTER TABLE skipped (column exists): %v", err)
		}
	}

	log.Println("[INFO] Database migrations completed")
	return nil
}

func logHistory(tripID int64, action string, detail string, snapshot interface{}) {
	var snapshotStr string
	if snapshot != nil {
		if b, err := json.Marshal(snapshot); err == nil {
			snapshotStr = string(b)
		}
	}

	_, err := db.Exec(
		`INSERT INTO history (trip_id, action, detail, snapshot_data) VALUES (?, ?, ?, ?)`,
		tripID, action, detail, snapshotStr,
	)
	if err != nil {
		log.Printf("[WARN] Failed to log history: %v", err)
	}
}

func closeDB() {
	if db != nil {
		db.Close()
	}
}

