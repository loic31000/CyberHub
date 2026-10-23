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

// Same shape as the backend stores: the whole section before and after ({status, data: {...}}).
const section = (data: Record<string, unknown[]>) => JSON.stringify({ status: 'ok', status_message: 'fixture', data })
const pfx = (prefix: string) => ({ prefix, ip: prefix, cidr: Number(prefix.split('/')[1]), name: '', country_code: '', description: '' })
const rel = (asn: number) => ({ asn, name: `AS${asn}`, description: '', country_code: '' })

export const alertFeedScenario: BGPAlert[] = [
  { id: 101, created_at: '2026-10-23T11:30:00Z', detected_at: '2026-10-23T11:30:00Z', asn: 64496, alert_type: 'prefix_change',
    old_value: section({ ipv4_prefixes: [pfx('198.51.100.0/24'), pfx('192.0.2.0/24')], ipv6_prefixes: [] }),
    new_value: section({ ipv4_prefixes: [pfx('198.51.100.0/24'), pfx('203.0.113.0/24'), pfx('203.0.113.128/25')], ipv6_prefixes: [pfx('2001:db8:10::/48')] }), acknowledged: false },
  { id: 102, created_at: '2026-10-23T10:15:00Z', detected_at: '2026-10-23T10:15:00Z', asn: 64497, alert_type: 'peer_change',
    old_value: section({ ipv4_peers: [rel(64498)], ipv6_peers: [] }), new_value: section({ ipv4_peers: [rel(64498), rel(64496)], ipv6_peers: [] }), acknowledged: false },
  { id: 103, created_at: '2026-10-22T17:45:00Z', detected_at: '2026-10-22T17:45:00Z', asn: 64498, alert_type: 'upstream_change',
    old_value: section({ ipv4_upstreams: [rel(64496)], ipv6_upstreams: [] }), new_value: section({ ipv4_upstreams: [], ipv6_upstreams: [] }), acknowledged: false },
  { id: 104, created_at: '2026-10-22T09:00:00Z', detected_at: '2026-10-22T09:00:00Z', asn: 64499, alert_type: 'downstream_change',
    old_value: section({ ipv4_downstreams: [], ipv6_downstreams: [] }), new_value: section({ ipv4_downstreams: [rel(64500)], ipv6_downstreams: [] }), acknowledged: false },
  { id: 105, created_at: '2026-10-21T14:20:00Z', detected_at: '2026-10-21T14:20:00Z', asn: 64501, alert_type: 'prefix_change',
    old_value: section({ ipv4_prefixes: [], ipv6_prefixes: [] }), new_value: section({ ipv4_prefixes: [pfx('192.0.2.0/24')], ipv6_prefixes: [] }), acknowledged: false },
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

/** 120 fictional observations over about two years, irregularly spaced (preview only). */
export const snapshotLongHistoryScenario: BGPSnapshot[] = Array.from({ length: 120 }, (_, index) => {
  const at = new Date(Date.UTC(2026, 9, 23, 12) - (index * 6 + (index % 7) * 1.5) * 86_400_000)
  return { id: 900 - index, created_at: at.toISOString(), asn: 64496, snapshot_date: at.toISOString(), taken_by: 'local' }
})

/** Empty diff payload: the API omits unreported lists, so this does not prove equality. */
export const snapshotEmptyDiffScenario: BGPDiffResponse = {
  older: { id: 211, created_at: '2026-10-22T12:00:00Z', asn: 64496 },
  newer: { id: 212, created_at: '2026-10-23T12:00:00Z', asn: 64496 },
  diff: { changed_fields: [], changes: {} },
}

/** Object items as stored by the backend, including one peer whose attributes changed. */
export const snapshotObjectDiffScenario: BGPDiffResponse = {
  older: { id: 201, created_at: '2026-10-12T12:00:00Z', asn: 64496 },
  newer: { id: 212, created_at: '2026-10-23T12:00:00Z', asn: 64496 },
  diff: {
    changed_fields: ['prefixes', 'peers', 'upstreams'],
    changes: {
      prefixes: {
        ipv4_prefixes: {
          old: [pfx('198.51.100.0/24'), pfx('192.0.2.0/24'), pfx('198.51.100.128/25')],
          new: [pfx('198.51.100.0/24'), pfx('203.0.113.0/24'), pfx('203.0.113.128/25'), pfx('198.51.100.128/25')],
          added: [pfx('203.0.113.0/24'), pfx('203.0.113.128/25')],
          removed: [pfx('192.0.2.0/24')],
        },
        ipv6_prefixes: { old: [], new: [pfx('2001:db8:10::/48')], added: [pfx('2001:db8:10::/48')], removed: [] },
      },
      peers: {
        ipv4_peers: {
          old: [rel(64497), { ...rel(64498), name: 'EXAMPLE-RESEARCH' }],
          new: [rel(64497), rel(64498), rel(64500)],
          added: [rel(64498), rel(64500)],
          removed: [{ ...rel(64498), name: 'EXAMPLE-RESEARCH' }],
        },
      },
      upstreams: {
        ipv4_upstreams: { old: [rel(64501)], new: [], added: [], removed: [rel(64501)] },
      },
    },
  },
}

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
