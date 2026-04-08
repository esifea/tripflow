package main

import (
	"fmt"
	"log"
	"time"
)

// Cleanup unused trips
//
// A trip is "unused" if its 'last_accessed_at' is older than
// CLEANUP_DAYS days AND it was created more than minTripAgeDays ago
// (Currently this is a HARD delete)

const (
	cleanupInterval = 24 * time.Hour
	minTripAgeDays  = 7
)

func startCleanupWorker(thresholdDays int) {
	if thresholdDays <= 0 {
		log.Println("[INFO] Trip cleanup disabled (CLEANUP_DAYS=0)")
		return
	}
	if thresholdDays < minTripAgeDays {
		log.Printf("[WARN] CLEANUP_DAYS=%d is below minimum age floor of %d days; using %d",
			thresholdDays, minTripAgeDays, minTripAgeDays)
		thresholdDays = minTripAgeDays
	}

	log.Printf("[INFO] Trip cleanup worker started (threshold: %d days, interval: %s)",
		thresholdDays, cleanupInterval)

	go func() {
		runCleanup(thresholdDays)
		ticker := time.NewTicker(cleanupInterval)
		defer ticker.Stop()
		for range ticker.C {
			runCleanup(thresholdDays)
		}
	}()
}

func runCleanup(thresholdDays int) {
	// SELECT for logging
	rows, err := db.Query(`
		SELECT id, token, name, last_accessed_at
		FROM trips
		WHERE last_accessed_at < datetime('now', ?)
		  AND created_at < datetime('now', ?)
	`, fmt.Sprintf("-%d days", thresholdDays), fmt.Sprintf("-%d days", minTripAgeDays))
	if err != nil {
		log.Printf("[WARN] cleanup: failed to query stale trips: %v", err)
		return
	}

	type doomed struct {
		id           int64
		token        string
		name         string
		lastAccessed time.Time
	}

	var victims []doomed
	for rows.Next() {
		var d doomed
		if err := rows.Scan(&d.id, &d.token, &d.name, &d.lastAccessed); err != nil {
			log.Printf("[WARN] cleanup: scan error: %v", err)
			continue
		}
		victims = append(victims, d)
	}
	rows.Close()

	if len(victims) == 0 {
		return
	}

	for _, v := range victims {
		ageDays := int(time.Since(v.lastAccessed).Hours() / 24)
		log.Printf("[INFO] cleanup: deleting trip id=%d token=%s name=%q (last accessed %d days ago)",
			v.id, v.token, v.name, ageDays)
		if _, err := db.Exec(`DELETE FROM trips WHERE id=?`, v.id); err != nil {
			log.Printf("[WARN] cleanup: failed to delete trip id=%d: %v", v.id, err)
		}
	}
	log.Printf("[INFO] cleanup: removed %d unused trip(s)", len(victims))
}

