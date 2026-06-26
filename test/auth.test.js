import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { userNameFromEmail, validateLogin } from '../src/utils/auth.js';

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
