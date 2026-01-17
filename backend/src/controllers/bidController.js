// Get all bids for an item, ordered by highest amount first
export const getBidsForItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    if (!itemId || !/^[a-fA-F0-9]{24}$/.test(itemId)) {
      return res.status(400).json({ message: 'Invalid itemId format.' });
    }
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    const bids = await Bid.find({ item: itemId })
      .sort({ amount: -1 })
      .populate('bidder', 'username email');
    res.json({
      itemId,
      totalBids: bids.length,
      bids: bids.map(b => ({
        amount: b.amount,
        bidder: b.bidder ? { id: b.bidder._id, name: b.bidder.username, email: b.bidder.email } : null,
        createdAt: b.timestamp
      }))
    });
  } catch (err) {
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid itemId format.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
};

// Get the highest bid for an item (or starting price if no bids)
export const getHighestBid = async (req, res) => {
  try {
    const { itemId } = req.params;
    if (!itemId || !/^[a-fA-F0-9]{24}$/.test(itemId)) {
      return res.status(400).json({ message: 'Invalid itemId format.' });
    }
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    const highestBid = await Bid.findOne({ item: itemId })
      .sort({ amount: -1 })
      .populate('bidder', 'username');
    res.json({
      itemId,
      highestBid: highestBid ? highestBid.amount : item.price,
      bidder: highestBid && highestBid.bidder ? { id: highestBid.bidder._id, name: highestBid.bidder.username } : null
    });
  } catch (err) {
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid itemId format.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
};
// placeBid controller for auction items
// - Only allow bids on items with auction: true, status: 'active', and auction_end_time in the future
// - Bid must be higher than current highest (or starting price)
// - Seller cannot bid on own item
// - No bids after auction_end_time
// - Validate input and handle edge cases

import Item from '../models/Item.js';
import Bid from '../models/Bid.js';
import { validationResult } from 'express-validator';

export const placeBid = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(e => e.msg) });
  }
  try {
    const { itemId, amount } = req.body;
    if (!itemId || amount === undefined) {
      return res.status(400).json({ message: 'itemId and amount are required.' });
    }
    if (!/^[a-fA-F0-9]{24}$/.test(itemId)) {
      return res.status(400).json({ message: 'Invalid itemId format.' });
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Bid amount must be a positive number.' });
    }
    const item = await Item.findById(itemId);
    if (!item) {
      // Only return 404 if the item truly does not exist
      return res.status(404).json({ message: 'Item not found.' });
    }
    // All other validation errors should return 400 or 403
    if (!item.auction) return res.status(400).json({ message: 'Bidding not allowed on this item.' });
    if (item.status !== 'active') return res.status(400).json({ message: 'Auction is not active.' });
    if (item.isAuctionClosed) return res.status(400).json({ message: 'Auction is already closed.' });
    if (!item.auction_end_time || new Date() > item.auction_end_time) {
      return res.status(400).json({ message: 'Auction has ended.' });
    }
    if (item.seller.toString() === req.user.id) {
      return res.status(403).json({ message: 'Seller cannot bid on own item.' });
    }
    // Find current highest bid
    const highestBid = await Bid.findOne({ item: item._id }).sort({ amount: -1 });
    const minBid = highestBid ? highestBid.amount : item.price;
    if (Number(amount) <= minBid) {
      return res.status(400).json({ message: `Bid must be greater than current highest (${minBid}).` });
    }
    // Save bid
    const bid = await Bid.create({
      item: item._id,
      bidder: req.user.id,
      amount: Number(amount)
    });
    return res.status(201).json({
      message: 'Bid placed successfully.',
      bid
    });
  } catch (err) {
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid itemId format.' });
    }
    console.error('Bid error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};
