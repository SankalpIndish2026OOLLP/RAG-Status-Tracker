/**
 * Week utility helpers
 * Uses ISO 8601 week numbering (weeks start Monday)
 */

/**
 * Returns "YYYY-WW" string for a given date
 * e.g. new Date('2026-02-09') → "2026-07"
 */
function getWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO week: Thursday of the week determines the year
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d - startOfYear) / 86400000) + 1) / 7);
  return `${year}-${String(week).padStart(2, '0')}`;
}

/**
 * Returns the Monday (start) of the ISO week containing `date`
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the cutoff date for data retention (DATA_RETENTION_MONTHS ago from today)
 */
function getRetentionCutoff() {
  const months = parseInt(process.env.DATA_RETENTION_MONTHS || '6');
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

/**
 * Returns an array of { weekKey, weekStartDate, label } objects
 * for the last N months, most-recent first — used to populate history selectors
 */
function getWeekRange(months = 6) {
  const weeks = [];
  const cutoff = getRetentionCutoff();
  const cursor = getWeekStart(new Date());

  while (cursor >= cutoff) {
    const key = getWeekKey(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    weeks.push({
      weekKey: key,
      weekStartDate: new Date(cursor),
      label: `${cursor.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    });
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}

module.exports = { getWeekKey, getWeekStart, getRetentionCutoff, getWeekRange };
