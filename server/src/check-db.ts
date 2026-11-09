// Verifies MONGODB_URI works. Prints the database name and collection count, never the connection string.
import mongoose from 'mongoose';
import { env } from './config/env.js';

try {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db!;
  await db.command({ ping: 1 });
  const cols = await db.listCollections().toArray();
  console.log(`Connected to database "${db.databaseName}" (${cols.length} collections).`);
  await mongoose.disconnect();
} catch (e) {
  const m = e instanceof Error ? e.message : String(e);
  console.error('Could not connect:', m.replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri hidden>'));
  process.exit(1);
}
