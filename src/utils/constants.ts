export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const DEFAULT_PAGE = 1;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500
};

export const MESSAGES = {
  CREATED: 'Tạo mới thành công',
  UPDATED: 'Cập nhật thành công',
  DELETED: 'Xóa thành công',
  NOT_FOUND: 'Không tìm thấy',
  INVALID_INPUT: 'Dữ liệu không hợp lệ',
  UNAUTHORIZED: 'Không được xác thực',
  FORBIDDEN: 'Không có quyền truy cập',
  SERVER_ERROR: 'Lỗi máy chủ nội bộ'
};
