import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { User } from './modules/users/user.model.js';
import { attachRealtime } from './realtime/hub.js';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  // Drops indexes the schema no longer defines (the old unique email index would block accounts without an email).
  await User.syncIndexes();
  const server = createServer(createApp());
  const live = attachRealtime(server);
  server.listen(env.PORT, () => console.log(`SpendMate API on :${env.PORT}`));

  const shutdown = () => { live.close(); server.close(() => mongoose.disconnect().finally(() => process.exit(0))); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});
