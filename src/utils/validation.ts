export interface ValidationResult {
  valid: boolean;
  errors: { [key: string]: string };
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): ValidationResult => {
  const errors: { [key: string]: string } = {};

  if (password.length < 8) {
    errors.length = 'Mật khẩu phải có ít nhất 8 ký tự';
  }
  if (!/[A-Z]/.test(password)) {
    errors.uppercase = 'Mật khẩu phải chứa ít nhất 1 chữ hoa';
  }
  if (!/[a-z]/.test(password)) {
    errors.lowercase = 'Mật khẩu phải chứa ít nhất 1 chữ thường';
  }
  if (!/[0-9]/.test(password)) {
    errors.number = 'Mật khẩu phải chứa ít nhất 1 số';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.special = 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&* v.v.)';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateUsername = (username: string): ValidationResult => {
  const errors: { [key: string]: string } = {};

  if (username.length < 3) {
    errors.length = 'Username phải có ít nhất 3 ký tự';
  }
  if (username.length > 20) {
    errors.length = 'Username không được vượt quá 20 ký tự';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.format = 'Username chỉ được chứa chữ, số, _, -';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateFullName = (fullName: string): ValidationResult => {
  const errors: { [key: string]: string } = {};

  if (fullName.trim().length < 2) {
    errors.length = 'Tên đầy đủ phải có ít nhất 2 ký tự';
  }
  if (fullName.length > 100) {
    errors.length = 'Tên đầy đủ không được vượt quá 100 ký tự';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};
