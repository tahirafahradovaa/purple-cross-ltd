export function validateLogin(credentials) {
  const email = String(credentials.email ?? '').trim();
  const password = String(credentials.password ?? '').trim();

  if (!email || !password) {
    return 'Email and password are required.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Enter a valid email address.';
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters.';
  }

  return '';
}

export function normalizeUser(user) {
  return {
    id: String(user.id ?? '').trim(),
    name: String(user.name ?? '').trim(),
    email: String(user.email ?? '').trim(),
    role: String(user.role ?? '').trim(),
    status: String(user.status ?? '').trim(),
    lastActive: String(user.lastActive ?? '').trim(),
  };
}

export function validateUser(user, existingUsers, originalEmail = '') {
  const normalized = normalizeUser(user);
  const errors = {};

  if (!normalized.name) errors.name = 'Name is required.';
  if (!normalized.email) errors.email = 'Email is required.';
  if (!normalized.role) errors.role = 'Role is required.';
  if (!normalized.status) errors.status = 'Status is required.';

  if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    errors.email = 'Enter a valid email address.';
  }

  const duplicate = existingUsers.some((existingUser) => (
    existingUser.email.toLowerCase() === normalized.email.toLowerCase()
    && existingUser.email.toLowerCase() !== originalEmail.toLowerCase()
  ));

  if (duplicate) errors.email = 'This email is already assigned to another user.';

  return errors;
}

export function userNameFromEmail(email) {
  return String(email)
    .trim()
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ') || 'Dashboard User';
}
