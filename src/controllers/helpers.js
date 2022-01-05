'use strict';

export const paginationParams = (page, limit) => {
  if (page === undefined || limit === undefined) {
    return {
      page: undefined,
      limit: undefined,
    }
  }
  
  if (page < 1) {
    page = 1;
  }

  if (limit < 1) {
    limit = 1;
  }

  return {
    limit: limit ? limit : 15,
    offset: (page ? page - 1 : 0) * limit,
  }
}

export const optionallyPaginatedResponse = ({count, rows}, page, limit) => {
  if (page) {
    return {
      page,
      pageCount: Math.ceil(count / (limit || 15)),
      data: rows,
    }
  } else {
    return rows;
  }
}