package main

import (
	"path/filepath"
	"testing"
)

func setupTestDB(t *testing.T) func() {
	t.Helper()
	prev := db
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := initDB(dbPath); err != nil {
		t.Fatalf("initDB: %v", err)
	}
	return func() {
		closeDB()
		db = prev
	}
}

func insertTrip(t *testing.T, token, name string, createdDaysAgo, accessedDaysAgo int) int64 {
	t.Helper()
	res, err := db.Exec(
		`INSERT INTO trips (token, name, created_at, updated_at, last_accessed_at)
		 VALUES (?, ?, datetime('now', ?), datetime('now', ?), datetime('now', ?))`,
		token, name,
		daysExpr(createdDaysAgo), daysExpr(createdDaysAgo), daysExpr(accessedDaysAgo),
	)
	if err != nil {
		t.Fatalf("insert trip %q: %v", token, err)
	}
	id, _ := res.LastInsertId()
	return id
}

func daysExpr(d int) string {
	// Negative input == past
	if d >= 0 {
		return "+0 days" // treat 0 and positive as "now" for test simplicity
	}
	return formatNegDays(d)
}

func formatNegDays(d int) string {
	return itoa(d) + " days"
}

func itoa(n int) string {
	// '-n' or '+n'
	neg := n < 0
	if neg {
		n = -n
	}
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

func tripExists(t *testing.T, token string) bool {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM trips WHERE token=?`, token).Scan(&n); err != nil {
		t.Fatalf("query trip %q: %v", token, err)
	}
	return n > 0
}

func historyCount(t *testing.T, tripID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM history WHERE trip_id=?`, tripID).Scan(&n); err != nil {
		t.Fatalf("query history: %v", err)
	}
	return n
}

func TestCleanup_DeletesStaleTrip(t *testing.T) {
	defer setupTestDB(t)()

	insertTrip(t, "stale", "Old Trip", -30, -30)

	runCleanup(15)

	if tripExists(t, "stale") {
		t.Errorf("expected stale trip to be deleted")
	}
}

func TestCleanup_KeepsRecentlyAccessedTrip(t *testing.T) {
	defer setupTestDB(t)()

	insertTrip(t, "active", "Active Trip", -90, -1) // created before 90d, accessed yesterday

	runCleanup(15)

	if !tripExists(t, "active") {
		t.Errorf("expected recently-accessed trip to be kept")
	}
}

func TestCleanup_LastAccessedBeatsUpdatedAt(t *testing.T) {
	defer setupTestDB(t)()

	// Recently updated but not acceesed - seems error case but delete for now
	id, _ := db.Exec(
		`INSERT INTO trips (token, name, created_at, updated_at, last_accessed_at)
		 VALUES ('forgotten', 'Forgotten', datetime('now','-100 days'), datetime('now','-1 days'), datetime('now','-60 days'))`,
	)
	_ = id

	runCleanup(30)

	if tripExists(t, "forgotten") {
		t.Errorf("expected forgotten trip (stale last_accessed_at) to be deleted")
	}
}

func TestCleanup_AgeFloorProtectsNewTrips(t *testing.T) {
	defer setupTestDB(t)()

	// Created 3 days ago, never accessed since. Even with a 1-day threshold,
	// the 7-day age floor should keep this alive.
	insertTrip(t, "newish", "Newish Trip", -3, -3) // never accessed since created 3 days ago

	runCleanup(1)

	if !tripExists(t, "newish") { // keep alive since created less than 7d
		t.Errorf("expected newish trip to be protected by age floor")
	}
}

func TestCleanup_CascadesHistory(t *testing.T) {
	defer setupTestDB(t)()

	id := insertTrip(t, "doomed", "Doomed", -30, -30)
	logHistory(id, "create_trip", "Created", nil)
	logHistory(id, "update_trip", "Updated", nil)

	if got := historyCount(t, id); got != 2 {
		t.Fatalf("expected 2 history rows before cleanup, got %d", got)
	}

	runCleanup(15)

	if tripExists(t, "doomed") {
		t.Fatalf("trip should be deleted")
	}
	if got := historyCount(t, id); got != 0 {
		t.Errorf("expected history rows to cascade-delete, got %d", got)
	}
}

func TestCleanup_MixedTrips(t *testing.T) {
	defer setupTestDB(t)()

	insertTrip(t, "kill1", "Stale 1", -40, -40)
	insertTrip(t, "kill2", "Stale 2", -60, -35)
	insertTrip(t, "keep1", "Active", -40, -2)
	insertTrip(t, "keep2", "Brand new", -3, -3) // protected by age floor

	runCleanup(30)

	for _, tok := range []string{"kill1", "kill2"} {
		if tripExists(t, tok) {
			t.Errorf("expected %q to be deleted", tok)
		}
	}
	for _, tok := range []string{"keep1", "keep2"} {
		if !tripExists(t, tok) {
			t.Errorf("expected %q to be kept", tok)
		}
	}
}

func TestStartCleanupWorker_DisabledWhenZero(t *testing.T) {
	defer setupTestDB(t)()

	insertTrip(t, "stale", "Old", -100, -100)

	// thresholdDays=0 should be a no-op
	startCleanupWorker(0)

	if !tripExists(t, "stale") {
		t.Errorf("worker should be disabled when threshold=0")
	}
}
