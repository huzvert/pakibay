import Order from '../models/Order.js';
import User from '../models/User.js';
// Create order for buy-now or auction completion

// Get all orders for logged-in user

// Get all orders for a specific item
// Close auction (idempotent, only seller, only auction, only if not already closed)
import Bid from '../models/Bid.js';
export const closeAuction = async (req, res) => {
  try {
    const { id } = req.params;
    // Validate itemId format
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({ message: 'Invalid itemId format.' });
    }
    // Always fetch the latest item state from DB for idempotency
    let item = await Item.findById(id);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    // Idempotency guard: block re-closing if either isAuctionClosed or isClosed is true
    if (item.isAuctionClosed === true || item.isClosed === true) {
      return res.status(403).json({ message: 'Auction already closed' });
    }
    // Ownership check (must come after idempotency)
    if (item.seller.toString() !== req.user.id) return res.status(403).json({ message: 'Only seller can close auction.' });
    // Find highest bid
    const highestBid = await Bid.findOne({ item: item._id }).sort({ amount: -1 });
    if (!highestBid) {
      await Item.findByIdAndUpdate(id, {
        isAuctionClosed: true,
        winningBid: null,
        winner: null,
        finalPrice: null
      });
      return res.json({ message: 'Auction closed', winner: null, finalPrice: null });
    }
    await Item.findByIdAndUpdate(id, {
      isAuctionClosed: true,
      winningBid: highestBid._id,
      winner: highestBid.bidder,
      finalPrice: highestBid.amount
    });
    return res.json({
      message: 'Auction closed',
      winner: { id: highestBid.bidder, name: highestBid.bidder?.username },
      finalPrice: highestBid.amount
    });
  } catch (err) {
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid itemId format.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
};
import Item from '../models/Item.js';
import { validationResult } from 'express-validator';

// Create item (auth required)
export const createItem = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(e => e.msg) });
  }
  try {
    const { title, description, category, images, price, auction, auction_end_time } = req.body;
    const item = await Item.create({
      seller: req.user.id,
      title,
      description,
      category,
      images,
      price,
      auction,
      auction_end_time: auction ? auction_end_time : null
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// Get all items (with search & filter)
export const getAllItems = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, auction, status } = req.query;
    const query = {};
    if (search) query.title = { $regex: search, $options: 'i' };
    if (category) query.category = category;
    if (auction !== undefined) query.auction = auction === 'true';
    if (status) query.status = status;
    if (minPrice || maxPrice) query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
    const items = await Item.find(query).populate('seller', 'username email');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// Get item by ID
export const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('seller', 'username email');
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};
