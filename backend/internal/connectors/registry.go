package connectors

import (
	"fmt"
	"sort"
	"time"
)

// Registry holds the static connector definitions plus their runtime state.
type Registry struct {
	defs   map[string]Definition
	order  []string
	States *StateStore
}

// NewRegistry validates defs and rejects duplicate ids or sources.
func NewRegistry(defs ...Definition) (*Registry, error) {
	r := &Registry{defs: map[string]Definition{}, States: NewStateStore()}
	sources := map[string]string{}
	for _, d := range defs {
		if err := d.Validate(); err != nil {
			return nil, err
		}
		if _, dup := r.defs[d.ID]; dup {
			return nil, fmt.Errorf("%w: duplicate id %q", ErrInvalidDefinition, d.ID)
		}
		if other, dup := sources[d.Source]; dup {
			return nil, fmt.Errorf("%w: source %q used by %q and %q", ErrInvalidDefinition, d.Source, other, d.ID)
		}
		r.defs[d.ID], sources[d.Source] = d, d.ID
		r.order = append(r.order, d.ID)
	}
	sort.Strings(r.order)
	return r, nil
}

// MustNewRegistry panics on an invalid definition: definitions are code, so
// an invalid one is a programming error caught at start-up and by tests.
func MustNewRegistry(defs ...Definition) *Registry {
	r, err := NewRegistry(defs...)
	if err != nil {
		panic(err)
	}
	return r
}

// Definition returns the definition of id.
func (r *Registry) Definition(id string) (Definition, bool) {
	d, ok := r.defs[id]
	return d, ok
}

// enabled is the user choice. V1 has no persisted toggle yet, so it is the
// definition default; a later issue can back it with app settings.
func (r *Registry) enabled(d Definition) bool { return d.EnabledByDefault }

// Snapshot returns the public view of id at time now.
func (r *Registry) Snapshot(id string, now time.Time) (Snapshot, bool) {
	d, ok := r.defs[id]
	if !ok {
		return Snapshot{}, false
	}
	return BuildSnapshot(d, r.enabled(d), r.States.Get(id), now), true
}

// Snapshots lists every connector, sorted by id.
func (r *Registry) Snapshots(now time.Time) []Snapshot {
	out := make([]Snapshot, 0, len(r.order))
	for _, id := range r.order {
		s, _ := r.Snapshot(id, now)
		out = append(out, s)
	}
	return out
}

// Default is the registry of CyberHub's built-in connectors. It is empty
// until the first connector (NetAlertX, #19) is implemented: declaring
// connectors that do not exist would show sources CyberHub cannot read.
var Default = MustNewRegistry()
