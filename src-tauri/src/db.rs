use rusqlite::Connection;
use serde::Deserialize;
use std::sync::Mutex;
use tauri::State;

pub struct Db(pub Mutex<Connection>);

/// Initialize the database: enable WAL mode, set busy timeout, create FTS5 table.
pub fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA busy_timeout=5000;")?;
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
            book_id,
            chapter_id,
            chapter_title,
            chunk_text,
            tokenize='trigram'
        );",
    )?;
    Ok(())
}

/// A single chunk to index.
#[derive(Deserialize)]
pub struct ChunkInput {
    pub book_id: String,
    pub chapter_id: String,
    pub chapter_title: String,
    pub chunk_text: String,
}

/// Index a batch of chunks for a book. Deletes existing rows for the book first.
#[tauri::command]
pub fn index_book(db: State<'_, Db>, book_id: String, chunks: Vec<ChunkInput>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Clear existing chunks for this book
    conn.execute("DELETE FROM chunks WHERE book_id = ?1", [&book_id])
        .map_err(|e| e.to_string())?;

    // Insert new chunks
    let mut stmt = conn
        .prepare("INSERT INTO chunks (book_id, chapter_id, chapter_title, chunk_text) VALUES (?1, ?2, ?3, ?4)")
        .map_err(|e| e.to_string())?;

    for chunk in &chunks {
        stmt.execute(rusqlite::params![
            chunk.book_id,
            chunk.chapter_id,
            chunk.chapter_title,
            chunk.chunk_text,
        ])
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// A single search result row.
#[derive(serde::Serialize)]
pub struct SearchResult {
    pub book_id: String,
    pub chapter_id: String,
    pub chapter_title: String,
    pub chunk_text: String,
}

/// Search indexed chunks. Query is sanitized: wrapped in double quotes with internal `"` doubled.
#[tauri::command]
pub fn search_book(
    db: State<'_, Db>,
    book_id: String,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Sanitize: double internal quotes, then wrap in quotes for FTS5 exact match
    let sanitized = format!("\"{}\"", query.replace('"', "\"\""));

    let mut stmt = conn
        .prepare(
            "SELECT book_id, chapter_id, chapter_title, chunk_text
             FROM chunks
             WHERE book_id = ?1 AND chunks MATCH ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![book_id, sanitized], |row| {
            Ok(SearchResult {
                book_id: row.get(0)?,
                chapter_id: row.get(1)?,
                chapter_title: row.get(2)?,
                chunk_text: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }

    Ok(results)
}

/// Delete all indexed chunks for a book.
#[tauri::command]
pub fn delete_book_index(db: State<'_, Db>, book_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM chunks WHERE book_id = ?1", [&book_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Check whether a book has any indexed chunks.
#[tauri::command]
pub fn book_index_exists(db: State<'_, Db>, book_id: String) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM chunks WHERE book_id = ?1",
            [&book_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}
