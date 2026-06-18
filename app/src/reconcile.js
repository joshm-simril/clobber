// Reconciliation — maps tag assignments against current Spydus loans.

const DUE_SOON_DAYS = 3;

/**
 * Reconcile tag assignments against current loan data.
 *
 * @param {Map<string, string>} assignments  tagId → isbn
 * @param {LoanRecord[]}        loans        from the Spydus proxy
 * @returns {ReconcileResult}
 *
 * @typedef {{ isbn: string, title: string, dueDate: string|null, borrower: string }} LoanRecord
 * @typedef {{
 *   tagged:   (LoanRecord & { tagId: string })[],
 *   untagged: LoanRecord[],
 *   stale:    { tagId: string, isbn: string }[],
 *   free:     { tagId: string }[],
 * }} ReconcileResult
 */
export function reconcile(assignments, loans) {
  const loanByIsbn   = new Map(loans.filter(l => l.isbn).map(l => [l.isbn, l]));
  const assignedIsbns = new Set(assignments.values());

  const tagged   = [];
  const stale    = [];
  const free     = [];

  for (const [tagId, isbn] of assignments) {
    if (!isbn) {
      free.push({ tagId });
    } else if (loanByIsbn.has(isbn)) {
      tagged.push({ tagId, ...loanByIsbn.get(isbn) });
    } else {
      stale.push({ tagId, isbn });
    }
  }

  const untagged = loans.filter(l => l.isbn && !assignedIsbns.has(l.isbn));

  return { tagged, untagged, stale, free };
}

/** Returns true if dueDate is within DUE_SOON_DAYS from now. */
export function isDueSoon(dueDate) {
  if (!dueDate) return false;
  const due  = new Date(dueDate);
  const diffMs = due - Date.now();
  return diffMs > 0 && diffMs < DUE_SOON_DAYS * 86_400_000;
}

/** Returns true if dueDate is in the past. */
export function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

/** Human-friendly relative due-date label. */
export function dueDateLabel(dueDate) {
  if (!dueDate) return '';
  const due  = new Date(dueDate);
  const days = Math.round((due - Date.now()) / 86_400_000);
  if (days < 0)  return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}
