# Quickstart (Rust)

## Build + Run

```powershell
# Web app
cargo run

# Native GPU app (optional)
cargo run --bin native
```

## Notes

- The web UI runs at `http://127.0.0.1:3000`.
- Physics notes and formulas are on `http://127.0.0.1:3000/info`.
- The native app requires a GPU that supports `wgpu` (Vulkan/DirectX/Metal).
