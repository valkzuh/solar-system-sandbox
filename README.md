# Black Hole Visualizer (Rust)

Real-time black hole visualizer with a Rust web server and a WebGL2 frontend. A native `wgpu` renderer is also available as an optional desktop binary.

## Quick Start

```powershell
# Web app (serves the UI at http://127.0.0.1:3000)
cargo run

# Native GPU app (optional)
cargo run --bin native
```

## Controls

- Drag: orbit camera
- Shift/right-drag: pan
- Scroll: zoom
- Sliders: mass, spin, accretion, inclination, disk parameters, lensing, environment

## Project Layout

- `src/main.rs` Rust web server (Axum)
- `public/` WebGL UI
- `src/bin/native.rs` Optional native GPU renderer (wgpu + egui)
- `src/shader.wgsl` Shader for the native renderer

## Notes

- The renderer integrates a Kerr-inspired light path in real time and applies spectral radiative transfer in the disk.
- This is still an approximation (not full Kerr Hamiltonian geodesics or GRMHD), but it is physically motivated.
- The native renderer UI is temporary; the web UI is the primary interface for now.
