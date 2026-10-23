import type {
  ASNInfo, BGPAlert, BGPDownstream, BGPDiffResponse, BGPPeer, BGPSnapshot,
  BGPUpstream, IPv4Prefix, SearchASN,
} from '@/types/bgp'

// Preview/test-only presentation data. ASNs and prefixes use documentation ranges;
// these fixtures are never imported by the production app or represented as live data.
export const asnSearchListScenario: SearchASN[] = [
  { asn: 64496, name: 'Example Transit North', country_code: 'FR', description: '', email: '', rir_name: 'TEST' },
  { asn: 64497, name: 'Example Exchange West', country_code: 'BE', description: '', email: '', rir_name: 'TEST' },
  { asn: 64498, name: 'Example Research Network', country_code: 'DE', description: '', email: '', rir_name: 'TEST' },
  { asn: 64499, name: 'Example Regional Provider', country_code: 'NL', description: '', email: '', rir_name: 'TEST' },
  { asn: 64500, name: 'Example University Backbone', country_code: 'CH', description: '', email: '', rir_name: 'TEST' },
  { asn: 64501, name: 'Example Peering Lab', country_code: 'LU', description: '', email: '', rir_name: 'TEST' },
]

export const alertFeedScenario: BGPAlert[] = [
  { id: 101, created_at: '2026-10-23T11:30:00Z', detected_at: '2026-10-23T11:30:00Z', asn: 64496, alert_type: 'prefix_change', old_value: '{"prefixes":["198.51.100.0/24"]}', new_value: '{"prefixes":["203.0.113.0/24"]}', acknowledged: false },
  { id: 102, created_at: '2026-10-23T10:15:00Z', detected_at: '2026-10-23T10:15:00Z', asn: 64497, alert_type: 'peer_change', old_value: '{"peers":[]}', new_value: '{"peers":[64496]}', acknowledged: false },
  { id: 103, created_at: '2026-10-22T17:45:00Z', detected_at: '2026-10-22T17:45:00Z', asn: 64498, alert_type: 'upstream_change', old_value: '{"upstreams":[64496]}', new_value: '{"upstreams":[]}', acknowledged: false },
  { id: 104, created_at: '2026-10-22T09:00:00Z', detected_at: '2026-10-22T09:00:00Z', asn: 64499, alert_type: 'downstream_change', old_value: '{"downstreams":[]}', new_value: '{"downstreams":[64500]}', acknowledged: false },
  { id: 105, created_at: '2026-10-21T14:20:00Z', detected_at: '2026-10-21T14:20:00Z', asn: 64501, alert_type: 'prefix_change', old_value: '{"prefixes":[]}', new_value: '{"prefixes":["192.0.2.0/24"]}', acknowledged: false },
]

export const snapshotTimelineScenario: BGPSnapshot[] = Array.from({ length: 12 }, (_, index) => {
  const day = String(23 - index).padStart(2, '0')
  return {
    id: 212 - index,
    created_at: `2026-10-${day}T12:00:00Z`,
    asn: 64496,
    snapshot_date: `2026-10-${day}`,
    taken_by: index % 2 ? 'fixture analyst B' : 'fixture analyst A',
  }
})

export const asnInfoScenario: ASNInfo = {
  asn: 64496,
  name: 'EXAMPLE-TRANSIT-NORTH',
  description_short: 'Example Transit North · réseau de transit fictif',
  description_full: ['Jeu de données de prévisualisation, sans correspondance avec un opérateur réel.'],
  country_code: 'FR',
  website: 'https://example.invalid',
  email_contacts: [],
  abuse_contacts: [],
  looking_glass: null,
  traffic_estimation: 'Not available',
  traffic_ratio: 'Not available',
  owner_address: ['Documentation fixture'],
  rir_allocation: {
    rir_name: 'TEST-NET', country_code: 'FR', prefix: '198.51.100.0/24',
    prefix_ip: '198.51.100.0', prefix_cidr: 24, allocation_status: 'reserved',
  },
  date_updated: '2026-10-23T12:00:00Z',
}

const parent = {
  prefix: '198.51.100.0/24', ip: '198.51.100.0', cidr: 24,
  rir_name: 'TEST-NET', allocation_status: 'reserved',
}

export const prefixScenario: IPv4Prefix[] = [
  { prefix: '198.51.100.0/24', ip: '198.51.100.0', cidr: 24, name: 'Example Transit North', country_code: 'FR', description: 'Documentation prefix', parent },
  { prefix: '198.51.100.0/25', ip: '198.51.100.0', cidr: 25, name: 'Example Transit North Edge', country_code: 'FR', description: 'Documentation prefix', parent },
  { prefix: '203.0.113.0/24', ip: '203.0.113.0', cidr: 24, name: 'Example Exchange West', country_code: 'BE', description: 'Documentation prefix', parent: { ...parent, prefix: '203.0.113.0/24', ip: '203.0.113.0' } },
  { prefix: '192.0.2.0/24', ip: '192.0.2.0', cidr: 24, name: 'Example Research Network', country_code: 'DE', description: 'Documentation prefix', parent: { ...parent, prefix: '192.0.2.0/24', ip: '192.0.2.0' } },
  { prefix: '198.51.100.128/25', ip: '198.51.100.128', cidr: 25, name: 'Example Transit North Core', country_code: 'FR', description: 'Documentation prefix', parent },
]

export const peerScenario: BGPPeer[] = [
  { asn: 64497, name: 'Example Exchange West', description: 'Peering · Bruxelles', country_code: 'BE' },
  { asn: 64498, name: 'Example Research Network', description: 'Éducation · Frankfurt', country_code: 'DE' },
  { asn: 64499, name: 'Example Regional Provider', description: 'Transit · Amsterdam', country_code: 'NL' },
  { asn: 64500, name: 'Example University Backbone', description: 'Recherche · Genève', country_code: 'CH' },
]

export const upstreamScenario: BGPUpstream[] = [
  { asn: 64501, name: 'Example Peering Lab', description: 'Upstream fictif · Paris', country_code: 'LU' },
]

export const downstreamScenario: BGPDownstream[] = [
  { asn: 64499, name: 'Example Regional Provider', description: 'Downstream fictif · Amsterdam', country_code: 'NL' },
  { asn: 64500, name: 'Example University Backbone', description: 'Downstream fictif · Genève', country_code: 'CH' },
]

export const snapshotDiffScenario: BGPDiffResponse = {
  older: { id: 201, created_at: '2026-10-12T12:00:00Z', asn: 64496 },
  newer: { id: 212, created_at: '2026-10-23T12:00:00Z', asn: 64496 },
  diff: {
    changed_fields: ['prefixes', 'peers'],
    changes: {
      prefixes: {
        ipv4_prefixes: {
          old: ['198.51.100.0/24', '192.0.2.0/24'],
          new: ['198.51.100.0/24', '203.0.113.0/24'],
          added: ['203.0.113.0/24'],
          removed: ['192.0.2.0/24'],
        },
      },
      peers: {
        ipv4_peers: {
          old: ['AS64497', 'AS64498'],
          new: ['AS64497', 'AS64500'],
          added: ['AS64500'],
          removed: ['AS64498'],
        },
      },
    },
  },
}
