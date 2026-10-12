"""Offline orthographic artwork. Run with Python; no runtime geographic dependency."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).parent
DATA = json.loads((ROOT / 'ne_110m_land.geojson').read_text())
R = 236
CX, CY = 400, 258
LON, LAT = -12, 24

def project(lon, lat):
    a, b, c = map(math.radians, (lon-LON, lat, LAT))
    z = math.sin(c)*math.sin(b)+math.cos(c)*math.cos(b)*math.cos(a)
    return CX+R*math.cos(b)*math.sin(a), CY-R*(math.cos(c)*math.sin(b)-math.sin(c)*math.cos(b)*math.cos(a)), z

def inside(x,y,ring):
    found = False
    for i in range(len(ring)):
        a,b=ring[i],ring[i-1]
        if (a[1]>y)!=(b[1]>y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            found=not found
    return found

polys=[]
for f in DATA['features']:
    g=f['geometry']
    for p in (g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]):
        ring=p[0]
        polys.append((p,min(x[0] for x in ring),max(x[0] for x in ring),min(x[1] for x in ring),max(x[1] for x in ring)))

def line(coords):
    out=[]
    pen=False
    for lon,lat in coords:
        x,y,z=project(lon,lat)
        if z>0:
            out.append(('L' if pen else 'M')+f'{x:.2f},{y:.2f}')
            pen=True
        else: pen=False
    return ''.join(out)

svg=['''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
<defs>
 <radialGradient id="surface" cx="37%" cy="28%" r="72%"><stop stop-color="#123037"/><stop offset=".5" stop-color="#0a1b21"/><stop offset=".86" stop-color="#050c12"/><stop offset="1" stop-color="#020609"/></radialGradient>
 <radialGradient id="atmosphere"><stop offset=".87" stop-color="#71dbe6" stop-opacity="0"/><stop offset=".98" stop-color="#71dbe6" stop-opacity=".12"/><stop offset="1" stop-color="#71dbe6" stop-opacity="0"/></radialGradient>
 <radialGradient id="shade" cx="28%" cy="23%" r="85%"><stop offset=".35" stop-color="#03070b" stop-opacity="0"/><stop offset="1" stop-color="#03070b" stop-opacity=".7"/></radialGradient>
</defs>
<circle cx="400" cy="258" r="249" fill="url(#atmosphere)"/>
<circle cx="400" cy="258" r="236" fill="url(#surface)" stroke="#5097a3" stroke-opacity=".65"/>
<g fill="none" stroke="#74bac5" stroke-width=".5" opacity=".18">''']
for lon in range(-180,180,15):
    svg.append(f'<path d="{line([(lon,lat) for lat in range(-90,91)])}"/>')
for lat in range(-75,90,15):
    svg.append(f'<path d="{line([(lon,lat) for lon in range(-180,181)])}"/>')
svg.append('</g><g fill="none" stroke="#72dce7" stroke-width=".8" stroke-linejoin="round" opacity=".8">')
for p,*_ in polys:
    for ring in p:
        svg.append(f'<path d="{line(ring)}"/>')
svg.append('</g><g fill="none" stroke="#87e4ea" stroke-linecap="round">')
dot_groups=[[] for _ in range(4)]
count=0
for yi in range(-80,84):
    lat=yi
    for xi in range(-180,180):
        lon=xi+(yi%2)*.5
        x,y,z=project(lon,lat)
        if z<=.025: continue
        for p,xmin,xmax,ymin,ymax in polys:
            if xmin<=lon<=xmax and ymin<=lat<=ymax and inside(lon,lat,p[0]) and not any(inside(lon,lat,h) for h in p[1:]):
                dot_groups[min(3,int(z*4))].append(f'M{x:.1f},{y:.1f}h.01')
                count+=1
                break
for i,points in enumerate(dot_groups):
    svg.append(f'<path stroke-width="{1+i*.2:.1f}" opacity="{.35+i*.15:.2f}" d="{"".join(points)}"/>')
svg.append('</g><circle cx="400" cy="258" r="236" fill="url(#shade)"/></svg>')
(ROOT/'earth.svg').write_text(''.join(svg),encoding='utf-8')
print(f'Generated earth.svg: {count} geographic land dots')
