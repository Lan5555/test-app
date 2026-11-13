export interface StudentRecord {
  id: number;
  name: string;
  email: string;
  score: number;
  codeInfo?: { attempts?: number; code?: string };
}

export function filterStudentRecords<T extends StudentRecord>(
  records: T[],
  query: string,
  range: string,
  sort: string,
  order: "asc" | "desc",
): T[] {
  const search = query.trim().toLowerCase();
  const [min, max] = range.split("-").map(Number);
  return records
    .filter((record) => {
      if (
        search &&
        ![record.name, record.email].some((value) =>
          value?.toLowerCase().includes(search),
        )
      )
        return false;
      if (range === "0") return record.score === 0;
      if (
        range !== "all" &&
        (!Number.isFinite(record.score) ||
          record.score < min ||
          (max === 100 ? record.score > 100 : record.score >= max + 1))
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      const result =
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "id"
            ? a.id - b.id
            : a.score - b.score;
      return order === "asc" ? result : -result;
    });
}

export function toggleFilteredSelection(
  selected: Set<number>,
  ids: number[],
): Set<number> {
  const next = new Set(selected);
  const all = ids.length > 0 && ids.every((id) => next.has(id));
  for (const id of ids) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
}

export function recordPage(count: number, requested: number, size: number) {
  const pages = Math.max(1, Math.ceil(count / size));
  const page = Math.max(0, Math.min(requested, pages - 1));
  return {
    page,
    pages,
    start: count ? page * size + 1 : 0,
    end: Math.min((page + 1) * size, count),
    offset: page * size,
  };
}
