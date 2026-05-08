/**
 * Express 应用装配
 *
 * 仅负责装配中间件与路由，不调用 listen —— 启动逻辑放在 server.js。
 * 这样便于在测试中 import app 直接用 supertest 发请求。
 */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env, isProduction } from "./config/env.js";
import routes from "./routes/index.js";
import { generalLimiter } from "./middlewares/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

const app = express();
const corsOriginSet = new Set(env.corsOrigins);

app.disable("x-powered-by");

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (!isProduction || corsOriginSet.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isProduction ? "combined" : "dev"));

app.use("/api", generalLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
