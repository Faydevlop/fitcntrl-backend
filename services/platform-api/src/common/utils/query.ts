export const parsePagination = (
  query: Record<string, unknown>,
): { page: number; limit: number; skip: number } => {
  const pageValue = Number(query.page || 1);
  const limitValue = Number(query.limit || 20);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(Math.floor(limitValue), 100) : 20;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const monthKeyFromDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};
