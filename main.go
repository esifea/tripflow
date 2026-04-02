package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

const (
	defaultPort      = "8080"
	defaultStaticDir = "./static"
	defaultDBPath    = "tripflow.db"
	shutdownTimeout  = 5 * time.Second
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = defaultStaticDir
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = defaultDBPath
	}

	// Initialize database
	if err := initDB(dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer closeDB()

	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/trips", handleTripRouter)
	mux.HandleFunc("/api/trips/", handleTripRouter)

	// Static files
	staticFS := http.FileServer(http.Dir(staticDir))
	mux.Handle("/static/", http.StripPrefix("/static/", staticFS))

	// SPA fallback
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Serve static files directly if they exist
		if path != "/" && !strings.HasPrefix(path, "/plan/") {
			filePath := staticDir + path
			if _, err := os.Stat(filePath); err == nil {
				http.ServeFile(w, r, filePath)
				return
			}
		}

		// SPA: serve index.html for / and /plan/{token}
		http.ServeFile(w, r, staticDir+"/index.html")
	})

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      logMiddleware(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("[INFO] TripFlow server starting on http://localhost:%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	<-done
	log.Println("[INFO] Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server shutdown failed: %v", err)
	}

	log.Println("[INFO] Server stopped gracefully")
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"ok","time":"%s"}`, time.Now().Format(time.RFC3339))
}

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Microsecond))
	})
}
