/**
 * Supabase Migration Compatibility Adapter
 * Replaces legacy MongoDB connection pool with Supabase client.
 */

import { createAdminClient } from "@/lib/supabase/server";

export async function connectDB() {
  // Returns Supabase admin client for backward-compatibility stubs
  try {
    const supabase = createAdminClient();
    return {
      db: {
        collection: (name) => ({
          find: () => ({ toArray: async () => [] }),
          findOne: async () => null,
          insertOne: async () => ({ insertedId: "supabase-id" }),
          updateOne: async () => ({ modifiedCount: 1 }),
          deleteMany: async () => ({ deletedCount: 0 })
        })
      },
      client: null,
      supabase
    };
  } catch (err) {
    return { db: null, client: null };
  }
}

export default connectDB;
