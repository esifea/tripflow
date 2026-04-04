package main

import "time"

// Travel plan
type Trip struct {
	ID          int64     `json:"id"`
	Token       string    `json:"token"`
	Name        string    `json:"name"`
	Destination string    `json:"destination"`
	StartDate   string    `json:"start_date"`
	EndDate     string    `json:"end_date"`
	Memo        string    `json:"memo"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Scheduled item within a trip
type Event struct {
	ID          int64     `json:"id"`
	TripID      int64     `json:"trip_id"`
	DayNumber   int       `json:"day_number"`
	StartTime   string    `json:"start_time"`
	EndTime     string    `json:"end_time"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Location    string    `json:"location"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
}

type TripWithEvents struct {
	Trip   Trip    `json:"trip"`
	Events []Event `json:"events"`
}

type CreateTripRequest struct {
	Name        string `json:"name"`
	Destination string `json:"destination"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
}

type UpdateTripRequest struct {
	Name        string `json:"name"`
	Destination string `json:"destination"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	Memo        string `json:"memo"`
}

type CreateEventRequest struct {
	DayNumber   int    `json:"day_number"`
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Location    string `json:"location"`
	SortOrder   int    `json:"sort_order"`
}

type UpdateEventRequest struct {
	DayNumber   int    `json:"day_number"`
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Location    string `json:"location"`
	SortOrder   int    `json:"sort_order"`
}

type History struct {
	ID        int64     `json:"id"`
	TripID    int64     `json:"trip_id"`
	Action    string    `json:"action"`
	Detail    string    `json:"detail"`
	Snapshot  string    `json:"snapshot_data"`
	CreatedAt time.Time `json:"created_at"`
}

type HistoryResponse struct {
	History []History `json:"history"`
}
