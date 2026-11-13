use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Creation flag that prevents a child process from flashing a console window.
/// See: https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Timeout for local git operations (status, add, commit, merge).
const LOCAL_TIMEOUT_SECS: u64 = 60;
/// Timeout for network git operations (fetch, push). Generous so slow links
/// still finish, but finite so a wedged process can never stall sync forever.
const NETWORK_TIMEOUT_SECS: u64 = 120;
/// Poll interval while waiting for a git child process to exit.
const GIT_POLL_MS: u64 = 50;

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
    /// Whether the sync's pull brought remote commits down. Lets the UI
    /// reload data that a pull may have rewritten on disk (e.g. bookshelf).
    pub pulled: bool,
}

/// Run a git command in the given directory and return stdout.
fn run_git(data_dir: &str, args: &[&str]) -> Result<String, String> {
    run_git_timeout(data_dir, args, LOCAL_TIMEOUT_SECS)
}

/// Run a network git command (fetch/push) with the longer timeout.
fn run_git_network(data_dir: &str, args: &[&str]) -> Result<String, String> {
    run_git_timeout(data_dir, args, NETWORK_TIMEOUT_SECS)
}

/// Run a git command with a hard timeout.
///
/// Two guards keep a sync from ever wedging:
/// - Interactive credential prompts are disabled (GIT_TERMINAL_PROMPT=0,
///   GCM_INTERACTIVE=Never). Without a TTY a prompt would hang forever, and
///   the awaiting runSync would leave isSyncing stuck on true — silently
///   disabling every future sync with no error surfaced.
/// - The child is killed once the timeout elapses. stdout/stderr are drained
///   on threads so a chatty command cannot fill the OS pipe buffer and
///   deadlock while we poll for exit.
fn run_git_timeout(data_dir: &str, args: &[&str], timeout_secs: u64) -> Result<String, String> {
    log_git_invocation(data_dir, args);

    let mut command = Command::new("git");
    command.current_dir(data_dir).args(args);
    command.env("GIT_TERMINAL_PROMPT", "0");
    command.env("GCM_INTERACTIVE", "Never");

    // On Windows, prevent the child process from briefly flashing a console
    // window. On non-Windows platforms this is a no-op.
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = match command.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn() {
        Ok(child) => child,
        Err(e) => {
            log_git_spawn_error(args, &e);
            return Err(format!("Failed to run git: {}", e));
        }
    };

    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();
    let stdout_thread = thread::spawn(move || drain_pipe(stdout_pipe));
    let stderr_thread = thread::spawn(move || drain_pipe(stderr_pipe));

    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                eprintln!(
                    "[git] !!! timeout cmd={} after {}s",
                    fmt_cmd(args),
                    timeout_secs
                );
                return Err(format!(
                    "git timed out after {}s: {}",
                    timeout_secs,
                    fmt_cmd(args)
                ));
            }
            Ok(None) => thread::sleep(Duration::from_millis(GIT_POLL_MS)),
            Err(e) => return Err(format!("Failed to run git: {}", e)),
        }
    };

    let stdout = stdout_thread.join().unwrap_or_default();
    let stderr = stderr_thread.join().unwrap_or_default();
    let stdout = stdout.trim().to_string();
    let stderr = stderr.trim().to_string();

    if status.success() {
        log_git_success(args, &stdout, &stderr);
        Ok(stdout)
    } else {
        log_git_failure(args, status.code(), &stdout, &stderr);
        // Some git failures (e.g. "nothing to commit") print to stdout
        // with empty stderr. Fall back to stdout so the surfaced error
        // is never blank.
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        Err(detail)
    }
}

/// Drain a child process pipe to EOF, tolerating invalid UTF-8.
fn drain_pipe(pipe: Option<impl Read>) -> String {
    let mut bytes = Vec::new();
    if let Some(mut pipe) = pipe {
        let _ = pipe.read_to_end(&mut bytes);
    }
    String::from_utf8_lossy(&bytes).into_owned()
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
    git_status_impl(&data_dir)
}

/// Fetch from origin (best-effort) and then report git status.
///
/// The plain git_status reads ahead/behind from the locally cached
/// origin/<branch> refs, which stay stale until something fetches — an auto
/// backup that only ever inspected it could never notice remote-only changes
/// (behind would read 0 forever). The fetch here is best-effort: offline or
/// auth failures leave the cached refs untouched, and the status below still
/// reflects them, so a known-behind repo still qualifies for a sync.
#[tauri::command]
pub async fn git_fetch_status(data_dir: String) -> Result<GitStatus, String> {
    let _ = run_git_network(&data_dir, &["fetch", "origin"]);
    git_status_impl(&data_dir)
}

fn git_status_impl(data_dir: &str) -> Result<GitStatus, String> {
    // Check if inside a git repo
    let is_repo = run_git(data_dir, &["rev-parse", "--is-inside-work-tree"])
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
    let branch = run_git(data_dir, &["branch", "--show-current"]).ok();

    // Get remote URL
    let remote = run_git(data_dir, &["remote", "get-url", "origin"]).ok();
    let remote_protocol = remote.as_ref().map(|url| detect_protocol(url));

    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(data_dir);

    // Check for uncommitted changes
    let has_changes = run_git(data_dir, &["status", "--porcelain"])
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

/// Sync git repository: commit local changes -> pull (auto-merge JSON) -> push.
/// Uses the provided message template with {datetime}, {date}, {time} placeholders.
///
/// Local changes are committed BEFORE pulling. Git refuses to start a merge
/// when the working tree has uncommitted edits to files the merge needs to
/// update ("Your local changes ... would be overwritten by merge"), and since
/// the reader auto-saves progress while reading, the worktree is dirty at
/// sync time in practice. With the old pull-first order that failure also
/// prevented the commit from ever happening, so every subsequent sync failed
/// the same way. A second commit pass after the pull captures anything the
/// app wrote while the merge was running.
#[tauri::command]
pub async fn git_sync(
    data_dir: String,
    message_template: Option<String>,
) -> Result<SyncResult, String> {
    let template = message_template.unwrap_or_else(|| "Sync at {datetime}".to_string());
    run_sync(&data_dir, &template)
}

fn run_sync(data_dir: &str, template: &str) -> Result<SyncResult, String> {
    let message = render_message(template);
    eprintln!("[sync] === start === dir={}", data_dir);

    // Step 1: Commit local changes so the merge below sees a clean worktree.
    commit_local_changes(data_dir, &message, "1/4")?;

    // Step 2: Pull with auto-merge for JSON files
    let head_before_pull = run_git(data_dir, &["rev-parse", "HEAD"]).ok();
    eprintln!("[sync] step 2/4: pull");
    match git_pull(data_dir) {
        Ok(_) => {
            eprintln!("[sync] step 2/4: pull OK");
        }
        Err(conflicts) => {
            eprintln!(
                "[sync] step 2/4: pull FAILED with {} conflict(s): {:?}",
                conflicts.len(),
                conflicts
            );
            return Ok(SyncResult {
                success: false,
                message: "Pull failed".to_string(),
                conflicts,
                pulled: false,
            });
        }
    }

    // Whether the pull actually brought remote commits down (vs. already
    // being up to date). HEAD can only move here because of the merge above
    // — the second commit pass happens after this snapshot, so it never
    // pollutes the signal.
    let head_after_pull = run_git(data_dir, &["rev-parse", "HEAD"]).ok();
    let pulled = head_before_pull.is_some() && head_before_pull != head_after_pull;

    // Step 3: Capture anything written while the merge was running.
    commit_local_changes(data_dir, &message, "3/4")?;

    // Step 4: Push. Another device can land a commit in the window between
    // our fetch and push, rejecting the push as non-fast-forward. Integrate
    // whatever landed and retry once instead of failing the whole tick.
    eprintln!("[sync] step 4/4: push");
    if let Err(push_err) = run_git_network(data_dir, &["push"]) {
        eprintln!(
            "[sync] step 4/4: push FAILED ({}), retrying after re-integrate",
            truncate_for_log(&push_err, 200)
        );
        if let Err(retry_conflicts) = git_pull(data_dir) {
            eprintln!(
                "[sync] step 4/4: retry pull FAILED: {:?}",
                retry_conflicts
            );
            return Err(format!(
                "Failed to push: {} (retry pull failed: {})",
                push_err,
                retry_conflicts.join("; ")
            ));
        }
        commit_local_changes(data_dir, &message, "4/4 (retry)")?;
        eprintln!("[sync] step 4/4: push retry");
        run_git_network(data_dir, &["push"]).map_err(|e| {
            eprintln!("[sync] step 4/4: push retry FAILED: {}", e);
            format!("Failed to push after retry: {}", e)
        })?;
    }

    eprintln!("[sync] === done ===");
    Ok(SyncResult {
        success: true,
        message: format!("Synced successfully: {}", message),
        conflicts: vec![],
        pulled,
    })
}

/// Stage and commit all current changes. Skips the commit when there is
/// nothing staged. Relying on the working tree state is more reliable than
/// parsing git's stdout/stderr text, which differs across git versions and
/// locales.
fn commit_local_changes(data_dir: &str, message: &str, step: &str) -> Result<(), String> {
    eprintln!("[sync] step {}: add .", step);
    run_git(data_dir, &["add", "."]).map_err(|e| {
        eprintln!("[sync] step {}: add FAILED: {}", step, e);
        format!("Failed to add files: {}", e)
    })?;

    let has_staged = run_git(data_dir, &["diff", "--cached", "--quiet"])
        .is_err(); // exit 1 = staged changes present
    eprintln!("[sync] step {}: staged changes present={}", step, has_staged);

    if !has_staged {
        eprintln!("[sync] step {}: nothing to commit, skipping", step);
        return Ok(());
    }

    match run_git(data_dir, &["commit", "-m", message]) {
        Ok(out) => {
            eprintln!(
                "[sync] step {}: commit OK: {}",
                step,
                truncate_for_log(&out, 200)
            );
            Ok(())
        }
        Err(e) => {
            eprintln!("[sync] step {}: commit FAILED: {}", step, e);
            Err(format!("Failed to commit: {}", e))
        }
    }
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
    run_git_network(data_dir, &["fetch", "origin"])
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
///
/// Output preserves the "ours" ordering; ids only known to "theirs" are
/// appended in their own order. A HashMap would randomize item order, making
/// every conflict resolution commit a spurious full-array reorder — noise in
/// git history and a fresh conflict for the next tick.
fn merge_array_by_id(ours: Value, theirs: Value, timestamp_field: &str) -> Result<Value, String> {
    let our_arr = ours.as_array().ok_or("Expected array")?;
    let their_arr = theirs.as_array().ok_or("Expected array")?;

    let mut merged: Vec<(String, Value)> = our_arr
        .iter()
        .filter_map(|item| {
            item.get("id")
                .and_then(|v| v.as_str())
                .map(|id| (id.to_string(), item.clone()))
        })
        .collect();

    for item in their_arr {
        let Some(id) = item.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        let new_time = item
            .get(timestamp_field)
            .and_then(|v| v.as_str())
            .unwrap_or("");
        match merged.iter().position(|(existing_id, _)| existing_id == id) {
            Some(index) => {
                let existing_time = merged[index]
                    .1
                    .get(timestamp_field)
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if new_time > existing_time {
                    merged[index].1 = item.clone();
                }
            }
            None => merged.push((id.to_string(), item.clone())),
        }
    }

    Ok(Value::Array(
        merged.into_iter().map(|(_, item)| item).collect(),
    ))
}

/// Merge bookshelf.json: merge entries by id.
///
/// Same ordering rationale as merge_array_by_id — deterministic output.
fn merge_bookshelf(ours: Value, theirs: Value) -> Result<Value, String> {
    let our_entries = ours
        .get("entries")
        .and_then(|v| v.as_array())
        .ok_or("Expected entries array")?;
    let their_entries = theirs
        .get("entries")
        .and_then(|v| v.as_array())
        .ok_or("Expected entries array")?;

    let mut merged: Vec<(String, Value)> = our_entries
        .iter()
        .filter_map(|entry| {
            entry
                .get("id")
                .and_then(|v| v.as_str())
                .map(|id| (id.to_string(), entry.clone()))
        })
        .collect();

    // Add/replace with their entries (keep newer lastOpened)
    for entry in their_entries {
        let Some(id) = entry.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        let new_time = entry
            .get("lastOpened")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        match merged.iter().position(|(existing_id, _)| existing_id == id) {
            Some(index) => {
                let existing_time = merged[index]
                    .1
                    .get("lastOpened")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                if new_time > existing_time {
                    merged[index].1 = entry.clone();
                }
            }
            None => merged.push((id.to_string(), entry.clone())),
        }
    }

    // Convert back to array and wrap in object
    let entries: Vec<Value> = merged.into_iter().map(|(_, entry)| entry).collect();
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "anno-reader-git-test-{}-{}",
            name,
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn configure_identity(dir: &Path) {
        let dir = dir.to_str().unwrap();
        run_git(dir, &["config", "user.name", "Test"]).unwrap();
        run_git(dir, &["config", "user.email", "test@example.com"]).unwrap();
    }

    /// Set up a bare remote + a working clone with one committed progress file.
    /// Returns (base, work clone path).
    fn fixture(name: &str) -> (PathBuf, PathBuf) {
        let base = temp_dir(name);
        let remote = base.join("remote.git");
        let work = base.join("work");

        run_git(
            base.to_str().unwrap(),
            &["init", "--bare", "-b", "master", remote.to_str().unwrap()],
        )
        .unwrap();
        run_git(
            base.to_str().unwrap(),
            &["clone", remote.to_str().unwrap(), work.to_str().unwrap()],
        )
        .unwrap();
        configure_identity(&work);

        let progress = work.join("entries").join("book1").join("progress.json");
        fs::create_dir_all(progress.parent().unwrap()).unwrap();
        fs::write(&progress, r#"{ "lastUpdated": "2026-01-01T00:00:00Z" }"#).unwrap();
        run_git(work.to_str().unwrap(), &["add", "."]).unwrap();
        run_git(work.to_str().unwrap(), &["commit", "-m", "init"]).unwrap();
        run_git(work.to_str().unwrap(), &["push", "-u", "origin", "master"]).unwrap();

        (base, work)
    }

    /// Regression test for the pull-first sync order: with uncommitted local
    /// edits to progress.json AND a remote commit touching the same file, the
    /// merge used to be refused ("Your local changes ... would be overwritten
    /// by merge") before the local commit could happen, deadlocking sync.
    #[test]
    fn sync_commits_local_changes_before_merge() {
        let (base, work) = fixture("sync-dirty");
        let work_str = work.to_str().unwrap();
        let progress = work.join("entries").join("book1").join("progress.json");

        // Simulate another device landing a newer progress file on the remote.
        fs::write(&progress, r#"{ "lastUpdated": "2026-01-02T00:00:00Z" }"#).unwrap();
        run_git(work_str, &["commit", "-am", "remote-device"]).unwrap();
        run_git(work_str, &["push"]).unwrap();

        // Roll the local branch back behind the remote, then dirty the same
        // file — the state the reader is in when sync is pressed mid-read.
        run_git(work_str, &["reset", "--hard", "HEAD~1"]).unwrap();
        fs::write(&progress, r#"{ "lastUpdated": "2026-01-01T12:00:00Z" }"#).unwrap();

        let result = run_sync(work_str, "test {datetime}").unwrap();
        assert!(result.success, "sync should succeed: {}", result.message);

        // The remote version is newer, so the auto-merge must have kept it.
        let merged = fs::read_to_string(&progress).unwrap();
        assert!(
            merged.contains("2026-01-02T00:00:00Z"),
            "merged file should keep the newer remote progress: {}",
            merged
        );

        // Everything committed and pushed.
        let status = run_git(work_str, &["status", "--porcelain"]).unwrap();
        assert!(status.is_empty(), "worktree should be clean: {}", status);
        let unpushed = run_git(work_str, &["rev-list", "--count", "origin/master..master"]).unwrap();
        assert_eq!(unpushed, "0");

        let _ = fs::remove_dir_all(&base);
    }

    /// Plain path: dirty worktree with no upstream activity must still
    /// commit and push cleanly.
    #[test]
    fn sync_pushes_local_changes_without_upstream_activity() {
        let (base, work) = fixture("sync-clean");
        let work_str = work.to_str().unwrap();
        let progress = work.join("entries").join("book1").join("progress.json");

        fs::write(&progress, r#"{ "lastUpdated": "2026-01-03T00:00:00Z" }"#).unwrap();

        let result = run_sync(work_str, "test {datetime}").unwrap();
        assert!(result.success, "sync should succeed: {}", result.message);

        let status = run_git(work_str, &["status", "--porcelain"]).unwrap();
        assert!(status.is_empty(), "worktree should be clean: {}", status);
        let unpushed = run_git(work_str, &["rev-list", "--count", "origin/master..master"]).unwrap();
        assert_eq!(unpushed, "0");

        let _ = fs::remove_dir_all(&base);
    }

    /// A remote-only commit (another device pushed) must be pulled down by
    /// sync, and SyncResult.pulled must be true exactly when that happened —
    /// the frontend uses it to reload data the pull rewrote on disk.
    #[test]
    fn sync_reports_pulled_when_remote_has_new_commits() {
        let (base, work) = fixture("sync-pulled");
        let base_str = base.to_str().unwrap();
        let work_str = work.to_str().unwrap();

        // Another device clones, writes newer progress, pushes.
        let other = base.join("other");
        run_git(
            base_str,
            &[
                "clone",
                base.join("remote.git").to_str().unwrap(),
                other.to_str().unwrap(),
            ],
        )
        .unwrap();
        configure_identity(&other);
        let other_progress = other.join("entries").join("book1").join("progress.json");
        fs::write(&other_progress, r#"{ "lastUpdated": "2026-01-05T00:00:00Z" }"#).unwrap();
        run_git(other.to_str().unwrap(), &["commit", "-am", "other device"]).unwrap();
        run_git(other.to_str().unwrap(), &["push"]).unwrap();

        // Our side is clean and (as far as cached refs know) in sync — the
        // sync must still pull the remote commit and report pulled=true.
        let result = run_sync(work_str, "test {datetime}").unwrap();
        assert!(result.success, "sync should succeed: {}", result.message);
        assert!(
            result.pulled,
            "first sync after a remote push should report pulled"
        );
        let progress = work.join("entries").join("book1").join("progress.json");
        let merged = fs::read_to_string(&progress).unwrap();
        assert!(
            merged.contains("2026-01-05T00:00:00Z"),
            "remote progress should have been pulled: {}",
            merged
        );

        // The immediately following sync is up to date — pulled must be false.
        let result2 = run_sync(work_str, "test {datetime}").unwrap();
        assert!(result2.success, "second sync should succeed: {}", result2.message);
        assert!(!result2.pulled, "up-to-date sync must not claim a pull");

        let _ = fs::remove_dir_all(&base);
    }

    /// Merged arrays must keep the "ours" order (with theirs-only ids
    /// appended) — a HashMap-backed merge randomized item order, making every
    /// conflict resolution commit a spurious full-array reorder.
    #[test]
    fn merge_array_by_id_preserves_ours_order() {
        let ours = serde_json::json!([
            { "id": "a", "updatedAt": "2026-01-01T00:00:00Z" },
            { "id": "b", "updatedAt": "2026-01-02T00:00:00Z" },
            { "id": "c", "updatedAt": "2026-01-03T00:00:00Z" }
        ]);
        let theirs = serde_json::json!([
            { "id": "d", "updatedAt": "2026-01-04T00:00:00Z" },
            { "id": "b", "updatedAt": "2026-01-05T00:00:00Z" }
        ]);

        let merged = merge_array_by_id(ours, theirs, "updatedAt").unwrap();
        let items = merged.as_array().unwrap();
        let ids: Vec<&str> = items
            .iter()
            .map(|item| item.get("id").and_then(|v| v.as_str()).unwrap())
            .collect();
        assert_eq!(ids, vec!["a", "b", "c", "d"]);
        // "b" replaced in place with the newer theirs version.
        assert_eq!(
            items[1].get("updatedAt").and_then(|v| v.as_str()),
            Some("2026-01-05T00:00:00Z")
        );
    }

    /// Bookshelf merge follows the same deterministic-ordering rule.
    #[test]
    fn merge_bookshelf_preserves_ours_order() {
        let ours = serde_json::json!({
            "entries": [
                { "id": "x", "lastOpened": 100.0 },
                { "id": "y", "lastOpened": 200.0 }
            ]
        });
        let theirs = serde_json::json!({
            "entries": [
                { "id": "z", "lastOpened": 50.0 },
                { "id": "x", "lastOpened": 300.0 }
            ]
        });

        let merged = merge_bookshelf(ours, theirs).unwrap();
        let entries = merged.get("entries").unwrap().as_array().unwrap();
        let ids: Vec<&str> = entries
            .iter()
            .map(|entry| entry.get("id").and_then(|v| v.as_str()).unwrap())
            .collect();
        assert_eq!(ids, vec!["x", "y", "z"]);
        // "x" replaced in place with the newer lastOpened.
        assert_eq!(entries[0].get("lastOpened").and_then(|v| v.as_f64()), Some(300.0));
    }
}
