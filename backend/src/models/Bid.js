import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  bidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Bid', bidSchema);
