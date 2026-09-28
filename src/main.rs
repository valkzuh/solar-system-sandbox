//! Solar System Sandbox web server.
//!
//! Serves the WebGL2 frontend from `public/` and provides a small JSON API
//! for persisting user-created sandbox scenarios on disk.

mod scenarios;

use axum::{
    extract::DefaultBodyLimit,
    http::{header, HeaderValue},
    routing::get,
    Json, Router,
};
use serde_json::json;
use std::{env, net::SocketAddr, path::PathBuf};
use tower_http::{
    compression::CompressionLayer,
    services::{ServeDir, ServeFile},
    set_header::SetResponseHeaderLayer,
};

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "ok": true, "name": "solar-system-sandbox", "version": env!("CARGO_PKG_VERSION") }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let port = env::var("PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(3000);
    let host: std::net::IpAddr = env::var("HOST")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or([127, 0, 0, 1].into());
    let public_dir = PathBuf::from(env::var("PUBLIC_DIR").unwrap_or_else(|_| "public".into()));
    let scenario_dir = PathBuf::from(env::var("SCENARIO_DIR").unwrap_or_else(|_| "scenarios".into()));

    let store = scenarios::ScenarioStore::new(scenario_dir).await?;

    let api = Router::new()
        .route("/health", get(health))
        .merge(scenarios::router(store))
        .layer(DefaultBodyLimit::max(8 * 1024 * 1024));

    let app = Router::new()
        .nest("/api", api)
        .route_service("/", ServeFile::new(public_dir.join("index.html")))
        .route_service("/info", ServeFile::new(public_dir.join("info.html")))
        .fallback_service(ServeDir::new(&public_dir))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-cache"),
        ))
        .layer(CompressionLayer::new());

    let addr = SocketAddr::new(host, port);
    println!("Solar System Sandbox listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
