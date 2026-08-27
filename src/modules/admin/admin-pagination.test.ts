import { describe, expect, it } from 'vitest';
import { buildAdminListUrl, normalizeAdminPagination, normalizeAdminQuery, toAdminPaginatedResult } from './admin-pagination';

describe('admin pagination', () => {
  it('normalizes invalid and excessive inputs', () => {
    expect(normalizeAdminPagination({ page: '-2', pageSize: '999' }, 25)).toEqual({ page: 1, pageSize: 25 });
    expect(normalizeAdminPagination({ page: '3', pageSize: '100' }, 25)).toEqual({ page: 3, pageSize: 100 });
    expect(normalizeAdminQuery('  drone%,()  ')).toBe('drone');
  });

  it('keeps empty results on one navigable page', () => {
    expect(toAdminPaginatedResult([], 0, { page: 1, pageSize: 25 })).toMatchObject({ total: 0, pageCount: 1 });
  });

  it('preserves filters while replacing pagination state', () => {
    expect(buildAdminListUrl('/admin/produtos', { q: 'drone', status: 'active' }, { page: 2, pageSize: 50 })).toBe('/admin/produtos?q=drone&status=active&page=2&pageSize=50');
  });
});
