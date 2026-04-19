// Google-style paginator with the Coog Zoo logo in place of the "G" —
// so "Coog Zoo" stretches out like "Goooooogle" with each extra logo
// representing an additional page. Page numbers below, with ellipsis
// when the total page count is too large to render every number.
//
// Used by any list view that pages server-side (activity log, purchases,
// donations, tickets). Caller owns the `page` state and the fetching
// logic — this component is presentational.
//
// Props:
//   page       — zero-based current page
//   totalPages — total page count (>= 1). Hidden when <= 1.
//   onChange   — (nextPage) => void
//
// Layout: three row-sections stacked.
//   [logo-row]    COOG ooo ZOO    ← one extra "O" cluster per visible page-slot
//   [numbers]     Previous  1 2 … 5 6 [7] 8 9 … 42  Next
//
// The logo row scales up to a cap so long page counts don't overflow
// the container; the number row uses an ellipsis window around the
// current page.
import React from 'react';

const GREEN      = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';
const MUTED      = 'rgba(102, 122, 66, 0.45)';

// Build the number sequence: always show first + last, the current page
// and its immediate neighbours, and ellipsis elsewhere.
// Matches Google: 1, 2, 3, …, 7, 8, 9, …, 20, 21
function buildPageList(page, totalPages) {
    if (totalPages <= 7) {
        // Small: render every page.
        return Array.from({ length: totalPages }, (_, i) => i);
    }
    const out = [0];
    const windowStart = Math.max(1, page - 2);
    const windowEnd   = Math.min(totalPages - 2, page + 2);
    if (windowStart > 1) out.push('…');
    for (let i = windowStart; i <= windowEnd; i++) out.push(i);
    if (windowEnd < totalPages - 2) out.push('…');
    out.push(totalPages - 1);
    // Dedupe in case the window touches the ends (e.g. page=0 on a 10-page set).
    return out.filter((v, i, a) => a.indexOf(v) === i);
}

// Google caps the "Goooogle" strip at 10 "o"s and slides the highlighted
// one across as you navigate. We mirror that: always show `min(10, pages)`
// slots, and when there are more than 10 pages the active-slot position
// is proportional to current-page / last-page so it glides from left to
// right across the strip as the user pages deeper.
const MAX_SLOTS = 10;
function slotCount(totalPages) {
    return Math.min(MAX_SLOTS, Math.max(2, totalPages));
}
function activeSlot(page, totalPages) {
    const slots = slotCount(totalPages);
    if (totalPages <= slots) return page;
    // Map 0..(totalPages-1) → 0..(slots-1)
    return Math.round((page / (totalPages - 1)) * (slots - 1));
}

export default function ZooPaginator({ page, totalPages, onChange }) {
    if (totalPages == null || totalPages <= 1) return null;

    const pages = buildPageList(page, totalPages);
    const slots = slotCount(totalPages);
    const active = activeSlot(page, totalPages);
    const atStart = page <= 0;
    const atEnd   = page >= totalPages - 1;

    const handle = (p) => {
        if (typeof p !== 'number') return;
        if (p < 0 || p > totalPages - 1) return;
        onChange(p);
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '6px', marginTop: '24px', padding: '16px 10px',
            userSelect: 'none',
        }}>
            {/* Stretched logo row: one COOG ZOO on the left, a string of "O"s,
                then another COOG ZOO on the right. The middle "O" that's
                lit up is the current page. */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '4px', flexWrap: 'nowrap',
                maxWidth: '100%', overflow: 'hidden',
            }}>
                <BrandWord />
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {Array.from({ length: slots }).map((_, i) => {
                        const isActive = i === active;
                        return (
                            <span key={i} style={{
                                display: 'inline-block',
                                width:  isActive ? '22px' : '18px',
                                height: isActive ? '22px' : '18px',
                                borderRadius: '50%',
                                background: isActive ? GREEN : 'transparent',
                                border: isActive ? 'none' : `2px solid ${GREEN_DARK}`,
                                transition: 'all 150ms',
                            }} />
                        );
                    })}
                </div>
                <BrandWord trailing />
            </div>

            {/* Number row + Prev/Next links. */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '14px', flexWrap: 'wrap', marginTop: '4px',
            }}>
                <LinkButton disabled={atStart} onClick={() => handle(page - 1)}>
                    ‹ Previous
                </LinkButton>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {pages.map((p, i) => {
                        if (p === '…') {
                            return <span key={`e${i}`} style={{ color: MUTED, fontWeight: 600 }}>…</span>;
                        }
                        const active = p === page;
                        return (
                            <button
                                key={p}
                                onClick={() => handle(p)}
                                disabled={active}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '2px 4px',
                                    fontSize: '15px',
                                    fontWeight: active ? 700 : 500,
                                    color: active ? GREEN_DARK : GREEN,
                                    textDecoration: active ? 'none' : 'underline',
                                    textDecorationColor: active ? 'transparent' : 'rgba(123,144,79,0.45)',
                                    textUnderlineOffset: '3px',
                                    cursor: active ? 'default' : 'pointer',
                                }}>
                                {p + 1}
                            </button>
                        );
                    })}
                </div>
                <LinkButton disabled={atEnd} onClick={() => handle(page + 1)}>
                    Next ›
                </LinkButton>
            </div>
        </div>
    );
}

function BrandWord({ trailing = false }) {
    // "COOG" on the left, "ZOO" on the right — so the O-row sits between
    // them the way Google's own Goooogle has the two "oo"s bookending.
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            color: GREEN_DARK, fontWeight: 800,
            fontSize: '22px', letterSpacing: '0.02em',
        }}>
            {trailing ? 'ZOO' : 'COOG'}
        </span>
    );
}

function LinkButton({ children, disabled, onClick }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 6px',
                color: disabled ? MUTED : GREEN,
                fontWeight: 600,
                fontSize: '14px',
                cursor: disabled ? 'default' : 'pointer',
                textDecoration: disabled ? 'none' : 'underline',
                textDecorationColor: disabled ? 'transparent' : 'rgba(123,144,79,0.45)',
                textUnderlineOffset: '3px',
            }}>
            {children}
        </button>
    );
}
