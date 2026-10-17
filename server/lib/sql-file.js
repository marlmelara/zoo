// ============================================================
// Helpers for reading .sql files that were written to be fed to
// the `mysql` CLI — i.e. they may contain DELIMITER blocks and a
// `USE coog_zoo;` header. The mysql2 driver understands neither,
// so both have to be handled before the statements are shipped.
//
// Used by `server/run-migration.mjs` and by the test harness,
// which loads `schema.sql` + every migration into a throwaway
// database.
// ============================================================

// ── DELIMITER-aware statement splitter ──────────────────────
export function splitStatements(text) {
    const out = [];
    let delimiter = ';';
    let current = '';
    const lines = text.split('\n');
    for (let rawLine of lines) {
        const line = rawLine;
        const trimmed = line.trim();
        // Skip full-line comments (-- ...) / blank lines when splitting
        if (/^DELIMITER\s+\S+/i.test(trimmed)) {
            const flush = current.trim();
            if (flush) out.push(flush);
            current = '';
            delimiter = trimmed.replace(/^DELIMITER\s+/i, '').trim();
            continue;
        }
        current += line + '\n';
        // Check if the current buffer (minus trailing whitespace) ends with
        // the active delimiter.
        const end = current.trimEnd();
        if (end.endsWith(delimiter)) {
            const stmt = end.slice(0, -delimiter.length).trim();
            if (stmt) out.push(stmt);
            current = '';
        }
    }
    const leftover = current.trim();
    if (leftover) out.push(leftover);
    return out;
}

// ── Point a script at whichever database we actually connected to ──
// Most migrations (and schema.sql) hardcode `USE coog_zoo;`, and
// schema.sql also opens with `CREATE DATABASE IF NOT EXISTS coog_zoo`.
// Left alone, running any of them against a differently-named
// database would silently redirect every statement back into
// `coog_zoo` — which is how a test run ends up mutating the
// developer's real data. Rewrite `USE` to the connected database and
// drop `CREATE DATABASE` (the caller has already created it).
export function retargetDatabase(statements, dbName) {
    const kept = [];
    for (const stmt of statements) {
        // These files open with a banner comment, so the keyword isn't
        // necessarily the first thing in the buffer.
        const code = stripLeadingComments(stmt);
        if (/^CREATE\s+DATABASE\b/i.test(code)) continue;
        if (/^USE\s+`?[\w$]+`?$/i.test(code)) {
            kept.push(`USE \`${dbName}\``);
            continue;
        }
        kept.push(stmt);
    }
    return kept;
}

function stripLeadingComments(stmt) {
    let s = stmt.trimStart();
    // Peel off `-- ...` lines, `# ...` lines and /* ... */ blocks until
    // the first line of actual SQL.
    for (;;) {
        if (s.startsWith('--') || s.startsWith('#')) {
            const nl = s.indexOf('\n');
            if (nl === -1) return '';
            s = s.slice(nl + 1).trimStart();
            continue;
        }
        if (s.startsWith('/*')) {
            const close = s.indexOf('*/');
            if (close === -1) return '';
            s = s.slice(close + 2).trimStart();
            continue;
        }
        return s;
    }
}
