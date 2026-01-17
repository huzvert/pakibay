import express from 'express';
import { body } from 'express-validator';
import { register, login } from '../controllers/authController.js';

const router = express.Router();

router.post(
	'/register',
	(req, res, next) => {
		if (req.body.name && !req.body.username) {
			req.body.username = req.body.name;
		}
		next();
	},
	[
		body('username')
			.trim()
			.isLength({ min: 3, max: 30 })
			.withMessage('Username must be 3-30 characters.'),
		body('email')
			.isEmail()
			.withMessage('Invalid email address.'),
		body('password')
			.isLength({ min: 8 })
			.withMessage('Password must be at least 8 characters.')
	],
	register
);

router.post(
	'/login',
	[
		body('email').isEmail().withMessage('Invalid email address.'),
		body('password').notEmpty().withMessage('Password is required.')
	],
	login
);

export default router;
