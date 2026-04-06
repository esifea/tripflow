# TripFlow

A collaborative trip planner where you can create day-by-day itineraries and share them with family and friends via a simple link

## Features

- **Itinerary builder** — create events with time, location, and notes for each day
- **Shareable links** — anyone with the link can view and edit the trip (no login required)
- **Edit history** — every change is tracked with undo/recover support
- **Day-by-day tabs** — set start and end dates, navigate by day
- **Mobile ready** — responsive design for phones, tablets, and desktops

## Tech Stack

- **Backend**: Go with [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite)
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Database**: SQLite with WAL mode
- **Architecture**: Single binary serves both the API and static frontend

## Getting Started

### Prerequisites

- Go 1.25+

### Build & Run

```sh
go build -o tripflow .
./tripflow
```

Open [http://localhost:8080](http://localhost:8080).

### Configuration

All configuration is via environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `DB_PATH` | `tripflow.db` | Path to SQLite database file |
| `STATIC_DIR` | `./static` | Path to static assets directory |

Example:

```sh
PORT=18080 DB_PATH=/data/tripflow.db ./tripflow
```

## Docker Deployment

- Docker environment use `PORT=18080` as default

Build and run with Docker (e.g., on a NAS):

```sh
docker build -t tripflow -f deployment/Dockerfile .
docker run -d -p 18080:18080 -v tripflow-data:/app/data --name tripflow tripflow
```

The database is stored in the `tripflow-data` volume, so it persists across container restarts and updates.

To rebuild and update:

```sh
docker stop tripflow && docker rm tripflow
docker build -t tripflow -f deployment/Dockerfile .
docker run -d -p 18080:18080 -v tripflow-data:/app/data --name tripflow tripflow
```

## Project Structure

```
tripflow/
├── main.go              # Server, router, middleware
├── database.go          # SQLite init, migrations, history logging
├── models.go            # Data types and request/response structs
├── handlertrip.go       # Trip CRUD API handlers
├── handlerevent.go      # Event CRUD API handlers
├── handlerhistory.go    # History & undo/recover handlers
├── main_test.go         # Tests
├── go.mod / go.sum
├── static/
│   ├── index.html       # Single-page app shell
│   ├── css/style.css    # All styles
│   └── js/app.js        # Client-side router, editor, API calls
├── deployment/
│   ├── Dockerfile       # Multi-stage Docker build
│   └── .dockerignore    # Docker build exclusions
└── tripflow.db          # SQLite database (created on first run)
```

## API

All endpoints are JSON. Trips are identified by a random URL-safe token.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/trips` | Create a new trip |
| `GET` | `/api/trips/:token` | Get trip with events |
| `PUT` | `/api/trips/:token` | Update trip metadata |
| `DELETE` | `/api/trips/:token` | Delete a trip |
| `POST` | `/api/trips/:token/events` | Add an event |
| `PUT` | `/api/trips/:token/events/:id` | Update an event |
| `DELETE` | `/api/trips/:token/events/:id` | Delete an event |
| `GET` | `/api/trips/:token/history` | Get edit history |
| `POST` | `/api/trips/:token/history/:id/recover` | Undo a history entry |

## License

MIT
