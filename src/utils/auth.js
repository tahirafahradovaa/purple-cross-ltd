export const sessionStorageKey = 'purpleCrossSession';

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

export function createSessionUser(email) {
  const normalizedEmail = String(email ?? '').trim();

  return {
    name: userNameFromEmail(normalizedEmail),
    email: normalizedEmail,
  };
}

export function readStoredSession(storage) {
  try {
    const rawSession = storage?.getItem(sessionStorageKey);
    if (!rawSession) return null;

    const session = JSON.parse(rawSession);
    if (!session?.email || !session?.name) return null;

    return {
      name: String(session.name),
      email: String(session.email),
    };
  } catch {
    return null;
  }
}

export function writeStoredSession(storage, user) {
  storage?.setItem(sessionStorageKey, JSON.stringify({
    name: user.name,
    email: user.email,
  }));
}

export function clearStoredSession(storage) {
  storage?.removeItem(sessionStorageKey);
}

export function userNameFromEmail(email) {
  // Demo logins derive a readable display name from common email separators.
  return String(email)
    .trim()
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ') || 'Dashboard User';
}
