use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Creation flag that prevents a child process from flashing a console window.
/// See: https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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
fn run_git(data_dir: &str, args: &[&str]) -> Result<String, String> {
    log_git_invocation(data_dir, args);

    let mut command = Command::new("git");
    command.current_dir(data_dir).args(args);

    // On Windows, prevent the child process from briefly flashing a console
    // window. On non-Windows platforms this is a no-op.
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let output = command.output();

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

            if output.status.success() {
                log_git_success(args, &stdout, &stderr);
                Ok(stdout)
            } else {
                log_git_failure(args, output.status.code(), &stdout, &stderr);
                Err(stderr)
            }
        }
        Err(e) => {
            log_git_spawn_error(args, &e);
            Err(format!("Failed to run git: {}", e))
        }
    }
}

/// Format a git invocation as a single command line for logging.
fn fmt_cmd(args: &[&str]) -> String {
    let mut s = String::from("git");
    for a in args {
        s.push(' ');
        // Quote args containing spaces so the log line is unambiguous.
        if a.contains(' ') {
            s.push('"');
            s.push_str(a);
            s.push('"');
        } else {
            s.push_str(a);
        }
    }
    s
}

/// Truncate a log string to keep stderr/stdout output manageable.
fn truncate_for_log(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{} …<+{} bytes>", &s[..max], s.len() - max)
    }
}

fn log_git_invocation(data_dir: &str, args: &[&str]) {
    eprintln!(
        "[git] >>> run  cwd={} cmd={}",
        data_dir,
        fmt_cmd(args)
    );
}

fn log_git_success(args: &[&str], stdout: &str, stderr: &str) {
    eprintln!(
        "[git] <<< ok   cmd={} code=0 stdout={} stderr={}",
        fmt_cmd(args),
        truncate_for_log(stdout, 200),
        if stderr.is_empty() {
            "(empty)".to_string()
        } else {
            truncate_for_log(stderr, 200)
        },
    );
}

fn log_git_failure(args: &[&str], code: Option<i32>, stdout: &str, stderr: &str) {
    eprintln!(
        "[git] <<< FAIL cmd={} code={} stdout={} stderr={}",
        fmt_cmd(args),
        match code {
            Some(c) => c.to_string(),
            None => "<signal>".to_string(),
        },
        truncate_for_log(stdout, 500),
        truncate_for_log(stderr, 1000),
    );
}

fn log_git_spawn_error(args: &[&str], e: &std::io::Error) {
    eprintln!(
        "[git] !!! spawn error cmd={} kind={} msg={}",
        fmt_cmd(args),
        e.kind(),
        e,
    );
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
    eprintln!("[sync] === start === dir={}", data_dir);

    // Step 1: Pull with auto-merge for JSON files
    eprintln!("[sync] step 1/4: pull");
    match git_pull(&data_dir) {
        Ok(_) => {
            eprintln!("[sync] step 1/4: pull OK");
        }
        Err(conflicts) => {
            eprintln!(
                "[sync] step 1/4: pull FAILED with {} conflict(s): {:?}",
                conflicts.len(),
                conflicts
            );
            return Ok(SyncResult {
                success: false,
                message: "Pull failed".to_string(),
                conflicts,
            });
        }
    }

    // Step 2: Add all changes
    eprintln!("[sync] step 2/4: add .");
    run_git(&data_dir, &["add", "."]).map_err(|e| {
        eprintln!("[sync] step 2/4: add FAILED: {}", e);
        format!("Failed to add files: {}", e)
    })?;

    // Step 3: Commit
    let message = render_message(&template);
    eprintln!("[sync] step 3/4: commit message={:?}", message);

    // Skip commit when there is nothing staged. Relying on the working tree
    // state is more reliable than parsing git's stdout/stderr text, which
    // differs across git versions and locales.
    let has_staged = run_git(&data_dir, &["diff", "--cached", "--quiet"])
        .is_err(); // exit 1 = staged changes present
    eprintln!("[sync] step 3/4: staged changes present={}", has_staged);

    if has_staged {
        match run_git(&data_dir, &["commit", "-m", &message]) {
            Ok(out) => {
                eprintln!(
                    "[sync] step 3/4: commit OK: {}",
                    truncate_for_log(&out, 200)
                );
            }
            Err(e) => {
                eprintln!("[sync] step 3/4: commit FAILED: {}", e);
                return Err(format!("Failed to commit: {}", e));
            }
        }
    } else {
        eprintln!("[sync] step 3/4: nothing to commit, skipping");
    }

    // Step 4: Push
    eprintln!("[sync] step 4/4: push");
    run_git(&data_dir, &["push"]).map_err(|e| {
        eprintln!("[sync] step 4/4: push FAILED: {}", e);
        format!("Failed to push: {}", e)
    })?;

    eprintln!("[sync] === done ===");
    Ok(SyncResult {
        success: true,
        message: format!("Synced successfully: {}", message),
        conflicts: vec![],
    })
}

/// Detect the current branch name. Returns None on detached HEAD or failure.
fn current_branch(data_dir: &str) -> Option<String> {
    run_git(data_dir, &["branch", "--show-current"])
        .ok()
        .filter(|s| !s.is_empty())
}

/// Check whether the repo is currently in the middle of a merge.
fn is_merge_in_progress(data_dir: &str) -> bool {
    Path::new(data_dir).join(".git").join("MERGE_HEAD").exists()
}

/// Pull with auto-merge for JSON files. Returns conflict file list on failure.
fn git_pull(data_dir: &str) -> Result<(), Vec<String>> {
    // Detect current branch so we can merge the correct upstream ref.
    // Hard-coding "origin/main" breaks repos whose default branch is "master"
    // or anything else.
    let branch = match current_branch(data_dir) {
        Some(b) => {
            eprintln!("[pull] current branch={}", b);
            b
        }
        None => {
            return Err(vec![
                "Cannot detect current branch (detached HEAD?).".to_string(),
            ]);
        }
    };
    let upstream = format!("origin/{}", branch);

    // Try fetch + merge (fast-forward only first)
    eprintln!("[pull] fetch origin");
    run_git(data_dir, &["fetch", "origin"])
        .map_err(|e| vec![format!("Fetch failed: {}", e)])?;

    // Try fast-forward merge
    eprintln!("[pull] merge --ff-only");
    match run_git(data_dir, &["merge", "--ff-only"]) {
        Ok(_) => {
            eprintln!("[pull] fast-forward merge succeeded");
            return Ok(());
        }
        Err(detail) => {
            eprintln!(
                "[pull] fast-forward merge failed, falling back to regular merge: {}",
                truncate_for_log(&detail, 200)
            );
        }
    }

    // Regular merge against the correct upstream branch. We pass the explicit
    // ref so it works regardless of the branch's configured upstream name.
    eprintln!("[pull] merge {} --no-edit", upstream);
    let merge_args: [&str; 3] = ["merge", &upstream, "--no-edit"];
    let merge_result = run_git(data_dir, &merge_args);

    match merge_result {
        Ok(out) => {
            eprintln!(
                "[pull] regular merge succeeded: {}",
                truncate_for_log(&out, 200)
            );
            Ok(())
        }
        Err(detail) => {
            // IMPORTANT: a failed merge here can mean two very different things:
            //   (a) real conflicts — git leaves conflict markers in the working
            //       tree and the repo is in MERGING state
            //   (b) command-level failure — ref doesn't exist, network error,
            //       lock contention, etc. No conflict markers are produced
            // We must distinguish them, otherwise we silently swallow errors
            // and pretend the pull succeeded.
            let conflicts = get_conflicted_files(data_dir);
            if conflicts.is_empty() {
                eprintln!(
                    "[pull] merge failed WITHOUT conflict markers — treating as hard error: {}",
                    truncate_for_log(&detail, 500)
                );
                // Defensive: abort in case any partial state was left.
                if is_merge_in_progress(data_dir) {
                    let _ = run_git(data_dir, &["merge", "--abort"]);
                }
                return Err(vec![format!("Merge failed: {}", detail)]);
            }

            eprintln!(
                "[pull] regular merge produced {} conflict(s): {:?}",
                conflicts.len(),
                conflicts
            );
            let mut unresolved = Vec::new();

            for file in &conflicts {
                if file.ends_with(".json") {
                    eprintln!("[pull] auto-merging JSON file: {}", file);
                    match auto_merge_json(data_dir, file) {
                        Ok(_) => {
                            eprintln!("[pull] auto-merge OK: {}", file);
                            // Successfully merged, mark as resolved
                            let _ = run_git(data_dir, &["add", file]);
                        }
                        Err(e) => {
                            eprintln!("[pull] auto-merge FAILED for {}: {}", file, e);
                            unresolved.push(format!("{}: {}", file, e));
                        }
                    }
                } else {
                    eprintln!(
                        "[pull] non-JSON conflict, cannot auto-merge: {}",
                        file
                    );
                    unresolved.push(file.clone());
                }
            }

            if unresolved.is_empty() {
                // All conflicts resolved; finalize the merge with a commit.
                // Unlike user commits, a merge-in-progress commit must not be
                // skipped even if the working tree happens to look clean.
                eprintln!("[pull] all conflicts resolved, finalizing merge commit");
                match run_git(data_dir, &["commit", "--no-edit"]) {
                    Ok(out) => {
                        eprintln!(
                            "[pull] merge commit OK: {}",
                            truncate_for_log(&out, 200)
                        );
                        Ok(())
                    }
                    Err(e) => {
                        eprintln!("[pull] merge commit FAILED: {}", e);
                        let _ = run_git(data_dir, &["merge", "--abort"]);
                        Err(vec![format!(
                            "Merge commit failed after auto-resolve: {}",
                            e
                        )])
                    }
                }
            } else {
                // Abort the merge
                eprintln!(
                    "[pull] {} conflict(s) unresolved, aborting merge",
                    unresolved.len()
                );
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
            if line.starts_with("UU")
                || line.starts_with("AA")
                || line.starts_with("DD")
                || line.starts_with("DU")
                || line.starts_with("UD")
                || line.starts_with("AU")
                || line.starts_with("UA")
            {
                if let Some(file) = line.get(3..) {
                    conflicts.push(file.trim().to_string());
                }
            }
        }
    }

    conflicts
}

/// Auto-merge a JSON file with conflict markers.
/// Strategy depends on file type:
/// - progress.json: take the most recent (by lastUpdated)
/// - notes.json: merge by id, keep latest updatedAt
/// - highlights.json: merge by id
/// - bookshelf.json: merge entries by id
///
/// Ours/theirs versions are read from the git index stages (not by parsing
/// conflict markers from the working tree). During a merge, git keeps three
/// versions of a conflicted file in the index:
///   :1:<file> = merge base (common ancestor)
///   :2:<file> = ours (HEAD)
///   :3:<file> = theirs (MERGE_HEAD)
/// Using `git show :N:<file>` returns the full, valid JSON for each side,
/// avoiding the brittle and error-prone marker parsing approach (which fails
/// whenever git emits a partial-region conflict, e.g. when only a few fields
/// of an object differ).
fn auto_merge_json(data_dir: &str, file: &str) -> Result<(), String> {
    eprintln!("[merge] resolving {}", file);

    // Read ours and theirs from the index stages.
    let ours = run_git(data_dir, &["show", &format!(":2:{}", file)])
        .map_err(|e| format!("Cannot read ours (index stage 2): {}", e))?;
    let theirs = run_git(data_dir, &["show", &format!(":3:{}", file)])
        .map_err(|e| format!("Cannot read theirs (index stage 3): {}", e))?;

    eprintln!(
        "[merge] {} ours={} bytes theirs={} bytes",
        file,
        ours.len(),
        theirs.len()
    );

    let our_value: Value =
        serde_json::from_str(&ours).map_err(|e| format!("Invalid local JSON: {}", e))?;
    let their_value: Value =
        serde_json::from_str(&theirs).map_err(|e| format!("Invalid remote JSON: {}", e))?;

    // Determine merge strategy based on file name
    let merged = if file.ends_with("progress.json") {
        eprintln!("[merge] {} strategy=progress (latest lastUpdated)", file);
        merge_progress(our_value, their_value)?
    } else if file.ends_with("notes.json") {
        eprintln!("[merge] {} strategy=notes (merge by id, latest updatedAt)", file);
        merge_array_by_id(our_value, their_value, "updatedAt")?
    } else if file.ends_with("highlights.json") {
        eprintln!(
            "[merge] {} strategy=highlights (merge by id, latest createdAt)",
            file
        );
        merge_array_by_id(our_value, their_value, "createdAt")?
    } else if file.ends_with("bookshelf.json") {
        eprintln!(
            "[merge] {} strategy=bookshelf (merge entries by id)",
            file
        );
        merge_bookshelf(our_value, their_value)?
    } else {
        eprintln!("[merge] {} strategy=default (take theirs)", file);
        their_value
    };

    // Write merged result to the working tree
    let merged_str =
        serde_json::to_string_pretty(&merged).map_err(|e| format!("Serialize error: {}", e))?;
    let path = Path::new(data_dir).join(file);
    eprintln!("[merge] {} wrote {} bytes", file, merged_str.len());
    fs::write(&path, merged_str).map_err(|e| format!("Write error: {}", e))?;

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
