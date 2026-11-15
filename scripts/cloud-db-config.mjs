// Separate cloud credentials keep local .env and disposable test databases independent.
export function cloudDatabaseConfig(environment) {
  const runtime = parseConnection(environment.CLOUD_DATABASE_URL);
  const direct = parseConnection(environment.CLOUD_DIRECT_URL);
  if (!runtime.hostname.includes("-pooler.") || direct.hostname.includes("-pooler.")) {
    throw new Error("Use the pooled Neon URL for CLOUD_DATABASE_URL and the unpooled URL for CLOUD_DIRECT_URL.");
  }
  if (runtime.hostname.replace("-pooler.", ".") !== direct.hostname || runtime.pathname !== direct.pathname) {
    throw new Error("Both cloud URLs must target the same Neon endpoint and database.");
  }
  return { runtimeUrl: runtime.href, directUrl: direct.href, target: `${direct.hostname}${direct.pathname}` };
}

function parseConnection(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Set CLOUD_DATABASE_URL and CLOUD_DIRECT_URL in .env.cloud.local. Keep credentials out of chat and Git.");
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid cloud connection URL. Copy it again from Neon; credentials were not printed."); }
  if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.username || !url.password || url.pathname.length < 2 || url.hash) {
    throw new Error("Cloud URLs must be complete PostgreSQL connection strings, including credentials and database name.");
  }
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.neon\.tech$/i.test(url.hostname)) {
    throw new Error("These pilot commands accept Neon database hosts only. They never target localhost or another provider.");
  }
  if (!["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode"))) {
    throw new Error("Cloud database connections must enable TLS with sslmode=require or certificate verification.");
  }
  return url;
}

export function cloudMigrationEnvironment(environment, config) {
  // Pin every supported CLI URL to the selected direct target, even if inherited
  // shell variables or a future Prisma configuration define another connection.
  return { ...environment, DATABASE_URL: config.directUrl, DIRECT_URL: config.directUrl, DATABASE_URL_UNPOOLED: config.directUrl };
}
