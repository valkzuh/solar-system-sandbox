# Solar System Sandbox

A physically realistic, real-time solar system sandbox that runs in the browser. It is built on
the [black-hole-visualizer](https://github.com/valkzuh/black-hole-visualizer) Rust + WebGL
project: the same Axum server, UI language and gravitational-lensing ideas, grown into a full
N-body playground.

- **Real sky, real date.** Planets, the Moon and the Galilean satellites start from VSOP87/ELP/L1.2
  ephemerides for any date. Rotation follows the IAU models, so Earth's day/night terminator and
  Saturn's ring tilt match reality. The backdrop is the Tycho-2 Milky Way with 41,000 catalog stars.
- **Serious gravity.** A 4th-order Hermite integrator with individual block time-steps, J2
  oblateness and 1PN general relativity (Mercury precesses by 43″/century). You can run time
  forward, backward, or up to centuries per second.
- **Sandbox physics.** Throw planets, stars, comets and black holes into the system. Collisions
  merge, melt surfaces and eject debris disks; the Roche limit tears moons into rings; massive
  stars can go supernova.
- **Physically based rendering.** Rayleigh/Mie scattered atmospheres, eclipse penumbrae from every
  moon, ring shadows, ocean glint, city lights, thermal glow of molten worlds, stellar granulation
  and corona, GPU light metering, bloom and tone mapping, and gravitational lensing around black
  holes.

## Quick start

```bash
cargo run --release
# open http://127.0.0.1:3000
```

Everything the page needs is vendored under `public/` (three.js, astronomy-engine, textures, star
catalog). The server adds gzip and a small scenario-storage API. The frontend also works from any
static file server; only server-side saving needs the Rust backend.

Environment variables: `PORT` (default 3000), `HOST` (default 127.0.0.1), `PUBLIC_DIR`,
`SCENARIO_DIR` (default `./scenarios`).

## Using it

| Action | How |
| --- | --- |
| Orbit / pan / zoom | drag · right-drag or Shift-drag · wheel/pinch (logarithmic, metres → light-years) |
| Telescope zoom | Alt + wheel (field of view) |
| Select / fly to | click / double-click a body or its label, or search with `/` |
| Time | Space pause · `,` `.` slower/faster · `R` reverse |
| Create | **Create** panel → pick a template → click in space; drag to throw it |
| Edit | inspector: mass/radius, circularise, boost, stop, reverse, turn into a star or black hole, supernova |
| Toggles | `O` orbits · `L` labels · `T` trails · `C` constellations · `H` hide UI |

### Scenarios

Solar System today · Inner planets · Earth & Moon · Jupiter & the Galilean moons · Saturn & its
rings · Pluto & Charon · Theia impact (Moon formation) · the Moon crossing the Roche limit · a rogue
black hole flyby · Jupiter ignites as a star · TRAPPIST-1 · Kepler-16 (circumbinary) · Alpha
Centauri AB · Planet Nine · an empty system to build your own.

## Project layout

```
src/main.rs            Axum server: static files, gzip, /api/health
src/scenarios.rs       /api/scenarios — save/load/delete sandbox states as JSON
public/index.html      UI shell
public/info.html       Physics & rendering notes (also at /info)
public/js/core/        constants, vectors, Kepler solver, stellar astrophysics
public/js/sim/         Hermite N-body simulation, ephemerides, hierarchy, collisions
public/js/render/      three.js renderer, shaders, sky, belts, comets, lensing, metering
public/js/ui/          panels, inspector, placement tool, formatting
public/js/data/        body catalog, scenarios, creation templates
tests/                 node --test physics suite (integrator accuracy, GR, reversibility)
```

## Tests

```bash
cargo test          # server
npm test            # physics (Node 20+, no dependencies)
```

The physics suite checks a two-body orbit against the analytic solution, energy conservation
and VSOP87 agreement for the full solar system over a year, exact time reversal, and Mercury's
relativistic perihelion advance.

## Accuracy notes

- Moons without a precise theory use mean elements, so their phases are approximate.
- Starting velocities come from truncated VSOP87 series (about ±1′). Over years the free N-body
  solution drifts slowly away from the analytic ephemeris, as any independent integration would.
- The black-hole lens is a thin-lens point-mass approximation applied in screen space.

See [`/info`](public/info.html) for the equations and data sources.

## Credits

three.js (MIT) · astronomy-engine (MIT) · d3-celestial star data (BSD) · CesiumJS Tycho-2 sky box
(Apache-2.0) · planet textures by Planet Pixel Emporium (J. Hastings-Trew) and NASA-derived
three.js example maps.
