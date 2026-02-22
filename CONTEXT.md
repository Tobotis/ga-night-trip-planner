# Night GA Swiss Trip Planner — Project Context

## Goal

Build an interactive tool to plan day trips from **Zürich HB** to all major Swiss cities and tourist destinations, constrained to the **GA Night** travelcard (CHF 99/year, under-25s). The user wants to visit every city on the list and return home the same night — no hotels.

## GA Night Constraints

- **Weekdays:** Valid 19:00–05:00 (next day arrival time)
- **Weekends & public holidays:** Valid 19:00–07:00 (next day arrival time)
- 2nd class only, covers SBB + most private railways (BOB, MGB, RhB, BLS, etc.)
- Night supplement (Nachtzuschlag, ~CHF 5) is NOT included — must be bought separately for Nachtnetz services
- If return extends past the validity window, a supplementary ticket is needed for the remaining segment

## Target Cities (28 total)

### Large cities (>50k inhabitants)
Zürich (home), Geneva, Basel, Lausanne, Bern, Winterthur, Lucerne, St. Gallen, Lugano, Biel/Bienne

### Other notable cities
Thun, Köniz, La Chaux-de-Fonds

### Major tourist destinations
Interlaken, Zermatt, Grindelwald, St. Moritz, Davos, Montreux, Lauterbrunnen, Locarno, Ascona, Schaffhausen, Verbier, Wengen, Mürren, Sion, Rapperswil, Bellinzona, Arosa, Lenzerheide, Pontresina, Brienz, Stein am Rhein

### Infeasible with Night GA (no night transport)
- **Wengen** — WAB cog railway stops ~22:30, resumes ~06:30
- **Mürren** — BLM cable car stops by ~18:00 (winter) / ~21:00 (summer)
- **Verbier** — requires PostBus from Le Châble, last bus ~20:00
- **Lenzerheide** — requires PostBus from Chur, no night service

## Architecture

### Data source
**Swiss Transport API** — `https://transport.opendata.ch/v1`
- Free, no API key, CORS enabled (works from browser)
- Endpoints used:
  - `GET /connections?from=X&to=Y&date=YYYY-MM-DD&time=HH:MM&limit=N` — fetch connections
  - `&isArrivalTime=1` — search by arrival time instead of departure
- Returns JSON with: `connections[].from.departure`, `connections[].to.arrival`, `connections[].duration`, `connections[].transfers`, `connections[].sections[]` (each section has `.journey.category`, `.journey.number`, `.departure.station.name`, `.arrival.station.name`, `.departure.platform`, etc.)

### Current Implementation

**File:** `night-ga-planner.jsx` (React artifact, single-file)

**Features implemented:**
1. **Single City mode** — Click a city → fetches outbound (depart ZH 19:00+) and return (arrive ZH before 05:00/07:00) connections
2. **Multi-City mode** — Select cities in order → chains legs with ~1h ground time between each, fetches all connections
3. **Date picker** — Auto-detects weekday vs weekend, adjusts GA window
4. **GA validity check** — Each connection row shows ✓/✗ for whether it falls within the GA Night window; invalid rows are dimmed
5. **Expandable route detail** — Click a row to see all intermediate stops, train numbers, platforms
6. **Trip analysis panel** — Shows # valid outbound/return options, earliest arrival, latest return departure, max ground time, and warns if overnight gap detected

**Key functions:**
- `isWithinGA(isoStr, gaDate)` — checks if a timestamp falls within the GA Night window
- `fetchConnections(from, to, date, time, isArrival, limit)` — wrapper around the API
- `ConnectionRow` — renders one connection with GA validity
- `SectionDetail` — renders expanded route (train segments + walks)

**Station name mapping** (API requires exact SBB station names):
```
Winterthur → "Winterthur"
Lucerne → "Luzern"
Basel → "Basel SBB"
Geneva → "Genève"
Rapperswil → "Rapperswil SG"
Brienz → "Brienz (BE)"
Davos → "Davos Platz"
```

### Previous artifact (static version)
There was also a static `trip-planner.jsx` with 18 hand-planned trips with estimated schedules, feasibility ratings, and notes. This was superseded by the live-fetching version but could be useful as a reference for the trip groupings and corridor logic.

## Known Issues / Areas for Improvement

1. **Multi-city chaining logic** is naive — assumes 1h ground time, doesn't optimize. Could use the actual arrival time + configurable stay duration.
2. **No caching** — every city click re-fetches. Could cache results by (from, to, date, time).
3. **No "plan my whole trip" optimizer** — doesn't find the optimal ordering of cities for a multi-city trip or verify that the entire chain fits within the GA window.
4. **Overnight gap handling** — correctly warns but doesn't show the first morning train or calculate the supplementary ticket cost.
5. **Ascona** is not a train station — requires PostBus from Locarno. The tool doesn't handle bus connections explicitly (the API does return them if available).
6. **Mobile responsiveness** — the grid layout may not work well on narrow screens.
7. **No persistent state** — selecting cities and results are lost on refresh.
8. **Could add a map** showing the route.
9. **Could add cost estimation** for segments outside GA validity (using half-fare prices).
10. **The return query uses `isArrivalTime=1`** to find trains arriving before the cutoff, which is correct but sometimes the API returns connections arriving slightly after — the dimming handles this gracefully.

## Tech Stack
- React (single .jsx file, runs as Claude artifact)
- No build step, no npm dependencies beyond what's available in the artifact runtime (React, lucide-react, recharts, d3, lodash, etc.)
- Tailwind core utility classes available but current implementation uses inline styles
- Could be migrated to a standalone Vite/Next.js project

## User Profile
The user (Tobi) is a CS student at ETH Zürich, values mathematical rigor, appreciates clean code and good UX. He's under 25 (eligible for GA Night at CHF 99/year).
