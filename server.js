const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) {}
// Refuse to start without the required secrets (no insecure defaults).
require('./server-lib/env-check').assertEnvOrExit('Paint Power CRM');
const http = require('http');
const { parse } = require('url');
const next = require('next');

// Ejecutable en Plesk/Passenger: escuchamos en process.env.PORT y en todas las interfaces
const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT, 10) || 3000; // Passenger/Plesk inyectan PORT
const host = process.env.HOST || '0.0.0.0'; // escuchar en todas las interfaces para accesibilidad externa

// No pasar hostname/port a next() — dejamos que el servidor HTTP haga el binding.
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        // Log detallado para debugging en Plesk (Passenger recogerá stderr)
        console.error('Error handling request:', err && err.stack ? err.stack : err);
        try {
          res.statusCode = 500;
          res.end('Internal Server Error');
        } catch (writeErr) {
          console.error('Failed to send 500 response:', writeErr);
        }
      }
    });

    server.on('error', (err) => {
      console.error('Server error:', err && err.stack ? err.stack : err);
      process.exit(1);
    });

    server.listen(port, host, () => {
      console.log(`> Ready on http://${host}:${port} (dev=${dev})`);
    });

    // Graceful shutdown for managed environments (Plesk/Passenger)
    const shutdown = (signal) => {
      console.log(`Received ${signal} - shutting down server...`);
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
      // Force exit after timeout
      setTimeout(() => {
        console.error('Forcing shutdown');
        process.exit(1);
      }, 5000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('uncaughtException', (err) => {
      console.error('uncaughtException:', err && err.stack ? err.stack : err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('unhandledRejection:', reason && reason.stack ? reason.stack : reason);
    });
  })
  .catch((err) => {
    console.error('Error preparing Next app:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
