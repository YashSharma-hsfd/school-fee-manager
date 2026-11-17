const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];

export function localResetTarget(value, nodeEnv) {
  if (nodeEnv === "production") throw new Error("Local database reset is disabled in production.");
  let url;
  try { url = new URL(value); } catch { throw new Error("Set a valid local DATABASE_URL."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !loopbackHosts.includes(url.hostname)
    || (url.port && url.port !== "5432") || url.pathname !== "/school_fee_manager") {
    throw new Error("Reset is restricted to school_fee_manager on localhost:5432. No database was changed.");
  }
  const allowed = ["schema", "connection_limit", "pool_timeout", "connect_timeout", "sslmode"];
  if ([...url.searchParams.keys()].some(key => !allowed.includes(key))
    || [...url.searchParams.getAll("schema")].some(schema => schema !== "public")) {
    throw new Error("Reset requires the public schema and no connection-target overrides.");
  }
  return url.toString();
}

export async function readLocalResetIdentity(db) {
  // An inet-to-text cast includes /32 or /128. host() returns only the address.
  const [identity] = await db.$queryRaw`SELECT current_database() AS database,
    current_schema() AS schema, host(inet_server_addr()) AS address`;
  return identity;
}

export function assertLocalResetIdentity(identity) {
  if (identity.database !== "school_fee_manager") {
    throw new Error("Connected database name does not match school_fee_manager. No database was changed.");
  }
  if (identity.schema !== "public") {
    throw new Error("Connected schema is not public. No database was changed.");
  }
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(identity.address)) {
    throw new Error("Connected server address is not loopback. No database was changed.");
  }
}
