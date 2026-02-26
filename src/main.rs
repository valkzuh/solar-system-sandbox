mod physics;

use axum::{
    extract::Query,
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::{env, net::SocketAddr};
use tower_http::services::{ServeDir, ServeFile};

const MASS_MIN: f64 = 1.0;
const MASS_MAX: f64 = 1.0e10;

#[derive(Deserialize)]
struct MetricsQuery {
    mass: Option<f64>,
    spin: Option<f64>,
    inclination: Option<f64>,
    disk_sense: Option<String>,
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

async fn metrics_handler(Query(query): Query<MetricsQuery>) -> Result<Json<physics::Metrics>, StatusCode> {
    let mass = clamp(query.mass.unwrap_or(10.0), MASS_MIN, MASS_MAX);
    let spin = clamp(query.spin.unwrap_or(0.6), 0.0, 0.998);
    let inclination = clamp(query.inclination.unwrap_or(35.0), 0.0, 80.0);
    let disk_sense = query.disk_sense.unwrap_or_else(|| "prograde".to_string());
    let prograde = disk_sense != "retrograde";

    let metrics = physics::compute_metrics(mass, spin, inclination, prograde);
    Ok(Json(metrics))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let port = env::var("PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(3000);

    let app = Router::new()
        .route("/api/metrics", get(metrics_handler))
        .route_service("/", ServeFile::new("public/index.html"))
        .route_service("/info", ServeFile::new("public/info.html"))
        .fallback_service(ServeDir::new("public"));

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!("Black Hole Visualizer listening on http://127.0.0.1:{port}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
