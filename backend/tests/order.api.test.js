import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Item from '../src/models/Item.js';
import Order from '../src/models/Order.js';
import Bid from '../src/models/Bid.js';
import { createTestUser } from './helpers/auth.js';
import { createAuctionItem } from './helpers/factory.js';

let buyerToken, sellerToken, buyer, seller, buyNowItem, auctionItem;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Item.deleteMany({}),
    Order.deleteMany({}),
    Bid.deleteMany({})
  ]);
  // Create seller and buyer
  sellerToken = await createTestUser('Seller', 'seller@test.com', 'Password123');
  buyerToken = await createTestUser('Buyer', 'buyer@test.com', 'Password123');
  seller = await User.findOne({ email: 'seller@test.com' });
  buyer = await User.findOne({ email: 'buyer@test.com' });
  // Create buy-now item
  buyNowItem = await Item.create({
    seller: seller._id,
    title: 'Buy Now Item',
    description: 'A buy-now item',
    category: 'Test',
    images: [],
    price: 100,
    auction: false,
    status: 'active'
  });
  // Create auction item and close auction
  auctionItem = await createAuctionItem(seller._id);
  auctionItem.isAuctionClosed = true;
  auctionItem.winner = buyer._id;
  auctionItem.finalPrice = 200;
  await auctionItem.save();
});

describe('Order API', () => {
  test('Creates a buy-now order with valid JWT', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: buyNowItem._id, type: 'buy-now' });
    expect(res.status).toBe(201);
    expect(res.body.order).toBeDefined();
    expect(res.body.order.buyer).toBe(buyer._id.toString());
    expect(res.body.order.seller).toBe(seller._id.toString());
    expect(res.body.order.item).toBe(buyNowItem._id.toString());
    // Item status should be updated
    const updatedItem = await Item.findById(buyNowItem._id);
    expect(updatedItem.status).toBe('sold');
    // Seller rating should be incremented
    const updatedSeller = await User.findById(seller._id);
    expect(updatedSeller.rating).toBe(1);
  });

  test('Creates an auction order with valid JWT', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: auctionItem._id, type: 'auction' });
    expect(res.status).toBe(201);
    expect(res.body.order).toBeDefined();
    expect(res.body.order.buyer).toBe(buyer._id.toString());
    expect(res.body.order.seller).toBe(seller._id.toString());
    expect(res.body.order.item).toBe(auctionItem._id.toString());
    // Seller rating should be incremented
    const updatedSeller = await User.findById(seller._id);
    expect(updatedSeller.rating).toBe(1);
  });

  test('Prevents duplicate orders (same user + item)', async () => {
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: buyNowItem._id, type: 'buy-now' });
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: buyNowItem._id, type: 'buy-now' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  test('Validates input: missing itemId', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ type: 'buy-now' });
    expect(res.status).toBe(400);
  });

  test('Validates input: invalid itemId', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: 'invalidid', type: 'buy-now' });
    expect(res.status).toBe(400);
  });

  test('Validates input: missing JWT', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ itemId: buyNowItem._id, type: 'buy-now' });
    expect(res.status).toBe(401);
  });

  test('Fetches all orders for a given user', async () => {
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: buyNowItem._id, type: 'buy-now' });
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: auctionItem._id, type: 'auction' });
    const res = await request(app)
      .get('/api/orders/user')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(2);
    expect(res.body.orders[0].buyer._id).toBe(buyer._id.toString());
  });

  test('Fetches all orders for a given item', async () => {
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: buyNowItem._id, type: 'buy-now' });
    const res = await request(app)
      .get(`/api/orders/item/${buyNowItem._id}`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(1);
    expect(res.body.orders[0].item._id).toBe(buyNowItem._id.toString());
  });

  test('Edge: Unauthorized access', async () => {
    const res = await request(app)
      .get('/api/orders/user');
    expect(res.status).toBe(401);
  });

  test('Edge: Non-existent item', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: fakeId, type: 'buy-now' });
    expect(res.status).toBe(404);
  });

  test('Edge: Attempting to order an already sold item', async () => {
    // First order
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: buyNowItem._id, type: 'buy-now' });
    // Second order by another user
    const otherToken = await createTestUser('Other', 'other@test.com', 'Password123');
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ itemId: buyNowItem._id, type: 'buy-now' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not available/i);
  });
});
