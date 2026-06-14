import { DEFAULT_LIMIT, MAX_LIMIT, DEFAULT_PAGE } from './constants';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

export const getPaginationParams = (page: any, limit: any): PaginationParams => {
  const p = Math.max(1, parseInt(page) || DEFAULT_PAGE);
  const l = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT));
  const skip = (p - 1) * l;
  return { page: p, limit: l, skip };
};

export const getPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> => ({
  data,
  total,
  page,
  pages: Math.ceil(total / limit)
});

export const buildFilter = (filters: { [key: string]: any }): { [key: string]: any } => {
  const filter: { [key: string]: any } = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== '') {
      filter[key] = value;
    }
  }

  return filter;
};

export const buildDateFilter = (dateFromStr?: string, dateToStr?: string) => {
  const dateFilter: { [key: string]: any } = {};

  if (dateFromStr) {
    try {
      const dateFrom = new Date(dateFromStr);
      if (!isNaN(dateFrom.getTime())) {
        dateFilter.$gte = dateFrom;
      }
    } catch (e) {}
  }

  if (dateToStr) {
    try {
      const dateTo = new Date(dateToStr);
      if (!isNaN(dateTo.getTime())) {
        dateFilter.$lte = dateTo;
      }
    } catch (e) {}
  }

  return Object.keys(dateFilter).length > 0 ? dateFilter : undefined;
};
