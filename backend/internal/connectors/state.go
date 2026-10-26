package connectors

import (
	"strings"
	"sync"
	"time"
	"unicode"
)

// Status is the runtime state of a connector, separate from Enabled (the
// user's choice).
type Status string

const (
	// StatusDisabled: the user turned the connector off. Always wins.
	StatusDisabled Status = "disabled"
	// StatusReady: enabled, the source is reachable, the last operation succeeded.
	StatusReady Status = "ready"
	// StatusUnavailable: enabled but the source is absent (Zeek not
	// installed, NetAlertX not running). Not a CyberHub failure.
	StatusUnavailable Status = "unavailable"
	// StatusDegraded: works partially (some files unreadable, partial sync).
	StatusDegraded Status = "degraded"
	// StatusSyncing: a sync is in progress.
	StatusSyncing Status = "syncing"
	// StatusError: the source is there but the last operation failed.
	StatusError Status = "error"
)

var validStatuses = map[Status]bool{StatusDisabled: true, StatusReady: true, StatusUnavailable: true, StatusDegraded: true, StatusSyncing: true, StatusError: true}

// IsValidStatus reports whether s is one of the six statuses.
func IsValidStatus(s Status) bool { return validStatuses[s] }

const maxErrorMessage = 300

// Error is the concise, user-facing description of the last failure. It
// never carries a stack trace, a raw upstream error or configuration.
type Error struct {
	Code    string    `json:"code"`    // machine-readable: "source_unreachable", "parse_failed"
	Message string    `json:"message"` // short sentence for the user
	At      time.Time `json:"at"`
}

// NewError builds an Error from a code and a message written by the
// connector. Control characters are removed and the message is truncated:
// a connector must never pass err.Error() of an upstream call here.
func NewError(code, message string, at time.Time) Error {
	clean := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, message)
	clean = strings.Join(strings.Fields(clean), " ")
	if runes := []rune(clean); len(runes) > maxErrorMessage {
		clean = string(runes[:maxErrorMessage])
	}
	return Error{Code: code, Message: clean, At: at.UTC()}
}

// RuntimeState is what changes while the application runs.
type RuntimeState struct {
	Status Status
	// LastSync is the last sync attempt, successful or not.
	LastSync *time.Time
	// LastSuccess is the last successful sync. Data from it stays
	// consultable even if the connector is now unavailable.
	LastSuccess *time.Time
	// LastError is the last failure. It is kept for information after a
	// later success; it does not make the connector "error" by itself.
	LastError *Error
}

// Snapshot is the public view of a connector: definition, user choice,
// runtime state and computed freshness.
type Snapshot struct {
	Definition
	Enabled     bool       `json:"enabled"`
	Status      Status     `json:"status"`
	LastSync    *time.Time `json:"last_sync"`
	LastSuccess *time.Time `json:"last_success"`
	NeverSynced bool       `json:"never_synced"`
	// Stale is computed from LastSuccess and StaleAfter, never stored.
	Stale     bool   `json:"stale"`
	LastError *Error `json:"last_error"`
}

// BuildSnapshot combines the static definition, the user choice and the
// runtime state at time now.
func BuildSnapshot(def Definition, enabled bool, state RuntimeState, now time.Time) Snapshot {
	status := state.Status
	switch {
	case !enabled:
		status = StatusDisabled
	case status == "" || status == StatusDisabled || !IsValidStatus(status):
		// Enabled but nothing probed yet: the source is not known to be there.
		status = StatusUnavailable
	}
	snap := Snapshot{
		Definition:  def,
		Enabled:     enabled,
		Status:      status,
		LastSync:    state.LastSync,
		LastSuccess: state.LastSuccess,
		NeverSynced: state.LastSuccess == nil,
		LastError:   state.LastError,
	}
	if def.StaleAfter > 0 && state.LastSuccess != nil {
		snap.Stale = now.Sub(*state.LastSuccess) > def.StaleAfter
	}
	return snap
}

// StateStore keeps runtime state in memory. It is not persisted: after a
// restart every connector is probed again. Safe for concurrent use.
type StateStore struct {
	mu     sync.RWMutex
	states map[string]RuntimeState
}

// NewStateStore returns an empty store.
func NewStateStore() *StateStore { return &StateStore{states: map[string]RuntimeState{}} }

// Get returns the state of id (zero value when unknown).
func (s *StateStore) Get(id string) RuntimeState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.states[id]
}

// SetStatus records a probe result (ready, unavailable, degraded...).
func (s *StateStore) SetStatus(id string, status Status) {
	s.update(id, func(st *RuntimeState) { st.Status = status })
}

// BeginSync marks a sync attempt.
func (s *StateStore) BeginSync(id string, at time.Time) {
	s.update(id, func(st *RuntimeState) {
		t := at.UTC()
		st.Status, st.LastSync = StatusSyncing, &t
	})
}

// SyncSucceeded records a successful sync; degraded is for partial results.
// The previous error stays visible but no longer drives the status.
func (s *StateStore) SyncSucceeded(id string, at time.Time, degraded bool) {
	s.update(id, func(st *RuntimeState) {
		t := at.UTC()
		st.LastSync, st.LastSuccess = &t, &t
		st.Status = StatusReady
		if degraded {
			st.Status = StatusDegraded
		}
	})
}

// SyncFailed records a failed sync. unavailable distinguishes an absent
// source from a real error.
func (s *StateStore) SyncFailed(id string, failure Error, unavailable bool) {
	s.update(id, func(st *RuntimeState) {
		t := failure.At
		st.LastSync, st.LastError = &t, &failure
		st.Status = StatusError
		if unavailable {
			st.Status = StatusUnavailable
		}
	})
}

func (s *StateStore) update(id string, apply func(*RuntimeState)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.states[id]
	apply(&st)
	s.states[id] = st
}
