/**
 * Class names are strings ("1", "2", "10", "Nursery"), so the database orders
 * them as text and puts 10-B before 2-A. Sort them here instead: numeric names
 * by their number, everything else alphabetically, section as the tiebreaker.
 */
export function sortClassRecords<T extends { name: string; section: string }>(classes: T[]) {
  return [...classes].sort((a, b) => {
    const numA = parseInt(a.name, 10);
    const numB = parseInt(b.name, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name) || a.section.localeCompare(b.section);
  });
}
