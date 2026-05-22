use axum::{Json, Router, routing::post};
use serde::{Deserialize, Serialize};
use std::fs;
use tempfile::TempDir;
use tokio::process::Command;
use tower_http::{cors::CorsLayer, services::ServeDir};

#[derive(Deserialize)]
struct BuildRequest {
    source: String,
    program_json: Option<String>,
}

#[derive(Deserialize)]
struct RunRequest {
    source: String,
    function_name: String,
    inputs: Vec<String>,
    program_json: Option<String>,
}

#[derive(Deserialize)]
struct TestRequest {
    source: String,
    test_source: String,
    program_json: Option<String>,
    test_filter: Option<String>,
}

#[derive(Serialize)]
struct BuildResponse {
    success: bool,
    output: String,
    abi: String,
    errors: String,
}

fn find_leo() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let candidates = [
        std::env::var("LEO_PATH").ok(),
        Some(format!("{home}/Desktop/leo/target/debug/leo")),
        Some(format!("{home}/.aleo/bin/leo")),
        Some(format!("{home}/.cargo/bin/leo")),
        Some("leo".to_string()),
    ];
    candidates
        .into_iter()
        .flatten()
        .find(|p| std::path::Path::new(p).exists())
        .unwrap_or_else(|| "leo".to_string())
}

fn ansi_to_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    let mut open_span = false;
    let mut iter = s.chars().peekable();

    while let Some(c) = iter.next() {
        if c == '\x1b' && iter.peek() == Some(&'[') {
            iter.next(); // consume '['
            let mut seq = String::new();
            for ch in iter.by_ref() {
                if ch.is_ascii_alphabetic() {
                    if ch == 'm' {
                        if open_span {
                            out.push_str("</span>");
                            open_span = false;
                        }
                        if !seq.is_empty() && seq != "0" {
                            if let Some(css) = sgr_to_css(&seq) {
                                out.push_str(&format!("<span style=\"{css}\">"));
                                open_span = true;
                            }
                        }
                    }
                    break;
                }
                seq.push(ch);
            }
        } else {
            match c {
                '<'  => out.push_str("&lt;"),
                '>'  => out.push_str("&gt;"),
                '&'  => out.push_str("&amp;"),
                _    => out.push(c),
            }
        }
    }

    if open_span { out.push_str("</span>"); }
    out
}

fn sgr_to_css(seq: &str) -> Option<String> {
    let ns: Vec<u8> = seq.split(';').filter_map(|s| s.parse().ok()).collect();
    let mut css = Vec::<String>::new();
    let mut i = 0;
    while i < ns.len() {
        match ns[i] {
            1  => { css.push("font-weight:700".into()); i += 1; }
            3  => { css.push("font-style:italic".into()); i += 1; }
            31 => { css.push("color:#f14c4c".into()); i += 1; }
            32 => { css.push("color:#4ec9b0".into()); i += 1; }
            33 => { css.push("color:#cca700".into()); i += 1; }
            34 => { css.push("color:#569cd6".into()); i += 1; }
            35 => { css.push("color:#c586c0".into()); i += 1; }
            36 => { css.push("color:#9cdcfe".into()); i += 1; }
            37 => { css.push("color:#cccccc".into()); i += 1; }
            38 if ns.get(i + 1) == Some(&5) && ns.get(i + 2).is_some() => {
                css.push(format!("color:{}", ansi256(ns[i + 2])));
                i += 3;
            }
            _ => { i += 1; }
        }
    }
    if css.is_empty() { None } else { Some(css.join(";")) }
}

fn ansi256(n: u8) -> String {
    const STANDARD: [&str; 16] = [
        "#1e1e1e","#f14c4c","#4ec9b0","#cca700",
        "#569cd6","#c586c0","#9cdcfe","#cccccc",
        "#767676","#f77070","#72d4bb","#e2b454",
        "#6fb4e8","#d9a0d9","#b0e4ff","#ffffff",
    ];
    if (n as usize) < 16 { return STANDARD[n as usize].into(); }
    if n >= 232 {
        let v = 8u32 + (n as u32 - 232) * 10;
        return format!("#{v:02x}{v:02x}{v:02x}");
    }
    let i = n - 16;
    let b = i % 6;
    let g = (i / 6) % 6;
    let r = i / 36;
    let c = |v: u8| if v == 0 { 0u32 } else { 55 + v as u32 * 40 };
    format!("#{:02x}{:02x}{:02x}", c(r), c(g), c(b))
}

fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut iter = s.chars().peekable();
    while let Some(c) = iter.next() {
        if c == '\x1b' && iter.peek() == Some(&'[') {
            iter.next();
            for ch in iter.by_ref() {
                if ch.is_ascii_alphabetic() { break; }
            }
        } else {
            out.push(c);
        }
    }
    out
}

fn extract_compile_errors(raw: &str) -> &str {
    let clean = strip_ansi(raw);
    if let Some(rel) = clean.find("\n[E") {
        let target_line = clean[..rel].matches('\n').count();
        let raw_start = raw
            .match_indices('\n')
            .nth(target_line.saturating_sub(1))
            .map(|(i, _)| i + 1)
            .unwrap_or(0);
        return &raw[raw_start..];
    }
    raw
}

fn extract_test_results(raw: &str) -> &str {
    let clean = strip_ansi(raw);
    // Find the summary line "N / M tests passed." or "No tests run."
    let marker_pos = clean.find(" tests passed.").or_else(|| clean.find("No tests run."));
    if let Some(idx) = marker_pos {
        let line_start = clean[..idx].rfind('\n').map(|i| i + 1).unwrap_or(0);
        // line_start is a valid byte offset in clean; since strip_ansi only removes
        // ASCII escape sequences, newlines stay at the same line positions.
        // Count newlines before line_start to find the same line in raw.
        let target_line = clean[..line_start].matches('\n').count();
        let raw_start = raw
            .match_indices('\n')
            .nth(target_line.saturating_sub(1))
            .map(|(i, _)| i + 1)
            .unwrap_or(0);
        return &raw[raw_start..];
    }
    raw
}

fn parse_test_result_lines(raw: &str) -> Vec<serde_json::Value> {
    let clean = strip_ansi(raw);
    clean.lines().filter_map(|line| {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("PASSED: ") {
            Some(serde_json::json!({ "name": rest.trim(), "passed": true, "error": null }))
        } else if let Some(rest) = line.strip_prefix("FAILED: ") {
            let (name, error) = rest.split_once(" | ").unwrap_or((rest, ""));
            Some(serde_json::json!({ "name": name.trim(), "passed": false, "error": error.trim() }))
        } else {
            None
        }
    }).collect()
}

fn extract_run_output(raw: &str) -> String {
    let clean = strip_ansi(raw);
    if let Some(idx) = clean.find("Output") {
        let after = &clean[idx + 6..];
        let end   = after.find("Finished").unwrap_or(after.len());
        let values: Vec<&str> = after[..end]
            .lines()
            .map(|l| l.trim().trim_start_matches('•').trim())
            .filter(|l| !l.is_empty())
            .collect();
        if !values.is_empty() {
            return values.join("\n");
        }
    }
    // Fallback: strip noise, return non-empty lines
    clean.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn extract_program_name(source: &str) -> String {
    source
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            trimmed.strip_prefix("program ").and_then(|rest| {
                // Leo 4.x: "program foo.aleo {" — strip trailing '{' or ';'
                let name = rest.trim_end_matches(['{', ';', ' ']).trim();
                name.ends_with(".aleo").then(|| name.to_string())
            })
        })
        .unwrap_or_else(|| "main.aleo".to_string())
}

fn resolve_program_json(source: &str, provided: Option<&str>) -> String {
    if let Some(s) = provided {
        if !s.trim().is_empty() {
            return s.to_string();
        }
    }
    let program_name = extract_program_name(source);
    format!(r#"{{"program":"{program_name}","version":"0.0.0","description":"","license":"MIT"}}"#)
}

async fn build_handler(Json(req): Json<BuildRequest>) -> Json<BuildResponse> {
    let tmp = match TempDir::new() {
        Ok(t) => t,
        Err(e) => {
            return Json(BuildResponse {
                success: false,
                output: String::new(),
                abi: String::new(),
                errors: format!("Failed to create temp dir: {e}"),
            })
        }
    };

    let tmp_path = tmp.path();
    let program_json = resolve_program_json(&req.source, req.program_json.as_deref());

    let src_dir = tmp_path.join("src");
    if let Err(e) = fs::create_dir(&src_dir).and_then(|_| {
        fs::write(src_dir.join("main.leo"), &req.source)?;
        fs::write(tmp_path.join("program.json"), &program_json)
    }) {
        return Json(BuildResponse {
            success: false,
            output: String::new(),
            abi: String::new(),
            errors: format!("Failed to write files: {e}"),
        });
    }

    let leo = find_leo();
    let result = Command::new(&leo).env("CLICOLOR_FORCE", "1")
        .arg("build")
        .current_dir(tmp_path)
        .output()
        .await;

    match result {
        Ok(out) if out.status.success() => {
            let build_dir = tmp_path.join("build");
            let output = fs::read_to_string(build_dir.join("main.aleo")).unwrap_or_default();
            let abi = fs::read_to_string(build_dir.join("abi.json")).unwrap_or_default();
            Json(BuildResponse { success: true, output, abi, errors: String::new() })
        }
        Ok(out) => {
            let errors = ansi_to_html(&String::from_utf8_lossy(&out.stderr));
            Json(BuildResponse { success: false, output: String::new(), abi: String::new(), errors })
        }
        Err(e) => Json(BuildResponse {
            success: false,
            output: String::new(),
            abi: String::new(),
            errors: format!("Failed to run leo ({leo}): {e}"),
        }),
    }
}

async fn format_handler(Json(req): Json<BuildRequest>) -> Json<serde_json::Value> {
    let tmp = match TempDir::new() {
        Ok(t) => t,
        Err(e) => return Json(serde_json::json!({ "success": false, "errors": format!("tempdir: {e}") })),
    };

    let tmp_path = tmp.path();
    let program_json = resolve_program_json(&req.source, req.program_json.as_deref());

    let src_dir = tmp_path.join("src");
    if let Err(e) = fs::create_dir(&src_dir).and_then(|_| {
        fs::write(src_dir.join("main.leo"), &req.source)?;
        fs::write(tmp_path.join("program.json"), &program_json)
    }) {
        return Json(serde_json::json!({ "success": false, "errors": format!("fs: {e}") }));
    }

    let leo = find_leo();
    match Command::new(&leo).env("CLICOLOR_FORCE", "1")
        .arg("fmt")
        .current_dir(tmp_path)
        .output()
        .await
    {
        Ok(out) if out.status.success() => {
            let formatted = fs::read_to_string(src_dir.join("main.leo"))
                .unwrap_or(req.source);
            Json(serde_json::json!({ "success": true, "source": formatted }))
        }
        Ok(out) => {
            let errors = ansi_to_html(&String::from_utf8_lossy(&out.stderr));
            Json(serde_json::json!({ "success": false, "errors": errors }))
        }
        Err(e) => Json(serde_json::json!({ "success": false, "errors": format!("exec {leo}: {e}") })),
    }
}

async fn run_handler(Json(req): Json<RunRequest>) -> Json<serde_json::Value> {
    let tmp = match TempDir::new() {
        Ok(t) => t,
        Err(e) => return Json(serde_json::json!({ "success": false, "errors": format!("tempdir: {e}") })),
    };

    let tmp_path = tmp.path();
    let program_json = resolve_program_json(&req.source, req.program_json.as_deref());

    let src_dir = tmp_path.join("src");
    if let Err(e) = fs::create_dir(&src_dir).and_then(|_| {
        fs::write(src_dir.join("main.leo"), &req.source)?;
        fs::write(tmp_path.join("program.json"), &program_json)
    }) {
        return Json(serde_json::json!({ "success": false, "errors": format!("fs: {e}") }));
    }

    let leo = find_leo();
    let mut cmd = Command::new(&leo);
    cmd.env("CLICOLOR_FORCE", "1").arg("run").arg(&req.function_name);
    for input in &req.inputs {
        cmd.arg(input);
    }
    cmd.current_dir(tmp_path);

    match cmd.output().await {
        Ok(out) => {
            let combined = format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr),
            );
            if out.status.success() {
                let output = extract_run_output(&combined);
                Json(serde_json::json!({ "success": true, "output": output }))
            } else {
                Json(serde_json::json!({ "success": false, "errors": ansi_to_html(&combined) }))
            }
        }
        Err(e) => Json(serde_json::json!({ "success": false, "errors": format!("exec {leo}: {e}") })),
    }
}

async fn version_handler() -> Json<serde_json::Value> {
    let version = Command::new(find_leo())
        .arg("--version")
        .output()
        .await
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "leo".to_string());
    Json(serde_json::json!({ "version": version }))
}

async fn test_handler(Json(req): Json<TestRequest>) -> Json<serde_json::Value> {
    let tmp = match TempDir::new() {
        Ok(t) => t,
        Err(e) => return Json(serde_json::json!({ "success": false, "output": "", "errors": format!("tempdir: {e}") })),
    };

    let tmp_path = tmp.path();
    let program_json = resolve_program_json(&req.source, req.program_json.as_deref());
    let test_name = extract_program_name(&req.test_source)
        .trim_end_matches(".aleo")
        .to_string();

    let src_dir   = tmp_path.join("src");
    let tests_dir = tmp_path.join("tests");
    if let Err(e) = fs::create_dir(&src_dir)
        .and_then(|_| fs::create_dir(&tests_dir))
        .and_then(|_| fs::write(src_dir.join("main.leo"), &req.source))
        .and_then(|_| fs::write(tests_dir.join(format!("{test_name}.leo")), &req.test_source))
        .and_then(|_| fs::write(tmp_path.join("program.json"), &program_json))
    {
        return Json(serde_json::json!({ "success": false, "output": "", "errors": format!("fs: {e}") }));
    }

    let leo = find_leo();
    let mut cmd = Command::new(&leo);
    cmd.env("CLICOLOR_FORCE", "1").arg("test");
    if let Some(filter) = req.test_filter.as_deref().filter(|s| !s.is_empty()) {
        cmd.arg(filter);
    }
    cmd.current_dir(tmp_path);

    match cmd.output().await {
        Ok(out) => {
            let combined = format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr),
            );
            let results = parse_test_result_lines(&combined);
            let (output, diagnostics) = if results.is_empty() && !out.status.success() {
                (String::new(), ansi_to_html(extract_compile_errors(&combined)))
            } else {
                (ansi_to_html(extract_test_results(&combined)), String::new())
            };
            Json(serde_json::json!({
                "success":     out.status.success(),
                "output":      output,
                "diagnostics": diagnostics,
                "results":     results,
            }))
        }
        Err(e) => Json(serde_json::json!({
            "success":     false,
            "output":      "",
            "diagnostics": "",
            "results":     [],
            "errors":      format!("exec {leo}: {e}"),
        })),
    }
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/build",   post(build_handler))
        .route("/api/format",  post(format_handler))
        .route("/api/run",     post(run_handler))
        .route("/api/test",    post(test_handler))
        .route("/api/version", axum::routing::get(version_handler))
        .layer(CorsLayer::permissive())
        .fallback_service(ServeDir::new("assets"));

    let addr = "127.0.0.1:3000";
    println!("Leo Playground → http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
