import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  price: {
    type: Number,
    required: true,
    min: 0
  },
  auction: {
    type: Boolean,
    default: false
  },
  auction_end_time: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'expired'],
    default: 'active'
  },
  // Auction idempotency and closure flags
  isAuctionClosed: {
    type: Boolean,

    
    default: false
  },
  isClosed: {
    type: Boolean,
    default: false
  },
  // Auction finalization fields
  winningBid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid',
    default: null
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  finalPrice: {
    type: Number,
    default: null
  }
}, { timestamps: true });

export default mongoose.model('Item', itemSchema);
