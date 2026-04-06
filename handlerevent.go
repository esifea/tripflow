package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
)

// /api/trips/{token}/events/*
func handleEventRouter(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Extract token and event ID from path
	// /api/trips/{token}/events or /api/trips/{token}/events/{id}
	token := extractToken(path, "/api/trips/")
	eventsPath := fmt.Sprintf("/api/trips/%s/events", token)

	if path == eventsPath || path == eventsPath+"/" {
		switch r.Method {
		case http.MethodGet:
			handleListEvents(w, r, token)
		case http.MethodPost:
			handleCreateEvent(w, r, token)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
		return
	}

	// /api/trips/{token}/events/reorder
	if strings.HasSuffix(path, "/reorder") {
		handleReorderEvents(w, r, token)
		return
	}

	// /api/trips/{token}/events/swap-days
	if strings.HasSuffix(path, "/swap-days") {
		handleSwapDays(w, r, token)
		return
	}

	// /api/trips/{token}/events/{id}
	eventIDStr := strings.TrimPrefix(path, eventsPath+"/")
	eventID, err := strconv.ParseInt(eventIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid event ID")
		return
	}

	switch r.Method {
	case http.MethodPut:
		handleUpdateEvent(w, r, token, eventID)
	case http.MethodDelete:
		handleDeleteEvent(w, r, token, eventID)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func handleListEvents(w http.ResponseWriter, r *http.Request, token string) {
	trip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	events, err := getEventsByTripID(trip.ID)
	if err != nil {
		log.Printf("Error listing events: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to list events")
		return
	}

	writeJSON(w, http.StatusOK, events)
}

func handleCreateEvent(w http.ResponseWriter, r *http.Request, token string) {
	trip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	var req CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if req.DayNumber < 1 {
		req.DayNumber = 1
	}

	// Auto sort order: append at end
	if req.SortOrder == 0 {
		var maxOrder int
		db.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) FROM events WHERE trip_id=? AND day_number=?`,
			trip.ID, req.DayNumber).Scan(&maxOrder)
		req.SortOrder = maxOrder + 1
	}

	result, err := db.Exec(
		`INSERT INTO events (trip_id, day_number, start_time, end_time, title, description, location, sort_order)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		trip.ID, req.DayNumber, req.StartTime, req.EndTime, req.Title, req.Description, req.Location, req.SortOrder,
	)
	if err != nil {
		log.Printf("Error creating event: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to create event")
		return
	}

	id, _ := result.LastInsertId()
	event := Event{
		ID:          id,
		TripID:      trip.ID,
		DayNumber:   req.DayNumber,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Title:       req.Title,
		Description: req.Description,
		Location:    req.Location,
		SortOrder:   req.SortOrder,
	}

	logHistory(trip.ID, "add_event", "Added event: "+req.Title, event)
	writeJSON(w, http.StatusCreated, event)
}

func handleUpdateEvent(w http.ResponseWriter, r *http.Request, token string, eventID int64) {
	trip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	var req UpdateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	var prevEvent Event
	err = db.QueryRow(`SELECT id, trip_id, day_number, start_time, end_time, title, description, location, sort_order, created_at FROM events WHERE id=? AND trip_id=?`, eventID, trip.ID).
		Scan(&prevEvent.ID, &prevEvent.TripID, &prevEvent.DayNumber, &prevEvent.StartTime, &prevEvent.EndTime, &prevEvent.Title, &prevEvent.Description, &prevEvent.Location, &prevEvent.SortOrder, &prevEvent.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "event not found")
		return
	}

	result, err := db.Exec(
		`UPDATE events SET day_number=?, start_time=?, end_time=?, title=?, description=?, location=?, sort_order=?
		 WHERE id=? AND trip_id=?`,
		req.DayNumber, req.StartTime, req.EndTime, req.Title, req.Description, req.Location, req.SortOrder,
		eventID, trip.ID,
	)
	if err != nil {
		log.Printf("Error updating event: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to update event")
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeError(w, http.StatusNotFound, "event not found")
		return
	}

	logHistory(trip.ID, "update_event", "Updated event: "+req.Title, prevEvent)
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func handleDeleteEvent(w http.ResponseWriter, r *http.Request, token string, eventID int64) {
	trip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	var prevEvent Event
	err = db.QueryRow(`SELECT id, trip_id, day_number, start_time, end_time, title, description, location, sort_order, created_at FROM events WHERE id=? AND trip_id=?`, eventID, trip.ID).
		Scan(&prevEvent.ID, &prevEvent.TripID, &prevEvent.DayNumber, &prevEvent.StartTime, &prevEvent.EndTime, &prevEvent.Title, &prevEvent.Description, &prevEvent.Location, &prevEvent.SortOrder, &prevEvent.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "event not found")
		return
	}

	result, err := db.Exec(`DELETE FROM events WHERE id=? AND trip_id=?`, eventID, trip.ID)
	if err != nil {
		log.Printf("Error deleting event: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to delete event")
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeError(w, http.StatusNotFound, "event not found")
		return
	}

	logHistory(trip.ID, "delete_event", fmt.Sprintf("Deleted event ID: %d", eventID), prevEvent)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func handleReorderEvents(w http.ResponseWriter, r *http.Request, token string) {
	if r.Method != http.MethodPut {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	trip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	var req ReorderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tx, err := db.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}

	for i, eventID := range req.EventIDs {
		if _, err := tx.Exec(
			`UPDATE events SET sort_order=? WHERE id=? AND trip_id=?`,
			i+1, eventID, trip.ID,
		); err != nil {
			tx.Rollback()
			log.Printf("Error reordering event %d: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "failed to reorder events")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing reorder: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to commit reorder")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "reordered"})
}

func handleSwapDays(w http.ResponseWriter, r *http.Request, token string) {
	if r.Method != http.MethodPut {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	trip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	var req SwapDaysRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.DayA == req.DayB || req.DayA < 1 || req.DayB < 1 {
		writeError(w, http.StatusBadRequest, "invalid day numbers")
		return
	}

	tx, err := db.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}

	// Use a temporary day_number (-1) to avoid unique constraint issues
	if _, err := tx.Exec(`UPDATE events SET day_number=-1 WHERE trip_id=? AND day_number=?`, trip.ID, req.DayA); err != nil {
		tx.Rollback()
		writeError(w, http.StatusInternalServerError, "failed to swap days")
		return
	}
	if _, err := tx.Exec(`UPDATE events SET day_number=? WHERE trip_id=? AND day_number=?`, req.DayA, trip.ID, req.DayB); err != nil {
		tx.Rollback()
		writeError(w, http.StatusInternalServerError, "failed to swap days")
		return
	}
	if _, err := tx.Exec(`UPDATE events SET day_number=? WHERE trip_id=? AND day_number=-1`, req.DayB, trip.ID); err != nil {
		tx.Rollback()
		writeError(w, http.StatusInternalServerError, "failed to swap days")
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing day swap: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to commit swap")
		return
	}

	logHistory(trip.ID, "update_trip", fmt.Sprintf("Swapped schedule: Day %d ↔ Day %d", req.DayA, req.DayB), nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "swapped"})
}

//--- DB helpers ---//

func getEventsByTripID(tripID int64) ([]Event, error) {
	rows, err := db.Query(
		`SELECT id, trip_id, day_number, start_time, end_time, title, description, location, sort_order, created_at
		 FROM events WHERE trip_id=? ORDER BY day_number, sort_order, start_time`,
		tripID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []Event{}
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.TripID, &e.DayNumber, &e.StartTime, &e.EndTime,
			&e.Title, &e.Description, &e.Location, &e.SortOrder, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}
