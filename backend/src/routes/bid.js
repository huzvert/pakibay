import express from 'express';
import { body } from 'express-validator';
import { placeBid, getBidsForItem, getHighestBid } from '../controllers/bidController.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Place a bid on an auction item
router.post(
  '/',
  protect,
  [
    body('itemId').isMongoId().withMessage('Valid itemId is required.'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Bid amount must be positive.')
  ],
  placeBid
);

export default router;

// Get all bids for an item (public)
router.get('/item/:itemId', getBidsForItem);

// Get highest bid for an item (public)
router.get('/highest/:itemId', getHighestBid);
