FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci --ignore-scripts

COPY frontend/ ./
RUN npm run build

FROM golang:1.23-alpine AS go-builder
ENV GOTOOLCHAIN=auto
WORKDIR /build/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./

COPY --from=frontend-builder /build/backend/web/ ./web/

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /cyber-hub .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /data
COPY --from=go-builder /cyber-hub /usr/local/bin/cyber-hub

VOLUME ["/data"]
EXPOSE 7743
CMD ["/usr/local/bin/cyber-hub"]
