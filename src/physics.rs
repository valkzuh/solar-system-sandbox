use serde::Serialize;

const G: f64 = 6.6743e-11;
const C: f64 = 299_792_458.0;
const MSUN: f64 = 1.988_47e30;
const PI: f64 = std::f64::consts::PI;

#[derive(Serialize, Clone, Copy)]
pub struct ShadowPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize)]
pub struct Metrics {
    #[serde(rename = "rg_m")]
    pub rg_m: f64,
    #[serde(rename = "rs_m")]
    pub rs_m: f64,
    #[serde(rename = "r_plus_m")]
    pub r_plus_m: f64,
    #[serde(rename = "isco_m")]
    pub isco_m: f64,
    #[serde(rename = "photon_pro_m")]
    pub photon_pro_m: f64,
    #[serde(rename = "photon_retro_m")]
    pub photon_retro_m: f64,
    #[serde(rename = "shadow_radius_rg")]
    pub shadow_radius_rg: f64,
    #[serde(rename = "shadow_path")]
    pub shadow_path: Vec<ShadowPoint>,
    #[serde(rename = "eddington_w")]
    pub eddington_w: f64,
    #[serde(rename = "isco_period_s")]
    pub isco_period_s: f64,
}

#[derive(Default)]
struct ShadowPath {
    radius_rg: f64,
    points: Vec<ShadowPoint>,
}

fn clamp(value: f64, min_val: f64, max_val: f64) -> f64 {
    if value < min_val {
        min_val
    } else if value > max_val {
        max_val
    } else {
        value
    }
}

fn isco_radius_rg(a_star: f64, prograde: bool) -> f64 {
    let a = clamp(a_star, 0.0, 0.998);
    let z1 = 1.0
        + (1.0 - a * a).cbrt() * ((1.0 + a).cbrt() + (1.0 - a).cbrt());
    let z2 = (3.0 * a * a + z1 * z1).sqrt();
    let term = ((3.0 - z1) * (3.0 + z1 + 2.0 * z2)).sqrt();
    let sign = if prograde { 1.0 } else { -1.0 };
    3.0 + z2 - sign * term
}

fn photon_radius_rg(a_star: f64, prograde: bool) -> f64 {
    let a = clamp(a_star, 0.0, 0.998);
    let sign = if prograde { -1.0 } else { 1.0 };
    let angle = (sign * a).acos();
    2.0 * (1.0 + ((2.0 / 3.0) * angle).cos())
}

fn circle_shadow(radius: f64) -> ShadowPath {
    let steps = 220;
    let mut points = Vec::with_capacity(steps + 1);
    for i in 0..=steps {
        let t = (i as f64 / steps as f64) * 2.0 * PI;
        points.push(ShadowPoint {
            x: t.cos() * radius,
            y: t.sin() * radius,
        });
    }
    ShadowPath {
        radius_rg: radius,
        points,
    }
}

fn compute_shadow_path(a_star: f64, theta: f64) -> ShadowPath {
    let a = clamp(a_star, 0.0, 0.998);
    if a < 1e-4 {
        return circle_shadow(27.0_f64.sqrt());
    }

    let sin_t = theta.sin().max(0.01);
    let cos_t = theta.cos();
    let r_min = photon_radius_rg(a, true) + 1e-3;
    let r_max = photon_radius_rg(a, false) - 1e-3;
    let steps = 220;

    let mut upper: Vec<ShadowPoint> = Vec::with_capacity(steps + 1);
    for i in 0..=steps {
        let r = r_min + (r_max - r_min) * (i as f64 / steps as f64);
        let denom = a * (1.0 - r);
        if denom.abs() < 1e-6 {
            continue;
        }

        let r2 = r * r;
        let a2 = a * a;
        let xi = ((r2 + a2) * (r - 3.0) + 4.0 * a2) / denom;
        let eta =
            (r2 * r * (4.0 * a2 - r * (r - 3.0) * (r - 3.0))) / (a2 * (1.0 - r) * (1.0 - r));
        let alpha = -xi / sin_t;
        let beta_sq = eta + a2 * cos_t * cos_t - (xi * xi) * (cos_t * cos_t) / (sin_t * sin_t);

        if !beta_sq.is_finite() || beta_sq <= 0.0 {
            continue;
        }

        upper.push(ShadowPoint {
            x: alpha,
            y: beta_sq.sqrt(),
        });
    }

    if upper.len() < 3 {
        return circle_shadow(27.0_f64.sqrt());
    }

    let mut points = Vec::with_capacity(upper.len() * 2);
    points.extend_from_slice(&upper);
    for p in upper.iter().rev() {
        points.push(ShadowPoint { x: p.x, y: -p.y });
    }

    let mut radius = 0.0_f64;
    for p in &points {
        radius = radius.max((p.x * p.x + p.y * p.y).sqrt());
    }

    ShadowPath {
        radius_rg: radius,
        points,
    }
}

pub fn compute_metrics(mass_solar: f64, spin: f64, inclination_deg: f64, prograde: bool) -> Metrics {
    let mass = clamp(mass_solar, 1.0, 1.0e10);
    let mass_kg = mass * MSUN;
    let rg = (G * mass_kg) / (C * C);
    let rs = 2.0 * rg;
    let a_star = clamp(spin, 0.0, 0.998);

    let r_plus_rg = 1.0 + (1.0 - a_star * a_star).sqrt();
    let risco_rg = isco_radius_rg(a_star, prograde);
    let photon_pro_rg = photon_radius_rg(a_star, true);
    let photon_retro_rg = photon_radius_rg(a_star, false);
    let theta = clamp(inclination_deg, 0.0, 80.0) * PI / 180.0;

    let shadow = compute_shadow_path(a_star, theta);
    let eddington_w = 1.26e31 * mass;
    let risco_m = risco_rg * rg;
    let isco_period = 2.0 * PI * (risco_m.powi(3) / (G * mass_kg)).sqrt();

    Metrics {
        rg_m: rg,
        rs_m: rs,
        r_plus_m: r_plus_rg * rg,
        isco_m: risco_m,
        photon_pro_m: photon_pro_rg * rg,
        photon_retro_m: photon_retro_rg * rg,
        shadow_radius_rg: shadow.radius_rg,
        shadow_path: shadow.points,
        eddington_w,
        isco_period_s: isco_period,
    }
}
