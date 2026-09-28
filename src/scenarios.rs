//! On-disk persistence for sandbox scenarios.
//!
//! Scenarios are opaque JSON documents produced by the frontend. They are
//! stored as `<name>.json` inside the scenario directory. Names are restricted
//! to a safe character set so a request can never escape that directory.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use serde_json::Value;
use std::{path::PathBuf, sync::Arc, time::UNIX_EPOCH};

#[derive(Clone)]
pub struct ScenarioStore {
    dir: Arc<PathBuf>,
}

#[derive(Serialize)]
pub struct ScenarioInfo {
    name: String,
    bytes: u64,
    modified: u64,
}

impl ScenarioStore {
    pub async fn new(dir: PathBuf) -> anyhow::Result<Self> {
        tokio::fs::create_dir_all(&dir).await?;
        Ok(Self { dir: Arc::new(dir) })
    }

    fn path_for(&self, name: &str) -> Option<PathBuf> {
        valid_name(name).then(|| self.dir.join(format!("{name}.json")))
    }
}

/// A scenario name is 1-64 characters of ASCII letters, digits, `-`, `_` or space,
/// and may not start with a space.
pub fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && !name.starts_with(' ')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ' ')
}

pub fn router(store: ScenarioStore) -> Router {
    Router::new()
        .route("/scenarios", get(list))
        .route("/scenarios/:name", get(load).put(save).delete(remove))
        .with_state(store)
}

async fn list(State(store): State<ScenarioStore>) -> Result<Json<Vec<ScenarioInfo>>, StatusCode> {
    let mut out = Vec::new();
    let mut entries = tokio::fs::read_dir(store.dir.as_ref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Some(name) = path.file_stem().and_then(|s| s.to_str()).map(str::to_owned) else {
            continue;
        };
        if !valid_name(&name) {
            continue;
        }
        let meta = entry.metadata().await.ok();
        let bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        out.push(ScenarioInfo { name, bytes, modified });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(Json(out))
}

async fn load(State(store): State<ScenarioStore>, Path(name): Path<String>) -> Result<Json<Value>, StatusCode> {
    let path = store.path_for(&name).ok_or(StatusCode::BAD_REQUEST)?;
    let text = tokio::fs::read_to_string(path).await.map_err(|_| StatusCode::NOT_FOUND)?;
    let value = serde_json::from_str(&text).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(value))
}

async fn save(
    State(store): State<ScenarioStore>,
    Path(name): Path<String>,
    Json(body): Json<Value>,
) -> Result<StatusCode, StatusCode> {
    let path = store.path_for(&name).ok_or(StatusCode::BAD_REQUEST)?;
    if !body.is_object() {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    let text = serde_json::to_string(&body).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let tmp = path.with_extension("json.tmp");
    tokio::fs::write(&tmp, text).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    tokio::fs::rename(&tmp, &path).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn remove(State(store): State<ScenarioStore>, Path(name): Path<String>) -> StatusCode {
    let Some(path) = store.path_for(&name) else {
        return StatusCode::BAD_REQUEST;
    };
    match tokio::fs::remove_file(path).await {
        Ok(()) => StatusCode::NO_CONTENT,
        Err(_) => StatusCode::NOT_FOUND,
    }
}

#[cfg(test)]
mod tests {
    use super::valid_name;

    #[test]
    fn accepts_simple_names() {
        assert!(valid_name("my-system"));
        assert!(valid_name("Trappist 1 v2"));
        assert!(valid_name("a_b"));
    }

    #[test]
    fn rejects_traversal_and_junk() {
        assert!(!valid_name(""));
        assert!(!valid_name("../etc/passwd"));
        assert!(!valid_name("a/b"));
        assert!(!valid_name(" leading"));
        assert!(!valid_name("dot.name"));
        assert!(!valid_name(&"x".repeat(65)));
    }
}
