export const adminPageSizes = [25, 50, 100] as const;

export interface AdminPaginationInput {
  page: number;
  pageSize: (typeof adminPageSizes)[number];
}

export interface AdminPaginatedResult<T> extends AdminPaginationInput {
  items: T[];
  total: number;
  pageCount: number;
}

export interface AdminListSearchParams {
  q?: string;
  status?: string;
  page?: string;
  pageSize?: string;
  record?: string;
}

export function normalizeAdminPagination(
  input: Pick<AdminListSearchParams, 'page' | 'pageSize'>,
  defaultPageSize: AdminPaginationInput['pageSize']
): AdminPaginationInput {
  const parsedPage = Number.parseInt(input.page ?? '', 10);
  const parsedSize = Number.parseInt(input.pageSize ?? '', 10);
  const pageSize = adminPageSizes.includes(parsedSize as AdminPaginationInput['pageSize'])
    ? (parsedSize as AdminPaginationInput['pageSize'])
    : defaultPageSize;

  return {
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    pageSize,
  };
}

export function normalizeAdminQuery(value?: string) {
  return value?.trim().replace(/[%_,()]/g, '').slice(0, 100) ?? '';
}

export function buildAdminListUrl(
  pathname: string,
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>
) {
  const params = new URLSearchParams();
  Object.entries({ ...current, ...overrides }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.size ? `${pathname}?${params.toString()}` : pathname;
}

export function toAdminPaginatedResult<T>(
  items: T[],
  total: number,
  pagination: AdminPaginationInput
): AdminPaginatedResult<T> {
  return {
    items,
    total,
    ...pagination,
    pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}
