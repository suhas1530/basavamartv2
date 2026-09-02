const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const passport = require('passport');

const aiRoutes = require('./routes/aiRoutes');

dotenv.config();
require('./config/passport');

console.log('>>> SERVER FILE RUNNING FROM:', __filename);

const app = express();
const server = http.createServer(app);

/* =========================================================
   PATHS
========================================================= */

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

console.log('>>> ROOT DIR:', ROOT_DIR);
console.log('>>> DIST DIR:', DIST_DIR);
console.log('>>> UPLOADS DIR:', UPLOADS_DIR);

/* =========================================================
   CORS
========================================================= */

const CLIENT_URL =
  process.env.CLIENT_URL || 'http://localhost:3000';

const corsOptions = {
  origin: CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

app.use(cors(corsOptions));

/* =========================================================
   SOCKET.IO
========================================================= */

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

// Make Socket.IO available inside routes
app.set('io', io);

/* =========================================================
   BODY PARSERS
========================================================= */

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/* =========================================================
   PASSPORT
========================================================= */

app.use(passport.initialize());

/* =========================================================
   STATIC UPLOADS
========================================================= */

app.use(
  '/uploads',
  express.static(UPLOADS_DIR)
);

/* =========================================================
   API ROUTES
========================================================= */

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/brands', require('./routes/brands'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/pipes', require('./routes/pipes'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/members', require('./routes/members'));
app.use('/api/basket', require('./routes/basket'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/invoice', require('./routes/invoice'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ai-search', aiRoutes);
app.use('/api/mini', require('./routes/mini'));

/* =========================================================
   SOCKET.IO CONNECTION
========================================================= */

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-admin', () => {
    console.log(`Socket ${socket.id} joined admin-room`);
    socket.join('admin-room');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

/* =========================================================
   FRONTEND DIST SERVING
========================================================= */

// Serve React/Vite dist folder
app.use(
  express.static(DIST_DIR, {
    index: false,
    maxAge: '1d',
  })
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   REACT / VITE SPA FALLBACK
========================================================= */

// IMPORTANT:
// This must come AFTER all API routes.
//
// It allows routes such as:
// /
// /login
// /admin
// /products
// /orders
// etc.
//
// to load index.html when directly accessed.

app.get('*', (req, res, next) => {
  // Never send index.html for API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // Never send index.html for uploads
  if (req.path.startsWith('/uploads/')) {
    return next();
  }

  res.sendFile(
    path.join(DIST_DIR, 'index.html'),
    (err) => {
      if (err) {
        console.error('Error serving frontend:', err);

        if (!res.headersSent) {
          res.status(500).send(
            'Frontend dist/index.html could not be served.'
          );
        }
      }
    }
  );
});

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

/* =========================================================
   MONGODB CONNECTION
========================================================= */

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/basava-mart';

const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');

    try {
      const Brand = require('./models/Brand');
      const {
        Category,
        Subcategory,
      } = require('./models/Category');

      await Promise.all([
        Brand.updateMany(
          { accessLevel: { $exists: false } },
          { $set: { accessLevel: 'both' } }
        ),

        Category.updateMany(
          { accessLevel: { $exists: false } },
          { $set: { accessLevel: 'both' } }
        ),

        Subcategory.updateMany(
          { accessLevel: { $exists: false } },
          { $set: { accessLevel: 'both' } }
        ),
      ]);

      console.log('Access level backfill completed');
    } catch (err) {
      console.error(
        'Access level backfill error:',
        err.message
      );
    }

    /* =====================================================
       START SERVER
    ===================================================== */

    server.listen(PORT, '0.0.0.0', () => {
      console.log('========================================');
      console.log(`Server running on port ${PORT}`);
      console.log(`API: http://localhost:${PORT}/api`);
      console.log(`Frontend: http://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log(`Dist: ${DIST_DIR}`);
      console.log('========================================');
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  app,
  server,
  io,
};
