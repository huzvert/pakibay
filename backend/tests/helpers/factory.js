// Factory helpers for creating test data
import Item from '../../src/models/Item.js';
import Bid from '../../src/models/Bid.js';
import mongoose from 'mongoose';

export const createAuctionItem = async (sellerId, overrides = {}) => {
  const item = await Item.create({
    seller: sellerId,
    title: 'Auction Test Item',
    description: 'Test auction item',
    category: 'Test',
    images: [],
    price: 100,
    auction: true,
    auction_end_time: new Date(Date.now() + 60 * 60 * 1000),
    status: 'active',
    ...overrides
  });
  return item;
};

export const createBid = async (itemId, bidderId, amount) => {
  return await Bid.create({
    item: itemId,
    bidder: bidderId,
    amount
  });
};
