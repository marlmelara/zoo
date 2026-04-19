// mysql2 returns DATETIMEs as naive strings ("YYYY-MM-DD HH:MM:SS") due to
// `dateStrings: true` in db.js. We store UTC (timezone: '+00:00'), but the
// browser's `new Date(str)` parses the naive form as *local*, shifting
// timestamps by the UTC offset. Re-emit as ISO with Z so clients always see
// the true UTC instant and can localize themselves.
export function toIsoUtc(v) {
    if (!v) return v;
    if (v instanceof Date) return v.toISOString();
    const s = String(v);
    if (s.includes('T') && (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s))) return s;
    return s.replace(' ', 'T') + 'Z';
}

// Normalize a list of rows by rewriting the given datetime fields in place.
// Returns a new array of shallow-copied objects so the originals aren't mutated.
export function normalizeRowDates(rows, fields) {
    return rows.map(r => {
        const out = { ...r };
        for (const f of fields) {
            if (out[f] != null) out[f] = toIsoUtc(out[f]);
        }
        return out;
    });
}
