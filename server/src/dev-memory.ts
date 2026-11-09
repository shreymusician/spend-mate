// Zero-setup dev server: in-memory MongoDB (data is lost on exit). Use Atlas via `npm run dev` for real persistence.
process.env.JWT_ACCESS_SECRET ??= 'dev-only-secret-dev-only-secret-dev-only';
process.env.PIN_PEPPER ??= 'dev-only-pepper-dev-only-pepper-dev-only';
process.env.MONGODB_URI ??= 'mongodb://in-memory';
const { MongoMemoryServer } = await import('mongodb-memory-server');
const { default: mongoose } = await import('mongoose');
const { createApp } = await import('./app.js');
const { env } = await import('./config/env.js');

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri());
const { attachRealtime } = await import('./realtime/hub.js');
const server = createApp().listen(env.PORT, () => console.log(`SpendMate API (in-memory DB) on :${env.PORT}`));
attachRealtime(server);
