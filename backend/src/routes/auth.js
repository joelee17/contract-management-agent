import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const SALT_ROUNDS = 10;

export default async function authRoutes(fastify) {
  // POST /register
  fastify.post('/register', async (request, reply) => {
    const { email, password, name } = request.body || {};

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name || null]
    );

    const user = result.rows[0];
    const token = fastify.jwt.sign({ id: user.id, email: user.email, name: user.name });

    return reply.status(201).send({ token, user });
  });

  // POST /login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body || {};

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const result = await query('SELECT id, email, name, password FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email, name: user.name });

    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  // GET /me
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [request.user.id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({ user: result.rows[0] });
  });
}
