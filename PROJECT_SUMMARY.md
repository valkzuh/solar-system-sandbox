# Project Summary

Black Hole Visualizer is a Rust web server that serves a WebGL2 frontend. A native `wgpu` renderer is also available as an optional desktop binary.

## Structure

- `src/main.rs` Rust web server (Axum)
- `public/` WebGL UI (primary interface)
- `src/bin/native.rs` Optional native GPU renderer
- `src/shader.wgsl` Shader for the native renderer

## Status

- Web UI is the primary entry point (`cargo run`).
- Shader now uses Kerr-inspired ray integration and spectral radiative transfer.
- Native renderer is optional (`cargo run --bin native`).
