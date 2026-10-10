FROM node:24-alpine AS frontend-builder
WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci --ignore-scripts

COPY frontend/ ./
RUN npm run build

FROM golang:1.27.2-alpine AS go-builder
ENV GOTOOLCHAIN=auto
WORKDIR /build/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./

COPY --from=frontend-builder /build/backend/web/ ./web/

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /cyber-hub .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
RUN addgroup -S cyberhub && adduser -S -G cyberhub cyberhub

WORKDIR /data
COPY --from=go-builder /cyber-hub /usr/local/bin/cyber-hub
RUN chown cyberhub:cyberhub /data
USER cyberhub
ENV CYBER_HUB_LISTEN_ALL=1

VOLUME ["/data"]
EXPOSE 7743
CMD ["/usr/local/bin/cyber-hub"]
