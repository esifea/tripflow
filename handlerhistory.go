package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func handleGetHistory(w http.ResponseWriter, r *http.Request, token string) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	trip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	rows, err := db.Query(
		`SELECT id, trip_id, action, detail, snapshot_data, created_at FROM history WHERE trip_id = ? AND action != 'recover' ORDER BY id DESC`,
		trip.ID,
	)
	if err != nil {
		log.Printf("[WARN] Failed to fetch history: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to get history")
		return
	}
	defer rows.Close()

	var histories []History
	for rows.Next() {
		var h History
		if err := rows.Scan(&h.ID, &h.TripID, &h.Action, &h.Detail, &h.Snapshot, &h.CreatedAt); err != nil {
			log.Printf("[WARN] Error scanning history: %v", err)
			continue
		}
		histories = append(histories, h)
	}

	writeJSON(w, http.StatusOK, HistoryResponse{History: histories})
}

func handleRecoverHistory(w http.ResponseWriter, r *http.Request, token string, historyID int64) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	trip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	// 1. Fetch History record
	var h History
	err = db.QueryRow(
		`SELECT id, trip_id, action, detail, snapshot_data FROM history WHERE id = ? AND trip_id = ?`,
		historyID, trip.ID,
	).Scan(&h.ID, &h.TripID, &h.Action, &h.Detail, &h.Snapshot)

	if err != nil {
		writeError(w, http.StatusNotFound, "history record not found")
		return
	}

	// 2. Perform Recovery based on Action
	switch h.Action {
	case "add_event":
		var createdEvent Event
		if err := json.Unmarshal([]byte(h.Snapshot), &createdEvent); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to parse event snapshot")
			return
		}
		if _, err = db.Exec(`DELETE FROM events WHERE id=?`, createdEvent.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to recover (delete) event")
			return
		}
		// Delete all history entries that reference this event (add/update/delete for it)
		likePattern := fmt.Sprintf(`{"id":%d,%%`, createdEvent.ID)
		if _, err = db.Exec(`DELETE FROM history WHERE trip_id = ? AND snapshot_data LIKE ?`, trip.ID, likePattern); err != nil {
			log.Printf("[WARN] Failed to clean up event history: %v", err)
		}

	case "update_trip":
		var prevTrip Trip
		if err := json.Unmarshal([]byte(h.Snapshot), &prevTrip); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to parse trip snapshot")
			return
		}
		if _, err = db.Exec(
			`UPDATE trips SET name=?, destination=?, start_date=?, end_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
			prevTrip.Name, prevTrip.Destination, prevTrip.StartDate, prevTrip.EndDate, trip.ID,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to recover trip")
			return
		}
		// Delete events outside the restored date range
		deleteOrphanedEvents(trip.ID, prevTrip.StartDate, prevTrip.EndDate)
		// Delete only this history entry
		db.Exec(`DELETE FROM history WHERE id = ?`, h.ID)

	case "update_event", "delete_event":
		var prevEvent Event
		if err := json.Unmarshal([]byte(h.Snapshot), &prevEvent); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to parse event snapshot")
			return
		}
		var exists int
		db.QueryRow(`SELECT 1 FROM events WHERE id = ?`, prevEvent.ID).Scan(&exists)
		if exists == 1 {
			_, err = db.Exec(
				`UPDATE events SET day_number=?, start_time=?, end_time=?, title=?, description=?, location=?, sort_order=? WHERE id=?`,
				prevEvent.DayNumber, prevEvent.StartTime, prevEvent.EndTime, prevEvent.Title, prevEvent.Description, prevEvent.Location, prevEvent.SortOrder, prevEvent.ID,
			)
		} else {
			_, err = db.Exec(
				`INSERT INTO events (id, trip_id, day_number, start_time, end_time, title, description, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				prevEvent.ID, prevEvent.TripID, prevEvent.DayNumber, prevEvent.StartTime, prevEvent.EndTime, prevEvent.Title, prevEvent.Description, prevEvent.Location, prevEvent.SortOrder,
			)
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to recover event")
			return
		}
		// Delete only this history entry
		db.Exec(`DELETE FROM history WHERE id = ?`, h.ID)

	default:
		writeError(w, http.StatusBadRequest, "cannot recover this action type")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "recovered"})
}

func deleteOrphanedEvents(tripID int64, startDate, endDate string) {
	var eventIDs []int64

	if startDate == "" || endDate == "" {
		// No date range: all events are orphaned
		rows, err := db.Query(`SELECT id FROM events WHERE trip_id = ?`, tripID)
		if err != nil {
			log.Printf("[WARN] Failed to query events for cleanup: %v", err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			rows.Scan(&id)
			eventIDs = append(eventIDs, id)
		}
		db.Exec(`DELETE FROM events WHERE trip_id = ?`, tripID)
	} else {
		start, err1 := time.Parse("2006-01-02", startDate)
		end, err2 := time.Parse("2006-01-02", endDate)
		if err1 != nil || err2 != nil {
			return
		}
		totalDays := int(end.Sub(start).Hours()/24) + 1
		if totalDays <= 0 {
			return
		}
		rows, err := db.Query(`SELECT id FROM events WHERE trip_id = ? AND day_number > ?`, tripID, totalDays)
		if err != nil {
			log.Printf("[WARN] Failed to query out-of-range events: %v", err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			rows.Scan(&id)
			eventIDs = append(eventIDs, id)
		}
		db.Exec(`DELETE FROM events WHERE trip_id = ? AND day_number > ?`, tripID, totalDays)
	}

	// Clean up history entries for deleted events
	for _, id := range eventIDs {
		likePattern := fmt.Sprintf(`{"id":%d,%%`, id)
		db.Exec(`DELETE FROM history WHERE trip_id = ? AND snapshot_data LIKE ?`, tripID, likePattern)
	}
}

func handleHistoryRouter(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	token := extractToken(path, "/api/trips/")

	if token == "" {
		writeError(w, http.StatusBadRequest, "missing trip token")
		return
	}

	// Route: /api/trips/{token}/history
	if strings.HasSuffix(path, "/history") || strings.HasSuffix(path, "/history/") {
		handleGetHistory(w, r, token)
		return
	}

	// Route: /api/trips/{token}/history/{id}/recover
	if strings.Contains(path, "/recover") {
		parts := strings.Split(path, "/")
		if len(parts) >= 7 && parts[4] == "history" && parts[6] == "recover" {
			historyID, err := strconv.ParseInt(parts[5], 10, 64)
			if err != nil {
				writeError(w, http.StatusBadRequest, "invalid history ID")
				return
			}
			handleRecoverHistory(w, r, token, historyID)
			return
		}
	}

	writeError(w, http.StatusNotFound, "route not found")
}
