package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"
)

func generateToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func handleCreateTrip(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req CreateTripRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req = CreateTripRequest{}
	}

	token, err := generateToken()
	if err != nil {
		log.Printf("Error generating token: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	if req.Name == "" {
		req.Name = "Untitled Trip"
	}
	if req.StartDate == "" {
		req.StartDate = time.Now().Format("2006-01-02")
	}

	result, err := db.Exec(
		`INSERT INTO trips (token, name, destination, start_date, end_date) VALUES (?, ?, ?, ?, ?)`,
		token, req.Name, req.Destination, req.StartDate, req.EndDate,
	)
	if err != nil {
		log.Printf("Error creating trip: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to create trip")
		return
	}

	id, _ := result.LastInsertId()
	trip := Trip{
		ID:          id,
		Token:       token,
		Name:        req.Name,
		Destination: req.Destination,
		StartDate:   req.StartDate,
		EndDate:     req.EndDate,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	log.Printf("[INFO] Trip created: %s (token: %s)", trip.Name, trip.Token)
	logHistory(trip.ID, "create_trip", "Created new trip", nil)
	writeJSON(w, http.StatusCreated, trip)
}

func handleGetTrip(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	token := extractToken(r.URL.Path, "/api/trips/")
	if token == "" {
		writeError(w, http.StatusBadRequest, "missing trip token")
		return
	}

	if strings.Contains(token, "/") {
		return
	}

	trip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	events, err := getEventsByTripID(trip.ID)
	if err != nil {
		log.Printf("Error fetching events: %v", err)
		events = []Event{}
	}

	writeJSON(w, http.StatusOK, TripWithEvents{Trip: trip, Events: events})
}

func handleUpdateTrip(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	token := extractToken(r.URL.Path, "/api/trips/")
	if token == "" || strings.Contains(token, "/") {
		writeError(w, http.StatusBadRequest, "missing trip token")
		return
	}

	trip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	var req UpdateTripRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Keep existing values if not provided
	prevTrip, err := getTripByToken(token)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	if req.Name == "" {
		req.Name = prevTrip.Name
	}

	_, err = db.Exec(
		`UPDATE trips SET name=?, destination=?, start_date=?, end_date=?, updated_at=CURRENT_TIMESTAMP WHERE token=?`,
		req.Name, req.Destination, req.StartDate, req.EndDate, token,
	)
	if err != nil {
		log.Printf("Error updating trip: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to update trip")
		return
	}

	updated, _ := getTripByToken(token)
	logHistory(trip.ID, "update_trip", "Updated trip metadata", prevTrip)
	writeJSON(w, http.StatusOK, updated)
}

func handleDeleteTrip(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	token := extractToken(r.URL.Path, "/api/trips/")
	if token == "" || strings.Contains(token, "/") {
		writeError(w, http.StatusBadRequest, "missing trip token")
		return
	}

	result, err := db.Exec(`DELETE FROM trips WHERE token=?`, token)
	if err != nil {
		log.Printf("Error deleting trip: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to delete trip")
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeError(w, http.StatusNotFound, "trip not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// /api/trips/*
func handleTripRouter(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// POST /api/trips: create
	if path == "/api/trips" || path == "/api/trips/" {
		handleCreateTrip(w, r)
		return
	}

	// Check if this is an events sub-route
	if strings.Contains(path, "/events") {
		handleEventRouter(w, r)
		return
	}

	// Check if this is a history sub-route
	if strings.Contains(path, "/history") {
		handleHistoryRouter(w, r)
		return
	}

	// GET/PUT/DELETE /api/trips/{token}
	switch r.Method {
	case http.MethodGet:
		handleGetTrip(w, r)
	case http.MethodPut:
		handleUpdateTrip(w, r)
	case http.MethodDelete:
		handleDeleteTrip(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

//--- DB helpers ---//

func getTripByToken(token string) (Trip, error) {
	var t Trip
	err := db.QueryRow(
		`SELECT id, token, name, destination, start_date, end_date, created_at, updated_at FROM trips WHERE token=?`,
		token,
	).Scan(&t.ID, &t.Token, &t.Name, &t.Destination, &t.StartDate, &t.EndDate, &t.CreatedAt, &t.UpdatedAt)
	return t, err
}

func extractToken(path, prefix string) string {
	if !strings.HasPrefix(path, prefix) {
		return ""
	}
	rest := strings.TrimPrefix(path, prefix)
	// Return first path segment
	if i := strings.Index(rest, "/"); i >= 0 {
		return rest[:i]
	}
	return rest
}
