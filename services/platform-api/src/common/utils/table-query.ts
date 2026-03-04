export type TableSearchItem = {
  term?: string;
  fields?: string[];
  startsWith?: boolean;
  endsWith?: boolean;
};

export type TableQueryInput = {
  projection?: Record<string, 0 | 1>;
  filters?: Record<string, unknown>;
  search?: TableSearchItem[];
  options?: {
    page?: number;
    itemsPerPage?: number;
    sortBy?: string[];
    sortDesc?: boolean[];
  };
};

export type NormalizedTableQuery = {
  projection?: Record<string, 0 | 1>;
  filters: Record<string, unknown>;
  search: TableSearchItem[];
  page: number;
  itemsPerPage: number;
  skip: number;
  sortBy: string[];
  sortDesc: boolean[];
  sort: Record<string, 1 | -1>;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
};

const toBooleanArray = (value: unknown): boolean[] => {
  if (Array.isArray(value)) {
    return value.map(item => String(item).toLowerCase() === "true");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map(item => item.trim().toLowerCase() === "true");
  }
  return [];
};

const toPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const normalizeSearch = (
  searchRaw: unknown,
  fallbackFields: string[],
): TableSearchItem[] => {
  if (Array.isArray(searchRaw)) {
    return searchRaw
      .map(item => item as TableSearchItem)
      .filter(item => typeof item.term === "string" && item.term.trim().length > 0)
      .map(item => ({
        term: item.term?.trim(),
        fields: (item.fields && item.fields.length > 0 ? item.fields : fallbackFields).map(field =>
          String(field).trim(),
        ),
        startsWith: Boolean(item.startsWith),
        endsWith: Boolean(item.endsWith),
      }));
  }

  if (typeof searchRaw === "string" && searchRaw.trim().length > 0) {
    return [
      {
        term: searchRaw.trim(),
        fields: fallbackFields,
        startsWith: false,
        endsWith: false,
      },
    ];
  }

  return [];
};

export const normalizeTableQuery = (
  rawInput: unknown,
  config?: {
    fallbackSortBy?: string[];
    fallbackSortDesc?: boolean[];
    fallbackItemsPerPage?: number;
    fallbackSearchFields?: string[];
  },
): NormalizedTableQuery => {
  const input = (rawInput || {}) as Record<string, unknown>;
  const options = (input.options || {}) as Record<string, unknown>;

  const fallbackSortBy = config?.fallbackSortBy || ["createdAt"];
  const fallbackSortDesc = config?.fallbackSortDesc || [true];
  const fallbackItemsPerPage = Math.min(Math.max(config?.fallbackItemsPerPage || 20, 1), 100);
  const fallbackSearchFields = config?.fallbackSearchFields || [];

  const page = toPositiveInt(options.page ?? input.page, 1);
  const itemsPerPage = Math.min(
    toPositiveInt(options.itemsPerPage ?? input.itemsPerPage ?? input.limit, fallbackItemsPerPage),
    100,
  );
  const skip = (page - 1) * itemsPerPage;

  const sortBy = toStringArray(options.sortBy ?? input.sortBy);
  const sortDesc = toBooleanArray(options.sortDesc ?? input.sortDesc);
  const normalizedSortBy = sortBy.length > 0 ? sortBy : fallbackSortBy;
  const normalizedSortDesc =
    sortDesc.length > 0 ? sortDesc : fallbackSortDesc.length > 0 ? fallbackSortDesc : [true];

  const sort: Record<string, 1 | -1> = {};
  normalizedSortBy.forEach((field, index) => {
    sort[field] = normalizedSortDesc[index] ? -1 : 1;
  });

  const projectionCandidate = input.projection;
  const projection =
    projectionCandidate && typeof projectionCandidate === "object" && !Array.isArray(projectionCandidate)
      ? (projectionCandidate as Record<string, 0 | 1>)
      : undefined;

  const filtersCandidate = input.filters || input.filter || {};
  const reservedKeys = new Set([
    "projection",
    "filters",
    "filter",
    "search",
    "options",
    "page",
    "itemsPerPage",
    "limit",
    "sortBy",
    "sortDesc",
  ]);
  const topLevelFilters = Object.entries(input).reduce((acc, [key, value]) => {
    if (!reservedKeys.has(key) && value !== undefined && value !== null && value !== "") {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, unknown>);
  const filters =
    filtersCandidate && typeof filtersCandidate === "object" && !Array.isArray(filtersCandidate)
      ? { ...topLevelFilters, ...(filtersCandidate as Record<string, unknown>) }
      : topLevelFilters;

  const search = normalizeSearch(input.search, fallbackSearchFields);

  return {
    projection,
    filters,
    search,
    page,
    itemsPerPage,
    skip,
    sortBy: normalizedSortBy,
    sortDesc: normalizedSortDesc,
    sort,
  };
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildTableSearchMatch = (searchItems: TableSearchItem[]): Record<string, unknown> => {
  if (!searchItems || searchItems.length === 0) {
    return {};
  }

  const andConditions: Array<Record<string, unknown>> = [];

  searchItems.forEach(item => {
    const term = (item.term || "").trim();
    const fields = (item.fields || []).filter(Boolean);
    if (!term || fields.length === 0) {
      return;
    }

    const escapedTerm = escapeRegex(term);
    const pattern = item.startsWith && item.endsWith
      ? `^${escapedTerm}$`
      : item.startsWith
        ? `^${escapedTerm}`
        : item.endsWith
          ? `${escapedTerm}$`
          : escapedTerm;
    const regex = new RegExp(pattern, "i");

    andConditions.push({
      $or: fields.map(field => ({
        [field]: { $regex: regex },
      })),
    });
  });

  if (andConditions.length === 0) {
    return {};
  }

  return { $and: andConditions };
};
