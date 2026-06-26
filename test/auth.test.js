import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clearStoredSession,
  createSessionUser,
  readStoredSession,
  sessionStorageKey,
  userNameFromEmail,
  validateLogin,
  writeStoredSession,
} from '../src/utils/auth.js';

describe('login validation', () => {
  it('requires email and password', () => {
    assert.equal(
      validateLogin({ email: '', password: '' }),
      'Email and password are required.',
    );
  });

  it('rejects invalid email addresses', () => {
    assert.equal(
      validateLogin({ email: 'admin', password: 'purplecross' }),
      'Enter a valid email address.',
    );
  });

  it('rejects short passwords', () => {
    assert.equal(
      validateLogin({ email: 'admin@purplecross.test', password: '123' }),
      'Password must be at least 6 characters.',
    );
  });

  it('accepts valid credentials', () => {
    assert.equal(
      validateLogin({ email: 'admin@purplecross.test', password: 'purplecross' }),
      '',
    );
  });

  it('derives a display name from email prefixes', () => {
    assert.equal(userNameFromEmail('admin.manager@purplecross.test'), 'Admin Manager');
    assert.equal(userNameFromEmail('@purplecross.test'), 'Dashboard User');
  });
});

describe('login session storage', () => {
  it('creates a session user from an email address', () => {
    assert.deepEqual(createSessionUser('admin.manager@purplecross.test'), {
      name: 'Admin Manager',
      email: 'admin.manager@purplecross.test',
    });
  });

  it('writes and reads a stored session', () => {
    const storage = createMemoryStorage();
    const user = createSessionUser('admin@purplecross.test');

    writeStoredSession(storage, user);

    assert.equal(storage.getItem(sessionStorageKey), JSON.stringify(user));
    assert.deepEqual(readStoredSession(storage), user);
  });

  it('clears a stored session on logout', () => {
    const storage = createMemoryStorage();

    writeStoredSession(storage, createSessionUser('admin@purplecross.test'));
    clearStoredSession(storage);

    assert.equal(readStoredSession(storage), null);
  });

  it('ignores malformed stored session data', () => {
    const storage = createMemoryStorage();
    storage.setItem(sessionStorageKey, '{bad json');

    assert.equal(readStoredSession(storage), null);
  });
});

function createMemoryStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}
