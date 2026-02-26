# Physics Notes

This renderer is a real-time, physically motivated approximation of Kerr lensing and disk emission. It is not a full GR ray tracer, but it goes beyond a simple thin-lens warp by integrating a light path through a curved field and applying spectral radiative transfer.

## Units and Scaling

The shader works in normalized units. The Schwarzschild radius `rs` is scaled from the mass slider using a log mapping so extreme masses remain viewable without numeric blowups.

## Ray Integration (Kerr-Inspired)

Each pixel advances a null ray with a GR-motivated bending term and a frame-dragging term:

```
accel_grav  = -2 M * r / |r|^3
accel_drag  = Omega_frame x v
Omega_frame ~ a M / r^3
```

This captures the qualitative behavior of light bending and spin-driven asymmetry in real time.

## Radiative Transfer

Disk emission is integrated through a thin slab with optical depth:

```
I_out = I_in * exp(-tau) + S * (1 - exp(-tau))
tau   = integral(alpha ds)
```

Here `alpha` is a density-driven absorption coefficient and `S` is a temperature-dependent source term.

## Spectral Rendering

Emission is computed from a Planck spectrum sampled at three wavelengths (R/G/B). A combined Doppler and gravitational redshift factor `g` shifts the observed temperature:

```
T_obs = g * T_em
```

This produces both the color shift and brightness beaming across the disk.

## Disk Model

The temperature profile follows a thin-disk shape:

```
T(r) ∝ [(1 - sqrt(r_in / r)) / r^3]^(1/4)
```

Vertical thickness controls density and therefore optical depth, enabling self-shadowing. A mild limb-darkening term dims grazing angles.

## Photon Ring Approximation

Rays that spend time near the photon region (around 1.5 rs) accumulate extra light to suggest a photon ring without full multi-orbit geodesics.

## Pulsar Mode

The pulsar preset uses a neutron star with weak-field bending and a lighthouse beam model:

```
alpha ≈ 2 rs / b
m(t) = R_spin(Ω t) · m0
I_beam ∝ exp(-theta^2 / 2σ^2)
```

This models gravitational light bending and rotating magnetic beams without full GR ray tracing.

## Background

The lensed ray direction samples a multi-layer procedural sky (galactic band, dust lanes, and HDR stars), so the background is distorted by the same bending as the disk.

## Limitations

- Geodesics are approximated for performance (not full Kerr Hamiltonian integration).
- No GRMHD, polarization, or plasma radiative transfer.
- Turbulence is procedural, not MHD-driven.
