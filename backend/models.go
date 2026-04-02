package main

import "time"

// Trip represents a travel plan accessible via unique token
type Trip struct {
	ID          int64     `json:"id"`
	Token       string    `json:"token"`
	Name        string    `json:"name"`
	Destination string    `json:"destination"`
	StartDate   string    `json:"start_date"`
	EndDate     string    `json:"end_date"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Event represents a scheduled item within a trip
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

// TripWithEvents is the full trip payload sent to the frontend
type TripWithEvents struct {
	Trip   Trip    `json:"trip"`
	Events []Event `json:"events"`
}

// Request types for JSON decoding

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
