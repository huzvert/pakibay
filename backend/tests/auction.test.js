import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import { createTestUser } from './helpers/auth.js';
import { createAuctionItem, createBid } from './helpers/factory.js';
import Item from '../src/models/Item.js';
import Bid from '../src/models/Bid.js';
import User from '../src/models/User.js';

jest.setTimeout(20000);


// Test context variables
let seller, buyer, sellerToken, buyerToken, auctionItem, sellerId, buyerId;

beforeEach(async () => {
  // Clean up all items and bids before each test
  await Promise.all([
    Item.deleteMany({}),
    Bid.deleteMany({}),
    User.deleteMany({ email: { $in: ['seller@test.com', 'buyer@test.com'] } })
  ]);

  // Create seller and buyer users
  sellerToken = await createTestUser('Seller', 'seller@test.com', 'Password123');
  buyerToken = await createTestUser('Buyer', 'buyer@test.com', 'Password123');

  seller = await User.findOne({ email: 'seller@test.com' });
  buyer = await User.findOne({ email: 'buyer@test.com' });
  sellerId = seller._id;
  buyerId = buyer._id;

  // Create a fresh auction item owned by seller
  auctionItem = await createAuctionItem(sellerId);
});

afterAll(async () => {
  await mongoose.disconnect();
});

// Export test context for use in tests if needed
export { seller, buyer, sellerToken, buyerToken, auctionItem, sellerId, buyerId };

describe('Authorization Boundaries', () => {
  test('Non-seller cannot close auction', async () => {
    const res = await request(app)
      .post(`/api/items/${auctionItem._id}/close-auction`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
  });
  test('Unauthenticated close attempt', async () => {
    const res = await request(app)
      .post(`/api/items/${auctionItem._id}/close-auction`);
    expect(res.status).toBe(401);
  });
});

describe('Idempotency', () => {
  test('Seller closes auction once', async () => {
    const res = await request(app)
      .post(`/api/items/${auctionItem._id}/close-auction`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Auction closed');
  });
  test('Seller closes again', async () => {
    // First close: should succeed (200)
    await request(app)
      .post(`/api/items/${auctionItem._id}/close-auction`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    // Second close: should fail (403)
    const res = await request(app)
      .post(`/api/items/${auctionItem._id}/close-auction`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/already closed/i);
  });
});

describe('Bidding Integrity', () => {
  test('Bid equal to highest', async () => {
    await createBid(auctionItem._id, buyerId, 200);
    const res = await request(app)
      .post('/api/bids')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: auctionItem._id, amount: 200 });
    expect(res.status).toBe(400);
  });
  test('Bid lower than starting price', async () => {
    const res = await request(app)
      .post('/api/bids')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: auctionItem._id, amount: 50 });
    expect(res.status).toBe(400);
  });
  test('Seller bids on own item', async () => {
    const res = await request(app)
      .post('/api/bids')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ itemId: auctionItem._id, amount: 300 });
    expect(res.status).toBe(403);
  });
});

describe('Time Enforcement', () => {
  test('Bid after auction end time', async () => {
    await Item.findByIdAndUpdate(auctionItem._id, { auction_end_time: new Date(Date.now() - 1000) });
    const res = await request(app)
      .post('/api/bids')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: auctionItem._id, amount: 400 });
    expect(res.status).toBe(400);
  });
  test('Seller closes auction before end time', async () => {
    const item = await createAuctionItem(sellerId, { auction_end_time: new Date(Date.now() + 100000) });
    const res = await request(app)
      .post(`/api/items/${item._id}/close-auction`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
  });
});

describe('Highest Bid Consistency', () => {
  test('Multiple bids, highest returned correctly', async () => {
    const item = await createAuctionItem(sellerId);
    await createBid(item._id, buyerId, 500);
    await createBid(item._id, buyerId, 700);
    const res = await request(app)
      .get(`/api/bids/highest/${item._id}`);
    expect(res.body.highestBid).toBe(700);
  });
  test('Closing auction selects correct winner & final price', async () => {
    const item = await createAuctionItem(sellerId);
    await createBid(item._id, buyerId, 800);
    const res = await request(app)
      .post(`/api/items/${item._id}/close-auction`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.body.finalPrice).toBe(800);
    expect(res.body.winner.id).toBeDefined();
  });
});

describe('Data Integrity After Closure', () => {
  test('isAuctionClosed === true', async () => {
    const item = await createAuctionItem(sellerId);
    await request(app)
      .post(`/api/items/${item._id}/close-auction`)
      .set('Authorization', `Bearer ${sellerToken}`);
    const updated = await Item.findById(item._id);
    expect(updated.isAuctionClosed).toBe(true);
  });
  test('winner, finalPrice, winningBid set', async () => {
    const item = await createAuctionItem(sellerId);
    const bid = await createBid(item._id, buyerId, 900);
    await request(app)
      .post(`/api/items/${item._id}/close-auction`)
      .set('Authorization', `Bearer ${sellerToken}`);
    const updated = await Item.findById(item._id);
    expect(updated.winner.toString()).toBe(bid.bidder.toString());
    expect(updated.finalPrice).toBe(900);
    expect(updated.winningBid.toString()).toBe(bid._id.toString());
  });
  test('No further bids allowed after closure', async () => {
    const item = await createAuctionItem(sellerId);
    await request(app)
      .post(`/api/items/${item._id}/close-auction`)
      .set('Authorization', `Bearer ${sellerToken}`);
    const res = await request(app)
      .post('/api/bids')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: item._id, amount: 1000 });
    expect(res.status).toBe(400);
  });
});

describe('Input Validation', () => {
  test('Invalid itemId', async () => {
    const res = await request(app)
      .post('/api/bids')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: 'invalidid', amount: 100 });
    expect(res.status).toBe(400);
  });
  test('Non-existent item', async () => {
    const res = await request(app)
      .post('/api/bids')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: new mongoose.Types.ObjectId(), amount: 100 });
    expect(res.status).toBe(404);
  });
  test('Negative bid', async () => {
    const item = await createAuctionItem(sellerId);
    const res = await request(app)
      .post('/api/bids')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: item._id, amount: -100 });
    expect(res.status).toBe(400);
  });
  test('Missing bid amount', async () => {
    const item = await createAuctionItem(sellerId);
    const res = await request(app)
      .post('/api/bids')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ itemId: item._id });
    expect(res.status).toBe(400);
  });
});
