import Order from '../models/Order.js';
import User from '../models/User.js';
import Item from '../models/Item.js';

// Create order for buy-now or auction completion
export const createOrder = async (req, res) => {
  try {
    const { itemId, type } = req.body;
    // Validate input
    if (!itemId || !type) {
      return res.status(400).json({ message: 'Missing itemId or type.' });
    }
    // Validate itemId format
    if (!/^[a-fA-F0-9]{24}$/.test(itemId)) {
      return res.status(400).json({ message: 'Invalid itemId format.' });
    }
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    // Prevent duplicate orders for same user/item
    const existingOrder = await Order.findOne({ item: item._id, buyer: req.user.id });
    if (existingOrder) return res.status(400).json({ message: 'Order already exists for this item/user.' });

    let buyer, price;
    if (type === 'auction') {
      if (!item.auction || !item.isAuctionClosed || !item.winner) {
        return res.status(400).json({ message: 'Auction not closed or no winner.' });
      }
      if (item.winner.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Only auction winner can order.' });
      }
      buyer = item.winner;
      price = item.finalPrice;
    } else if (type === 'buy-now') {
      if (item.auction) return res.status(400).json({ message: 'Cannot buy-now an auction item.' });
      if (item.status !== 'active') return res.status(400).json({ message: 'Item not available.' });
      buyer = req.user.id;
      price = item.price;
    } else {
      return res.status(400).json({ message: 'Invalid order type.' });
    }

    // Mark item as sold for buy-now
    if (type === 'buy-now') {
      item.status = 'sold';
      await item.save();
    }

    // Create order
    const order = await Order.create({
      item: item._id,
      buyer,
      seller: item.seller,
      price,
      status: 'completed'
    });

    // Update seller rating (safe: only increment if not null)
    await User.findByIdAndUpdate(item.seller, { $inc: { rating: 1 } });

    return res.status(201).json({
      message: 'Order created',
      order
    });
  } catch (err) {
    // Handle invalid ObjectId error
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid itemId format.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
};

// Get all orders for logged-in user
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user.id }).populate('item seller buyer');
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// Get all orders for a specific item
export const getItemOrders = async (req, res) => {
  try {
    const { itemId } = req.params;
    const orders = await Order.find({ item: itemId }).populate('item seller buyer');
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};
