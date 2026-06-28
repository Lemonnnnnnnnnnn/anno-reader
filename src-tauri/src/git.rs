use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatus {
    pub is_repo: bool,
    pub remote: Option<String>,
    pub remote_protocol: Option<String>, // "ssh" or "https"
    pub branch: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub has_changes: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResult {
    pub success: bool,
    pub message: String,
    pub conflicts: Vec<String>,
}

/// Run a git command in the given directory and return stdout.
/// Logs the full command, exit code, stdout, and stderr to stderr for debugging.
fn run_git(data_dir: &str, args: &[&str]) -> Result<String, String> {
    eprintln!("[git] $ git {} (cwd: {})", args.join(" "), data_dir);
    let output = Command::new("git")
        .current_dir(data_dir)
        .args(args)
        .output()
        .map_err(|e| {
            eprintln!("[git] failed to spawn git process: {}", e);
            format!("Failed to run git: {}", e)
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let exit_code = output.status.code();

    eprintln!(
        "[git] exit={:?} stdout={:?} stderr={:?}",
        exit_code, stdout, stderr
    );

    if output.status.success() {
        Ok(stdout)
    } else {
        // Some git failures (e.g. "nothing to commit") print to stdout with
        // empty stderr. Fall back to stdout so the surfaced error is never blank.
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        Err(detail)
    }
}

/// Detect protocol from remote URL.
fn detect_protocol(url: &str) -> String {
    if url.starts_with("ssh://") || (url.contains('@') && url.contains(':') && !url.contains("://"))
    {
        "ssh".to_string()
    } else if url.starts_with("https://") || url.starts_with("http://") {
        "https".to_string()
    } else {
        "unknown".to_string()
    }
}

/// Get git status for a directory.
/// Returns GitStatus with repo info, remote, branch, and ahead/behind counts.
#[tauri::command]
pub async fn git_status(data_dir: String) -> Result<GitStatus, String> {
    // Check if inside a git repo
    let is_repo = run_git(&data_dir, &["rev-parse", "--is-inside-work-tree"])
        .map(|out| out == "true")
        .unwrap_or(false);

    if !is_repo {
        return Ok(GitStatus {
            is_repo: false,
            remote: None,
            remote_protocol: None,
            branch: None,
            ahead: 0,
            behind: 0,
            has_changes: false,
        });
    }

    // Get current branch
    let branch = run_git(&data_dir, &["branch", "--show-current"]).ok();

    // Get remote URL
    let remote = run_git(&data_dir, &["remote", "get-url", "origin"]).ok();
    let remote_protocol = remote.as_ref().map(|url| detect_protocol(url));

    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(&data_dir);

    // Check for uncommitted changes
    let has_changes = run_git(&data_dir, &["status", "--porcelain"])
        .map(|out| !out.is_empty())
        .unwrap_or(false);

    Ok(GitStatus {
        is_repo: true,
        remote,
        remote_protocol,
        branch,
        ahead,
        behind,
        has_changes,
    })
}

/// Get ahead/behind counts for current branch vs upstream.
fn get_ahead_behind(data_dir: &str) -> (usize, usize) {
    let output = match run_git(data_dir, &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
    {
        Ok(out) => out,
        Err(_) => return (0, 0),
    };

    let parts: Vec<&str> = output.split('\t').collect();
    if parts.len() == 2 {
        let ahead = parts[0].parse().unwrap_or(0);
        let behind = parts[1].parse().unwrap_or(0);
        (ahead, behind)
    } else {
        (0, 0)
    }
}

/// Sync git repository: pull (fast-fail) -> add . -> commit -> push.
/// Uses the provided message template with {datetime}, {date}, {time} placeholders.
#[tauri::command]
pub async fn git_sync(
    data_dir: String,
    message_template: Option<String>,
) -> Result<SyncResult, String> {
    let template = message_template.unwrap_or_else(|| "Sync at {datetime}".to_string());
    eprintln!("[sync] starting git_sync in {}", data_dir);

    // Step 1: Pull with auto-merge for JSON files
    eprintln!("[sync] step 1/4: pull with auto-merge");
    match git_pull(&data_dir) {
        Ok(_) => eprintln!("[sync] pull ok"),
        Err(conflicts) => {
            eprintln!("[sync] pull failed, conflicts: {:?}", conflicts);
            return Ok(SyncResult {
                success: false,
                message: "Pull failed".to_string(),
                conflicts,
            });
        }
    }

    // Step 2: Add all changes
    eprintln!("[sync] step 2/4: add .");
    run_git(&data_dir, &["add", "."])
        .map_err(|e| format!("Failed to add files: {}", e))?;

    // Step 3: Commit. After a clean merge, git already created the merge commit,
    // so there may be nothing left to commit — `git commit` then exits non-zero
    // with "nothing to commit" on stdout. Treat that specific case as success.
    let message = render_message(&template);
    eprintln!("[sync] step 3/4: commit ({:?})", message);
    match run_git(&data_dir, &["commit", "-m", &message]) {
        Ok(out) => eprintln!("[sync] commit ok: {}", out),
        Err(e) if e.contains("nothing to commit") || e.contains("no changes added") => {
            eprintln!("[sync] nothing to commit (clean tree / merge already committed) — ok");
        }
        Err(e) => return Err(format!("Failed to commit: {}", e)),
    }

    // Step 4: Push
    eprintln!("[sync] step 4/4: push");
    run_git(&data_dir, &["push"]).map_err(|e| format!("Failed to push: {}", e))?;

    eprintln!("[sync] sync complete");
    Ok(SyncResult {
        success: true,
        message: format!("Synced successfully: {}", message),
        conflicts: vec![],
    })
}

/// Pull with auto-merge for JSON files. Returns conflict file list on failure.
fn git_pull(data_dir: &str) -> Result<(), Vec<String>> {
    // Try fetch + merge (fast-fail only first)
    eprintln!("[pull] fetch origin");
    run_git(data_dir, &["fetch", "origin"])
        .map_err(|e| vec![format!("Fetch failed: {}", e)])?;

    // Try fast-forward merge
    eprintln!("[pull] try fast-forward merge");
    match run_git(data_dir, &["merge", "--ff-only"]) {
        Ok(_) => {
            eprintln!("[pull] fast-forward succeeded, nothing else to do");
            return Ok(());
        }
        Err(e) => {
            eprintln!("[pull] fast-forward failed: {}", e);
        }
    }

    // Try regular merge against the tracked upstream (resolves to origin/master
    // or origin/main depending on the repo). Hardcoding "origin/main" broke repos
    // on "master" — the merge never happened and git_pull falsely reported success.
    eprintln!("[pull] try regular merge with @{{upstream}}");
    let merge_result = run_git(data_dir, &["merge", "@{upstream}", "--no-edit"]);

    match merge_result {
        Ok(_) => {
            eprintln!("[pull] regular merge succeeded without conflicts");
            Ok(())
        }
        Err(e) => {
            eprintln!("[pull] merge produced conflicts: {}", e);
            // Merge has conflicts, try to auto-resolve JSON files
            let conflicts = get_conflicted_files(data_dir);
            eprintln!("[pull] conflicted files: {:?}", conflicts);

            // If merge failed but there are no conflict markers, this is a real
            // error (e.g. unknown ref, missing upstream) — NOT a conflict. Falling
            // through here used to falsely report "all conflicts auto-resolved".
            if conflicts.is_empty() {
                let _ = run_git(data_dir, &["merge", "--abort"]);
                return Err(vec![format!("Merge failed: {}", e)]);
            }

            let mut unresolved = Vec::new();

            for file in &conflicts {
                if file.ends_with(".json") {
                    // Try to auto-merge JSON files
                    eprintln!("[pull] auto-merging JSON: {}", file);
                    match auto_merge_json(data_dir, file) {
                        Ok(_) => {
                            eprintln!("[pull] auto-merge ok: {}", file);
                            // Successfully merged, mark as resolved
                            let _ = run_git(data_dir, &["add", file]);
                        }
                        Err(err) => {
                            eprintln!("[pull] auto-merge FAILED for {}: {}", file, err);
                            unresolved.push(format!("{}: {}", file, err));
                        }
                    }
                } else {
                    eprintln!("[pull] skipping non-JSON conflict: {}", file);
                    unresolved.push(file.clone());
                }
            }

            if unresolved.is_empty() {
                // All conflicts resolved
                eprintln!("[pull] all conflicts auto-resolved");
                Ok(())
            } else {
                // Abort the merge
                eprintln!("[pull] unresolved conflicts, aborting merge: {:?}", unresolved);
                let _ = run_git(data_dir, &["merge", "--abort"]);
                Err(unresolved)
            }
        }
    }
}

/// Get list of conflicted files from git status.
fn get_conflicted_files(data_dir: &str) -> Vec<String> {
    let mut conflicts = Vec::new();

    if let Ok(status) = run_git(data_dir, &["status", "--porcelain"]) {
        for line in status.lines() {
            // UU = both modified, AA = both added, DD = both deleted
            if line.starts_with("UU") || line.starts_with("AA") || line.starts_with("DD") {
                if let Some(file) = line.get(3..) {
                    conflicts.push(file.trim().to_string());
                }
            }
        }
    }

    conflicts
}

/// Auto-merge a JSON file with conflict markers.
/// Reads the two sides from git's index stages (stage 2 = ours/HEAD, stage 3 =
/// theirs/upstream) rather than parsing conflict markers from the working tree.
/// Those stages hold clean, complete copies of each version, so we can parse
/// them as JSON directly. Parsing markers only worked when the *entire* file was
/// one conflict block; scattered field changes produced fragments that aren't
/// valid JSON.
/// Strategy depends on file type:
/// - progress.json: take the most recent (by lastUpdated)
/// - notes.json: merge by id, keep latest updatedAt
/// - highlights.json: merge by id
/// - bookshelf.json: merge entries by id
fn auto_merge_json(data_dir: &str, file: &str) -> Result<(), String> {
    eprintln!("[merge] reading sides from index stages for {}", file);
    let ours = run_git(data_dir, &["show", &format!(":2:{}", file)])
        .map_err(|e| format!("Cannot read ours (stage 2): {}", e))?;
    let theirs = run_git(data_dir, &["show", &format!(":3:{}", file)])
        .map_err(|e| format!("Cannot read theirs (stage 3): {}", e))?;

    let our_value: Value =
        serde_json::from_str(&ours).map_err(|e| format!("Invalid local JSON: {}", e))?;
    let their_value: Value =
        serde_json::from_str(&theirs).map_err(|e| format!("Invalid remote JSON: {}", e))?;

    // Determine merge strategy based on file name
    let merged = if file.ends_with("progress.json") {
        merge_progress(our_value, their_value)?
    } else if file.ends_with("notes.json") {
        merge_array_by_id(our_value, their_value, "updatedAt")?
    } else if file.ends_with("highlights.json") {
        merge_array_by_id(our_value, their_value, "createdAt")?
    } else if file.ends_with("bookshelf.json") {
        merge_bookshelf(our_value, their_value)?
    } else {
        // Default: take theirs for unknown JSON files
        their_value
    };

    // Write merged result back to the working tree
    let path = Path::new(data_dir).join(file);
    let merged_str =
        serde_json::to_string_pretty(&merged).map_err(|e| format!("Serialize error: {}", e))?;
    fs::write(&path, merged_str).map_err(|e| format!("Write error: {}", e))?;

    eprintln!("[merge] merged {} ({} bytes written)", file, path.metadata().map(|m| m.len()).unwrap_or(0));
    Ok(())
}

/// Merge progress.json: take the one with most recent lastUpdated.
fn merge_progress(ours: Value, theirs: Value) -> Result<Value, String> {
    let our_time = ours
        .get("lastUpdated")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let their_time = theirs
        .get("lastUpdated")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Compare timestamps (ISO 8601 strings compare lexicographically)
    if their_time > our_time {
        Ok(theirs)
    } else {
        Ok(ours)
    }
}

/// Merge arrays by id, keeping the item with newer timestamp.
/// timestamp_field: "updatedAt" for notes, "createdAt" for highlights
fn merge_array_by_id(ours: Value, theirs: Value, timestamp_field: &str) -> Result<Value, String> {
    let our_arr = ours.as_array().ok_or("Expected array")?;
    let their_arr = theirs.as_array().ok_or("Expected array")?;

    let mut merged: HashMap<String, Value> = HashMap::new();

    // Add our items
    for item in our_arr {
        if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
            merged.insert(id.to_string(), item.clone());
        }
    }

    // Add/replace with their items if newer
    for item in their_arr {
        if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
            let should_replace = match merged.get(id) {
                Some(existing) => {
                    let existing_time = existing
                        .get(timestamp_field)
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let new_time = item
                        .get(timestamp_field)
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    new_time > existing_time
                }
                None => true,
            };

            if should_replace {
                merged.insert(id.to_string(), item.clone());
            }
        }
    }

    // Convert back to array
    let result: Vec<Value> = merged.into_values().collect();
    Ok(Value::Array(result))
}

/// Merge bookshelf.json: merge entries by id.
fn merge_bookshelf(ours: Value, theirs: Value) -> Result<Value, String> {
    let our_entries = ours
        .get("entries")
        .and_then(|v| v.as_array())
        .ok_or("Expected entries array")?;
    let their_entries = theirs
        .get("entries")
        .and_then(|v| v.as_array())
        .ok_or("Expected entries array")?;

    let mut merged: HashMap<String, Value> = HashMap::new();

    // Add our entries
    for entry in our_entries {
        if let Some(id) = entry.get("id").and_then(|v| v.as_str()) {
            merged.insert(id.to_string(), entry.clone());
        }
    }

    // Add/replace with their entries (keep newer lastOpened)
    for entry in their_entries {
        if let Some(id) = entry.get("id").and_then(|v| v.as_str()) {
            let should_replace = match merged.get(id) {
                Some(existing) => {
                    let existing_time = existing
                        .get("lastOpened")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0);
                    let new_time = entry
                        .get("lastOpened")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0);
                    new_time > existing_time
                }
                None => true,
            };

            if should_replace {
                merged.insert(id.to_string(), entry.clone());
            }
        }
    }

    // Convert back to array and wrap in object
    let entries: Vec<Value> = merged.into_values().collect();
    let mut result = serde_json::Map::new();
    result.insert("entries".to_string(), Value::Array(entries));

    Ok(Value::Object(result))
}

/// Render commit message template with placeholders.
fn render_message(template: &str) -> String {
    let now = chrono::Local::now();
    template
        .replace("{datetime}", &now.format("%Y-%m-%d %H:%M:%S").to_string())
        .replace("{date}", &now.format("%Y-%m-%d").to_string())
        .replace("{time}", &now.format("%H:%M:%S").to_string())
}
