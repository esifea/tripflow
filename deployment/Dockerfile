FROM golang:1.25-alpine AS builder

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -o tripflow .

FROM alpine:3.21

WORKDIR /app
COPY --from=builder /build/tripflow .
COPY static/ ./static/

EXPOSE 18080

VOLUME /app/data

ENV DB_PATH=/app/data/tripflow.db
ENV PORT=18080

CMD ["./tripflow"]
