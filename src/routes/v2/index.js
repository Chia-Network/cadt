import express from 'express';
import { MethodologyV2Router } from './resources/methodology-v2.js';

const V2Router = express.Router();

// Basic health check for V2
V2Router.get('/health', (req, res) => {
  res.status(200).json({
    message: 'V2 API is running',
    timestamp: new Date().toISOString(),
  });
});

// V2 API routes
V2Router.use('/methodology', MethodologyV2Router);

export { V2Router };
