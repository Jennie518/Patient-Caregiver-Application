const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server);

// Configure file upload
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 }, // Set file size limit to 1MB
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  }
}).single('avatar');

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
}

app.use(express.static('public'));

// Store connected clients and user data
const clients = {};
const userData = {};

// When a client connects
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Listen for user registration
  socket.on('register', (userType, { userId, avatar, caption }) => {
    console.log(`User registered as ${userType}: ${socket.id}`);
    clients[userType] = { socket: socket, userId: userId };

    // If user data already exists, send it to the client
    if (userData[userId]) {
      socket.emit('init', userData[userId]);
    } else {
      // Otherwise, store new user data
      userData[userId] = { avatar, caption };
      socket.emit('init', { avatar, caption });
    }
  });

  // Listen for the "Go" button click from the monitor
  socket.on('go', () => {
    if (clients['user']) {
      clients['user'].socket.emit('go');
    }
    if (clients['monitor']) {
      clients['monitor'].socket.emit('go');
    }
  });

  // When a client disconnects
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove the disconnected client
    for (let userType in clients) {
      if (clients[userType].socket.id === socket.id) {
        delete clients[userType];
      }
    }
  });
});

// Avatar upload endpoint
app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.log('Upload error:', err);
      res.json({ msg: err });
    } else {
      if (req.file == undefined) {
        console.log('No file selected');
        res.json({ msg: 'Error: No File Selected!' });
      } else {
        console.log('File uploaded:', req.file.filename);
        res.json({
          msg: 'File Uploaded!',
          file: `uploads/${req.file.filename}`
        });
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
