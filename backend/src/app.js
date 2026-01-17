
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import itemRoutes from './routes/item.js';
import bidRoutes from './routes/bid.js';
import orderRoutes from './routes/order.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

app.use('/api/items', itemRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/orders', orderRoutes);

app.get('/', (req, res) => {
  res.send('Pakibay API running');
});

export default app;
