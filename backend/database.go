package main

import (
	"database/sql"
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
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_trips_token ON trips(token)`,
		`CREATE INDEX IF NOT EXISTS idx_events_trip_id ON events(trip_id)`,
		`CREATE INDEX IF NOT EXISTS idx_history_trip_id ON history(trip_id)`,
	}

	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			log.Printf("Migration error: %v\nSQL: %s", err, m)
			return err
		}
	}

	log.Println("[INFO] Database migrations completed")
	return nil
}

func logHistory(tripID int64, action string, detail string) {
	_, err := db.Exec(
		`INSERT INTO history (trip_id, action, detail) VALUES (?, ?, ?)`,
		tripID, action, detail,
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

