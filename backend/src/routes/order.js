import express from 'express';
import protect from '../middleware/auth.js';
import { createOrder, getUserOrders, getItemOrders } from '../controllers/orderController.js';

const router = express.Router();

// Create order (buy-now or auction)
router.post('/', protect, createOrder);

// Get all orders for logged-in user
router.get('/user', protect, getUserOrders);

// Get all orders for a specific item
router.get('/item/:itemId', protect, getItemOrders);

export default router;
