package connectors

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
)

// Fixtures shaped like future connectors. They exist only in tests: #94
// declares no real connector, and nothing here reads a real source.
func suricataDef() Definition {
	return Definition{
		ID: "suricata", Name: "Suricata", Type: TypeNetworkDetection, Source: "suricata",
		Capabilities:     []Capability{CapabilityRead, CapabilitySync, CapabilityProduceFindings, CapabilityProduceObservations},
		Permissions:      Permissions{LocalRead: true},
		Inputs:           []Input{{Kind: InputFile, Format: "EVE JSON"}},
		Outputs:          []Output{{Kind: OutputFinding}, {Kind: OutputObservation}},
		NaturalEntityRef: true,
		StaleAfter:       time.Hour,
		Limits:           Limits{Timeout: 30 * time.Second, Streaming: true},
	}
}

func netalertxDef() Definition {
	return Definition{
		ID: "netalertx", Name: "NetAlertX", Type: TypeNetworkInventory, Source: "netalertx",
		Capabilities: []Capability{CapabilityRead, CapabilitySync, CapabilityProduceObservations},
		Permissions:  Permissions{NetworkRead: true},
		Inputs:       []Input{{Kind: InputLocalAPI, Format: "NetAlertX API"}},
		Outputs:      []Output{{Kind: OutputAsset}, {Kind: OutputObservation}},
		Limits:       Limits{Timeout: 15 * time.Second, MaxPayloadBytes: 10 << 20},
	}
}

func appsecDef() Definition {
	return Definition{
		ID: "appsec-audit", Name: "AppSec Audit", Type: TypeAppSec, Source: "appsec-audit",
		Capabilities: []Capability{CapabilityImport, CapabilityProduceFindings},
		Permissions:  Permissions{LocalRead: true},
		Inputs:       []Input{{Kind: InputUpload, Format: "rapport JSON"}},
		Outputs:      []Output{{Kind: OutputFinding}},
		Limits:       Limits{Timeout: time.Minute, MaxPayloadBytes: 20 << 20},
	}
}

func TestDefinitionsValid(t *testing.T) {
	for _, d := range []Definition{suricataDef(), netalertxDef(), appsecDef()} {
		if err := d.Validate(); err != nil {
			t.Fatalf("%s: %v", d.ID, err)
		}
		if !d.Permissions.ReadOnly() {
			t.Fatalf("%s must be read-only", d.ID)
		}
	}
}

func TestDefinitionValidationRejects(t *testing.T) {
	cases := map[string]func(*Definition){
		"uuid-like id":         func(d *Definition) { d.ID = "Suricata_1" },
		"empty id":             func(d *Definition) { d.ID = "" },
		"empty name":           func(d *Definition) { d.Name = "  " },
		"unknown type":         func(d *Definition) { d.Type = "scanner" },
		"empty source":         func(d *Definition) { d.Source = "" },
		"uppercase source":     func(d *Definition) { d.Source = "Suricata" },
		"no capability":        func(d *Definition) { d.Capabilities = nil },
		"exec capability":      func(d *Definition) { d.Capabilities = append(d.Capabilities, "execute_command") },
		"duplicate capability": func(d *Definition) { d.Capabilities = append(d.Capabilities, CapabilityRead) },
		"no input":             func(d *Definition) { d.Inputs = nil },
		"no output":            func(d *Definition) { d.Outputs = nil },
		"unknown input":        func(d *Definition) { d.Inputs = []Input{{Kind: "shell", Format: "x"}} },
		"input without format": func(d *Definition) { d.Inputs = []Input{{Kind: InputFile}} },
		"file without perm":    func(d *Definition) { d.Permissions = Permissions{NetworkRead: true} },
		"remote without inet":  func(d *Definition) { d.Inputs = []Input{{Kind: InputRemoteAPI, Format: "x"}} },
		"findings without out": func(d *Definition) { d.Outputs = []Output{{Kind: OutputObservation}} },
		"finding out without cap": func(d *Definition) {
			d.Capabilities = []Capability{CapabilityRead, CapabilityProduceObservations}
		},
		"import without upload": func(d *Definition) { d.Capabilities = append(d.Capabilities, CapabilityImport) },
		"negative stale":        func(d *Definition) { d.StaleAfter = -time.Second },
		"no timeout":            func(d *Definition) { d.Limits.Timeout = 0 },
		"negative timeout":      func(d *Definition) { d.Limits.Timeout = -time.Second },
		"timeout too long":      func(d *Definition) { d.Limits.Timeout = MaxTimeout + time.Second },
		"negative payload":      func(d *Definition) { d.Limits = Limits{Timeout: time.Second, MaxPayloadBytes: -1} },
		"implicit unlimited":    func(d *Definition) { d.Limits = Limits{Timeout: time.Second} },
		"streaming with global payload": func(d *Definition) {
			d.Limits = Limits{Timeout: time.Second, MaxPayloadBytes: 1 << 20, Streaming: true}
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			d := suricataDef()
			mutate(&d)
			if err := d.Validate(); !errors.Is(err, ErrInvalidDefinition) {
				t.Fatalf("want ErrInvalidDefinition, got %v", err)
			}
		})
	}
}

func TestPermissionsZeroValueGrantsNothing(t *testing.T) {
	var p Permissions
	if p.LocalRead || p.NetworkRead || p.Internet || p.LocalWrite || !p.ReadOnly() {
		t.Fatalf("zero permissions must grant nothing: %+v", p)
	}
	if (Permissions{LocalWrite: true}).ReadOnly() {
		t.Fatal("local_write is not read-only")
	}
}

func TestRegistryUniqueIDsAndSources(t *testing.T) {
	if _, err := NewRegistry(suricataDef(), suricataDef()); !errors.Is(err, ErrInvalidDefinition) {
		t.Fatalf("duplicate id: %v", err)
	}
	other := netalertxDef()
	other.Source = "suricata"
	if _, err := NewRegistry(suricataDef(), other); !errors.Is(err, ErrInvalidDefinition) {
		t.Fatalf("duplicate source: %v", err)
	}
	invalid := suricataDef()
	invalid.Type = ""
	if _, err := NewRegistry(invalid); err == nil {
		t.Fatal("invalid definition must be rejected")
	}
	r := MustNewRegistry(suricataDef(), appsecDef(), netalertxDef())
	snaps := r.Snapshots(time.Now())
	if len(snaps) != 3 || snaps[0].ID != "appsec-audit" || snaps[1].ID != "netalertx" || snaps[2].ID != "suricata" {
		t.Fatalf("snapshots must be sorted by id: %+v", snaps)
	}
	if _, ok := r.Snapshot("zeek", time.Now()); ok {
		t.Fatal("unknown id must not be found")
	}
}

func TestDefaultRegistryIsValidAndDeclaresNoConnectorYet(t *testing.T) {
	if got := Default.Snapshots(time.Now()); len(got) != 0 {
		t.Fatalf("#94 must not declare real connectors, got %d", len(got))
	}
}

func TestStatusesAndEnabledAreSeparate(t *testing.T) {
	now := time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)
	def := suricataDef()
	for _, s := range []Status{StatusDisabled, StatusReady, StatusUnavailable, StatusDegraded, StatusSyncing, StatusError} {
		if !IsValidStatus(s) {
			t.Fatalf("%s must be valid", s)
		}
	}
	if IsValidStatus("broken") {
		t.Fatal("unknown status must be invalid")
	}
	// enabled=false always reports disabled, whatever the runtime says.
	if s := BuildSnapshot(def, false, RuntimeState{Status: StatusReady}, now); s.Status != StatusDisabled || s.Enabled {
		t.Fatalf("disabled: %+v", s)
	}
	// enabled but never probed: not known to be there.
	if s := BuildSnapshot(def, true, RuntimeState{}, now); s.Status != StatusUnavailable || !s.Enabled || !s.NeverSynced {
		t.Fatalf("enabled, unprobed: %+v", s)
	}
	for _, st := range []Status{StatusReady, StatusUnavailable, StatusDegraded, StatusSyncing, StatusError} {
		if s := BuildSnapshot(def, true, RuntimeState{Status: st}, now); s.Status != st || !s.Enabled {
			t.Fatalf("enabled %s: %+v", st, s)
		}
	}
	// A runtime "disabled" cannot override the user's choice to enable.
	if s := BuildSnapshot(def, true, RuntimeState{Status: StatusDisabled}, now); s.Status == StatusDisabled {
		t.Fatal("status disabled must come from enabled=false only")
	}
}

func TestStateLifecycleUnavailableIsNotError(t *testing.T) {
	store := NewStateStore()
	t0 := time.Date(2026, 10, 26, 8, 0, 0, 0, time.UTC)
	store.BeginSync("zeek", t0)
	if st := store.Get("zeek"); st.Status != StatusSyncing || st.LastSync == nil || st.LastSuccess != nil {
		t.Fatalf("syncing: %+v", st)
	}
	store.SyncFailed("zeek", NewError("source_absent", "Zeek n'est pas installé", t0), true)
	if st := store.Get("zeek"); st.Status != StatusUnavailable || st.LastError.Code != "source_absent" {
		t.Fatalf("unavailable: %+v", st)
	}
	store.SyncFailed("zeek", NewError("parse_failed", "Journal illisible", t0), false)
	if st := store.Get("zeek"); st.Status != StatusError {
		t.Fatalf("error: %+v", st)
	}
	// A later success clears the error status but keeps the last error visible.
	t1 := t0.Add(time.Minute)
	store.SyncSucceeded("zeek", t1, false)
	st := store.Get("zeek")
	if st.Status != StatusReady || !st.LastSuccess.Equal(t1) || st.LastError == nil {
		t.Fatalf("ready after error: %+v", st)
	}
	store.SyncSucceeded("zeek", t1, true)
	if store.Get("zeek").Status != StatusDegraded {
		t.Fatal("partial success must be degraded")
	}
	// Unavailable after a success: the last known data stays dated.
	store.SyncFailed("zeek", NewError("source_absent", "absent", t1.Add(time.Hour)), true)
	if st := store.Get("zeek"); st.Status != StatusUnavailable || !st.LastSuccess.Equal(t1) {
		t.Fatalf("unavailable keeps last success: %+v", st)
	}
}

func TestFreshnessIsComputed(t *testing.T) {
	def := suricataDef() // StaleAfter: 1h
	success := time.Date(2026, 10, 26, 8, 0, 0, 0, time.UTC)
	state := RuntimeState{Status: StatusReady, LastSync: &success, LastSuccess: &success}
	if s := BuildSnapshot(def, true, state, success.Add(30*time.Minute)); s.Stale || s.NeverSynced {
		t.Fatalf("fresh: %+v", s)
	}
	if s := BuildSnapshot(def, true, state, success.Add(2*time.Hour)); !s.Stale {
		t.Fatalf("old data must be stale: %+v", s)
	}
	unavailable := state
	unavailable.Status = StatusUnavailable
	if s := BuildSnapshot(def, true, unavailable, success.Add(2*time.Hour)); !s.Stale || s.LastSuccess == nil {
		t.Fatalf("unavailable with last known data: %+v", s)
	}
	if s := BuildSnapshot(def, true, RuntimeState{Status: StatusReady}, success); !s.NeverSynced || s.Stale {
		t.Fatalf("ready, never synced: %+v", s)
	}
	untracked := netalertxDef() // StaleAfter: 0
	if s := BuildSnapshot(untracked, true, state, success.Add(1000*time.Hour)); s.Stale {
		t.Fatal("freshness not tracked must never be stale")
	}
}

func TestNewErrorIsConcise(t *testing.T) {
	at := time.Date(2026, 10, 26, 8, 0, 0, 0, time.FixedZone("x", 3600))
	e := NewError("parse_failed", "ligne 1\n\tgoroutine 1 [running]:\x00"+strings.Repeat("é", 400), at)
	if strings.ContainsAny(e.Message, "\n\t\x00") || len([]rune(e.Message)) != maxErrorMessage || e.At.Location() != time.UTC {
		t.Fatalf("error not sanitized: %q", e.Message)
	}
}

func TestNewFindingProvenance(t *testing.T) {
	now := time.Date(2026, 10, 26, 8, 0, 0, 0, time.UTC)
	def := suricataDef()
	f, err := def.NewFinding(FindingDraft{
		Category: "ids_alert", Title: "ET SCAN Nmap", EntityRef: " sid:2010937 ", Severity: "medium",
		Evidence: []models.FindingEvidence{{Label: "Règle", Value: "2010937"}, {Label: "Capteur", Value: "eth0", Source: "suricata-eth0"}},
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	if f.SourceType != string(TypeNetworkDetection) || f.Source != "suricata" || f.EntityRef != "sid:2010937" {
		t.Fatalf("provenance: %+v", f)
	}
	if f.Evidence[0].Source != "suricata" || f.Evidence[1].Source != "suricata-eth0" {
		t.Fatalf("evidence source must default to the connector: %+v", f.Evidence)
	}
	if !f.FirstSeen.Equal(now) || f.Status != "" {
		t.Fatalf("timestamps/status: %+v", f)
	}
	// Rewording the title keeps the identity: entity_ref is the identity.
	again, _ := def.NewFinding(FindingDraft{Category: "ids_alert", Title: "Nmap scan detected", EntityRef: "sid:2010937"}, now)
	if models.FindingFingerprint(f.Identity()) != models.FindingFingerprint(again.Identity()) {
		t.Fatal("same entity_ref must give the same fingerprint")
	}
}

func TestNewFindingRequiresStableRefWhenSourceHasOne(t *testing.T) {
	now := time.Now()
	if _, err := suricataDef().NewFinding(FindingDraft{Category: "ids_alert", Title: "ET SCAN"}, now); !errors.Is(err, ErrMissingEntityRef) {
		t.Fatalf("want ErrMissingEntityRef, got %v", err)
	}
	// A source without natural ids may fall back on the title.
	f, err := appsecDef().NewFinding(FindingDraft{Category: "dependency", Title: "Version vulnérable"}, now)
	if err != nil || f.EntityRef != "" || f.Severity != models.FindingSeverityUnknown {
		t.Fatalf("title fallback: %+v %v", f, err)
	}
	if _, err := netalertxDef().NewFinding(FindingDraft{Category: "c", Title: "t"}, now); !errors.Is(err, ErrNotAFindingProducer) {
		t.Fatalf("want ErrNotAFindingProducer, got %v", err)
	}
	if _, err := appsecDef().NewFinding(FindingDraft{Category: "dependency"}, now); !errors.Is(err, models.ErrFindingInvalid) {
		t.Fatalf("invalid draft must be refused by Finding validation, got %v", err)
	}
}

func TestLimitsDeclaration(t *testing.T) {
	bounded := netalertxDef()
	if err := bounded.Validate(); err != nil || bounded.Limits.Streaming || bounded.Limits.MaxPayloadBytes != 10<<20 {
		t.Fatalf("bounded connector: %+v %v", bounded.Limits, err)
	}
	streaming := suricataDef()
	if err := streaming.Validate(); err != nil || !streaming.Limits.Streaming || streaming.Limits.MaxPayloadBytes != 0 {
		t.Fatalf("streaming connector: %+v %v", streaming.Limits, err)
	}
	// Exactly MaxTimeout is still a bounded operation.
	bounded.Limits.Timeout = MaxTimeout
	if err := bounded.Validate(); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(Limits{Timeout: 1500 * time.Millisecond, MaxPayloadBytes: 2048})
	if err != nil || string(raw) != `{"timeout_ms":1500,"max_payload_bytes":2048,"streaming":false}` {
		t.Fatalf("limits JSON: %s %v", raw, err)
	}
}
