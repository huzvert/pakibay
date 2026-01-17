import express from 'express';
import { body } from 'express-validator';
import { createItem, getAllItems, getItemById, closeAuction } from '../controllers/itemController.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Create item (auth required)
router.post(
  '/',
  protect,
  [
    body('title').isLength({ min: 3, max: 100 }).withMessage('Title is required (3-100 chars).'),
    body('description').isLength({ min: 10, max: 2000 }).withMessage('Description is required (10-2000 chars).'),
    body('category').notEmpty().withMessage('Category is required.'),
    body('images').isArray().withMessage('Images must be an array.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number.'),
    body('auction').isBoolean().withMessage('Auction must be true or false.'),
    body('auction_end_time').custom((value, { req }) => {
      if (req.body.auction && !value) {
        throw new Error('Auction end time required for auction items.');
      }
      return true;
    })
  ],
  createItem
);

// Get all items (search/filter)
router.get('/', getAllItems);

// Get item by ID
router.get('/:id', getItemById);


// Close auction (seller only, JWT required)
router.post('/:id/close-auction', protect, closeAuction);

export default router;
