require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

console.log("SERVER.JS AKTIF");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const logger = require("./utils/logger");
const db = require("./models");

const apiRoutes = require("./routes/api");
const webRoutes = require("./routes/web");
const portalRoutes = require("./routes/portal");
const wilayahRoutes = require("./routes/wilayah");

const {
  errorHandler,
  notFoundHandler,
} = require("./middleware/errorHandler");

const {
  demoDataMasker,
} = require("./middleware/demoDataMasker");

const SNMPService = require("./services/SNMPService");
const CronService = require("./services/CronService");
const setupSocket = require("./services/SocketHandler");

const app = express();

app.set("trust proxy", true);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin:
      process.env.APP_URL ||
      "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setupSocket(io);

app.set("io", io);

require("./services/NotificationService")
  .setIO(io);

require("./services/PushService")
  .init();

app.set("view engine", "ejs");

app.set(
  "views",
  path.join(
    __dirname,
    "..",
    "frontend",
    "views"
  )
);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin:
      process.env.APP_URL ||
      "http://localhost:3001",
    credentials: true,
  })
);

app.use(compression());

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());

app.use(
  morgan("combined", {
    stream: {
      write: (msg) =>
        logger.info(msg.trim()),
    },
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: {
    success: false,
    message: "Too many requests",
  },
});

app.use("/api", apiLimiter);

app.use(
  express.static(
    path.join(
      __dirname,
      "..",
      "frontend",
      "public"
    )
  )
);

app.use(
  "/uploads",
  express.static(
    path.join(
      __dirname,
      "..",
      "uploads"
    )
  )
);

app.get("/sw.js", (req, res) => {
  res.setHeader(
    "Content-Type",
    "application/javascript"
  );

  res.setHeader(
    "Service-Worker-Allowed",
    "/"
  );

  res.sendFile(
    path.join(
      __dirname,
      "..",
      "frontend",
      "public",
      "sw.js"
    )
  );
});

app.get("/favicon.ico", async (req, res) => {

  const defaultPath = path.join(
    __dirname,
    "..",
    "frontend",
    "public",
    "favicon.ico"
  );

  if (fs.existsSync(defaultPath)) {
    return res.sendFile(defaultPath);
  }

  res.status(204).end();
});

app.use("/api", demoDataMasker);

app.use((req, res, next) => {

  res.locals.appName = "ISPNET";

  next();
});

/*
|--------------------------------------------------------------------------
| ROUTES
|--------------------------------------------------------------------------
*/

app.use(
  "/api/wilayah",
  wilayahRoutes
);

app.use("/api", apiRoutes);

app.use("/portal", portalRoutes);

app.use("/", webRoutes);

/*
|--------------------------------------------------------------------------
| ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use(notFoundHandler);

app.use(errorHandler);

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

const PORT =
  process.env.APP_PORT || 3000;

const startServer = async () => {

  try {

    await db.sequelize.authenticate();

    logger.info(
      "Database connection established"
    );

    if (
      process.env.APP_ENV ===
      "development"
    ) {

      await db.sequelize.sync({
        alter: false,
      });

      logger.info(
        "Database models synced"
      );
    }

    const snmpService =
      new SNMPService(io);

    SNMPService.setInstance(
      snmpService
    );

    snmpService.startAll();

    CronService.start();

    const WAService =
      require("./services/WAService");

    WAService.restoreAllSessions(io);

    server.listen(PORT, () => {

      logger.info(
        `ISP NetOps running on http://localhost:${PORT}`
      );

      console.log(`
ISPNET running on http://localhost:${PORT}
`);
    });

    process.on(
      "SIGTERM",
      async () => {

        logger.info(
          "SIGTERM received, shutting down..."
        );

        snmpService.stopAll();

        CronService.stop();

        await db.sequelize.close();

        server.close(() =>
          process.exit(0)
        );
      }
    );

  } catch (error) {

    logger.error(
      "Failed to start server:",
      error
    );

    process.exit(1);
  }
};

startServer();

module.exports = {
  app,
  server,
  io,
};