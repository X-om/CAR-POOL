import { createApp } from './app'
import { BACKEND_PORT } from './env';

const PORT = BACKEND_PORT;

async function startServer() {
  const app = await createApp();
  app.listen(PORT, () => {
    console.log(`API Gateway is running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});