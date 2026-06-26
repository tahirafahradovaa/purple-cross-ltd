import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeUser,
  userNameFromEmail,
  validateLogin,
  validateUser,
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

describe('user edit validation', () => {
  const users = [
    {
      id: 'USR001',
      name: 'Admin Manager',
      email: 'admin@purplecross.test',
      role: 'System Administrator',
      status: 'Active',
      lastActive: 'Today',
    },
    {
      id: 'USR002',
      name: 'Helen Caruana',
      email: 'helen.caruana@purplecross.test',
      role: 'HR Manager',
      status: 'Active',
      lastActive: 'Yesterday',
    },
  ];

  it('requires user edit fields', () => {
    assert.deepEqual(validateUser({
      id: 'USR003',
      name: '',
      email: '',
      role: '',
      status: '',
      lastActive: '',
    }, users), {
      name: 'Name is required.',
      email: 'Email is required.',
      role: 'Role is required.',
      status: 'Status is required.',
    });
  });

  it('rejects invalid user emails', () => {
    const errors = validateUser({
      ...users[0],
      email: 'admin',
    }, users, users[0].email);

    assert.equal(errors.email, 'Enter a valid email address.');
  });

  it('rejects duplicate user emails case-insensitively', () => {
    const errors = validateUser({
      ...users[1],
      email: 'ADMIN@purplecross.test',
    }, users, users[1].email);

    assert.equal(errors.email, 'This email is already assigned to another user.');
  });

  it('allows a user to keep the same email while editing', () => {
    assert.deepEqual(validateUser(users[0], users, users[0].email), {});
  });

  it('normalizes user fields before saving', () => {
    const user = normalizeUser({
      id: ' USR003 ',
      name: '  Mark Grech ',
      email: ' mark.grech@purplecross.test ',
      role: ' HR Viewer ',
      status: ' Active ',
      lastActive: ' Today ',
    });

    assert.deepEqual(user, {
      id: 'USR003',
      name: 'Mark Grech',
      email: 'mark.grech@purplecross.test',
      role: 'HR Viewer',
      status: 'Active',
      lastActive: 'Today',
    });
  });
});
