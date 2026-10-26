// Package connectors defines the minimal contract shared by CyberHub's
// internal connectors (NetAlertX, Zeek, Suricata, AppSec Audit, MISP...).
//
// Connectors are internal and known at compile time: a Definition is static
// code, never a row in a plugin registry. Only runtime state (status, last
// sync, last error) changes while the application runs. There is no plugin
// loading, no command execution and no active network action in this
// contract: a connector can only declare that it reads data.
package connectors

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// ErrInvalidDefinition wraps every definition validation error.
var ErrInvalidDefinition = errors.New("invalid connector definition")

// Type is the general category of a connector. It is the value written in
// Finding.SourceType by the connector, so both vocabularies stay aligned.
type Type string

const (
	TypeNetworkInventory Type = "network_inventory" // NetAlertX: devices on the LAN
	TypeNetworkTraffic   Type = "network_traffic"   // Zeek: connection / protocol logs
	TypeNetworkDetection Type = "network_detection" // Suricata: IDS alerts
	TypeAppSec           Type = "appsec"            // AppSec Audit reports
	TypeThreatIntel      Type = "threat_intel"      // MISP, feeds
)

var validTypes = map[Type]bool{TypeNetworkInventory: true, TypeNetworkTraffic: true, TypeNetworkDetection: true, TypeAppSec: true, TypeThreatIntel: true}

// Capability is something a connector can do. There is deliberately no
// capability to execute a command or to act on the network.
type Capability string

const (
	CapabilityRead                Capability = "read"                 // can be queried on demand
	CapabilitySync                Capability = "sync"                 // can refresh its data periodically or on request
	CapabilityImport              Capability = "import"               // accepts a file or export supplied by the user
	CapabilityProduceObservations Capability = "produce_observations" // emits observed facts
	CapabilityProduceFindings     Capability = "produce_findings"     // emits Findings (#79)
)

var validCapabilities = map[Capability]bool{CapabilityRead: true, CapabilitySync: true, CapabilityImport: true, CapabilityProduceObservations: true, CapabilityProduceFindings: true}

// Permissions declares what a connector is allowed to touch. The zero value
// is "nothing", every access is opt-in. Executing commands is not
// representable on purpose.
type Permissions struct {
	LocalRead   bool `json:"local_read"`   // local files or a local socket / API on this host
	NetworkRead bool `json:"network_read"` // read-only access to a service on the local network
	Internet    bool `json:"internet"`     // reaches a service on the Internet
	LocalWrite  bool `json:"local_write"`  // writes outside CyberHub's own database (exceptional)
}

// ReadOnly reports whether the connector never writes outside CyberHub.
func (p Permissions) ReadOnly() bool { return !p.LocalWrite }

// InputKind is where a connector reads from.
type InputKind string

const (
	InputFile      InputKind = "file"       // a local file, e.g. Suricata eve.json
	InputLocalAPI  InputKind = "local_api"  // an API on this host or the LAN, e.g. NetAlertX
	InputRemoteAPI InputKind = "remote_api" // an Internet API, e.g. a public feed
	InputUpload    InputKind = "upload"     // a file the user imports by hand
)

var validInputs = map[InputKind]bool{InputFile: true, InputLocalAPI: true, InputRemoteAPI: true, InputUpload: true}

// OutputKind is what a connector produces.
type OutputKind string

const (
	OutputAsset       OutputKind = "asset"
	OutputObservation OutputKind = "observation"
	OutputFinding     OutputKind = "finding"
	OutputIndicator   OutputKind = "indicator"
)

var validOutputs = map[OutputKind]bool{OutputAsset: true, OutputObservation: true, OutputFinding: true, OutputIndicator: true}

// Input documents one thing a connector consumes. Format is free text
// meant for humans ("EVE JSON", "NetAlertX REST v1").
type Input struct {
	Kind   InputKind `json:"kind"`
	Format string    `json:"format"`
}

// Output documents one thing a connector produces.
type Output struct {
	Kind OutputKind `json:"kind"`
}

// Definition is the static, code-declared description of a connector.
type Definition struct {
	// ID is stable and machine-readable: "netalertx", "zeek", "appsec-audit".
	ID string `json:"id"`
	// Name is the human label.
	Name string `json:"name"`
	// Type is the general category, written as Finding.SourceType.
	Type Type `json:"type"`
	// Source is the concrete producer, written as Finding.Source and as the
	// source of the evidence the connector emits.
	Source       string       `json:"source"`
	Description  string       `json:"description,omitempty"`
	Capabilities []Capability `json:"capabilities"`
	Permissions  Permissions  `json:"permissions"`
	Inputs       []Input      `json:"inputs"`
	Outputs      []Output     `json:"outputs"`
	// NaturalEntityRef is true when every item of the source carries its own
	// stable identifier (Suricata signature id, Zeek uid, MAC address...).
	// Findings built by such a connector must then have an entity_ref and
	// never fall back on the title for their identity.
	NaturalEntityRef bool `json:"natural_entity_ref"`
	// EnabledByDefault is the initial user choice; V1 connectors default to
	// false so nothing reads anything until the user asks for it.
	EnabledByDefault bool `json:"enabled_by_default"`
	// StaleAfter is how old the last successful sync may be before the data
	// is reported as stale. Zero means freshness is not tracked.
	StaleAfter time.Duration `json:"-"`
	// Limits are the guards every future implementation must apply.
	Limits Limits `json:"limits"`
}

// MaxTimeout bounds Limits.Timeout: a connector operation that may last
// longer than this is not a bounded operation and must be redesigned.
const MaxTimeout = 10 * time.Minute

// Limits declares a connector's operational guards. It is declarative only:
// the connector implementation applies them, nothing here runs anything.
type Limits struct {
	// Timeout bounds one operation (probe, sync, import, API call). Always
	// finite and positive: there is no implicit infinite timeout.
	Timeout time.Duration `json:"-"`
	// MaxPayloadBytes bounds the data read in one operation (imported file,
	// upload, HTTP response). Required unless Streaming is set: 0 never
	// means "unlimited".
	MaxPayloadBytes int64 `json:"max_payload_bytes"`
	// Streaming declares a continuous source (Zeek, Suricata logs) for which
	// a global payload size is meaningless. Per-record or per-batch limits
	// will be set by the implementation itself.
	Streaming bool `json:"streaming"`
}

// MarshalJSON exposes the timeout in milliseconds rather than nanoseconds.
func (l Limits) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		TimeoutMS       int64 `json:"timeout_ms"`
		MaxPayloadBytes int64 `json:"max_payload_bytes"`
		Streaming       bool  `json:"streaming"`
	}{l.Timeout.Milliseconds(), l.MaxPayloadBytes, l.Streaming})
}

func (l Limits) validate() error {
	switch {
	case l.Timeout <= 0:
		return errors.New("limits.timeout must be positive")
	case l.Timeout > MaxTimeout:
		return fmt.Errorf("limits.timeout must not exceed %s", MaxTimeout)
	case l.MaxPayloadBytes < 0:
		return errors.New("limits.max_payload_bytes must not be negative")
	case l.Streaming && l.MaxPayloadBytes > 0:
		return errors.New("a streaming connector has no global payload size; set per-record limits in its implementation")
	case !l.Streaming && l.MaxPayloadBytes == 0:
		return errors.New("limits.max_payload_bytes is required unless the connector is declared streaming")
	}
	return nil
}

var (
	connectorIDPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	sourcePattern      = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]*$`)
)

// IsValidID reports whether id has the connector identifier shape.
func IsValidID(id string) bool { return len(id) <= 64 && connectorIDPattern.MatchString(id) }

// HasCapability reports whether the definition declares c.
func (d Definition) HasCapability(c Capability) bool {
	for _, have := range d.Capabilities {
		if have == c {
			return true
		}
	}
	return false
}

func (d Definition) producesOutput(k OutputKind) bool {
	for _, o := range d.Outputs {
		if o.Kind == k {
			return true
		}
	}
	return false
}

// Validate checks that the definition is complete and coherent.
func (d Definition) Validate() error {
	fail := func(format string, args ...any) error {
		return fmt.Errorf("%w: %s: %s", ErrInvalidDefinition, d.ID, fmt.Sprintf(format, args...))
	}
	if !IsValidID(d.ID) {
		return fail("id must be lowercase letters, digits and single dashes")
	}
	if strings.TrimSpace(d.Name) == "" {
		return fail("name is required")
	}
	if !validTypes[d.Type] {
		return fail("unknown type %q", d.Type)
	}
	// Finding stores source lowercased: the definition must already be in
	// that form so provenance reads the same everywhere.
	if len(d.Source) > 64 || !sourcePattern.MatchString(d.Source) {
		return fail("source must be lowercase letters, digits, '.', '_' or '-', at most 64 characters")
	}
	if len(d.Capabilities) == 0 {
		return fail("at least one capability is required")
	}
	seen := map[Capability]bool{}
	for _, c := range d.Capabilities {
		if !validCapabilities[c] {
			return fail("unknown capability %q", c)
		}
		if seen[c] {
			return fail("duplicate capability %q", c)
		}
		seen[c] = true
	}
	if len(d.Inputs) == 0 || len(d.Outputs) == 0 {
		return fail("inputs and outputs must be declared")
	}
	for _, in := range d.Inputs {
		if !validInputs[in.Kind] {
			return fail("unknown input kind %q", in.Kind)
		}
		if strings.TrimSpace(in.Format) == "" {
			return fail("input format is required")
		}
		// An input must be covered by a matching permission.
		switch in.Kind {
		case InputFile, InputUpload:
			if !d.Permissions.LocalRead {
				return fail("input %q requires local_read", in.Kind)
			}
		case InputLocalAPI:
			if !d.Permissions.LocalRead && !d.Permissions.NetworkRead {
				return fail("input local_api requires local_read or network_read")
			}
		case InputRemoteAPI:
			if !d.Permissions.Internet {
				return fail("input remote_api requires internet")
			}
		}
	}
	for _, out := range d.Outputs {
		if !validOutputs[out.Kind] {
			return fail("unknown output kind %q", out.Kind)
		}
	}
	// Producing capabilities and declared outputs must agree both ways.
	if d.HasCapability(CapabilityProduceFindings) != d.producesOutput(OutputFinding) {
		return fail("produce_findings capability and finding output must go together")
	}
	if d.HasCapability(CapabilityProduceObservations) != d.producesOutput(OutputObservation) {
		return fail("produce_observations capability and observation output must go together")
	}
	if d.HasCapability(CapabilityImport) && !d.hasInput(InputUpload) {
		return fail("import capability requires an upload input")
	}
	if err := d.Limits.validate(); err != nil {
		return fail("%s", err.Error())
	}
	if d.StaleAfter < 0 {
		return fail("stale_after must not be negative")
	}
	return nil
}

func (d Definition) hasInput(k InputKind) bool {
	for _, in := range d.Inputs {
		if in.Kind == k {
			return true
		}
	}
	return false
}
