// Shared helpers for staff display + creation. Used by the Admin Create
// User modal, the Staff page (Add + Edit), and the Manager dashboard's
// My Staff tab so the presentation and validation stay consistent.

// ────────────────────────────────────────────────────────────
// Shift timeframe formatting
// ────────────────────────────────────────────────────────────

// "08:00-16:00" → "8:00 AM – 4:00 PM". Tolerates legacy free-text
// values (e.g. "8-4") by falling back to the raw input.
export function formatShiftTimeframe(raw) {
    if (!raw) return '';
    const parts = String(raw).split('-');
    if (parts.length !== 2) return raw;
    const start = formatTime(parts[0]);
    const end   = formatTime(parts[1]);
    if (!start || !end) return raw;
    return `${start} – ${end}`;
}

// "08:00" → "8:00 AM". Accepts "8", "08", "8:30", "08:30".
export function formatTime(str) {
    if (!str) return '';
    const m = String(str).trim().match(/^(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return '';
    let hour = parseInt(m[1], 10);
    const min = m[2] ?? '00';
    if (Number.isNaN(hour) || hour < 0 || hour > 23) return '';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${min} ${ampm}`;
}

// ────────────────────────────────────────────────────────────
// Office location defaults
// ────────────────────────────────────────────────────────────
//
// Every role gets a canonical office so the Create-User / Add-Staff
// flows don't have to ask a human to type the right string. Managers
// live between their dept floor and the Head Office, so they get both.
// Other roles have a single location tied to their dept.
//
// Keyed by dept_name (matches the `departments.dept_name` column).

const EMPLOYEE_OFFICE_BY_DEPT = {
    'Veterinary Services': 'Veterinary Clinic',
    'Animal Care':         'Animal Care Center, Main Building',
    'Administration':      'Head Office',
    'Security':            'Security HQ, Gate House',
    'Retail & Operations': 'Retail Building, Main Office',
};

const MANAGER_OFFICE_BY_DEPT = {
    'Veterinary Services': 'Veterinary Clinic, Head Office',
    'Animal Care':         'Animal Care Center, Head Office',
    'Administration':      'Head Office',                   // admin dept manager already sits there
    'Security':            'Security HQ, Head Office',
    'Retail & Operations': 'Retail Building, Head Office',
};

// Pick the default office for a role/dept pair. Returns '' if unknown.
export function defaultOfficeFor(role, deptName) {
    if (!deptName) return '';
    if (role === 'manager') return MANAGER_OFFICE_BY_DEPT[deptName] || '';
    if (role === 'admin')   return 'Head Office';
    return EMPLOYEE_OFFICE_BY_DEPT[deptName] || '';
}
