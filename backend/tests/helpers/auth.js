// Auth helpers for test users
import request from 'supertest';
import app from '../../src/app.js';

export const registerUser = async (user) => {
  await request(app)
    .post('/api/auth/register')
    .send(user);
};

export const loginUser = async (email, password) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.token;
};

export const createTestUser = async (name, email, password) => {
  await registerUser({ name, email, password });
  return await loginUser(email, password);
};
