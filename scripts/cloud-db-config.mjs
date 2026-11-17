// Separate cloud credentials keep local .env and disposable test databases independent.
export function cloudDatabaseConfig(environment) {
  const runtime = parseConnection(environment.CLOUD_DATABASE_URL);
  const direct = parseConnection(environment.CLOUD_DIRECT_URL);
  const ref = environment.CLOUD_PROJECT_REF;
  if (typeof ref !== "string" || !/^[a-z0-9]{10,64}$/.test(ref)) throw new Error("Set CLOUD_PROJECT_REF to your Supabase project reference.");
  const pooler = (url) => /^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && decodeURIComponent(url.username).endsWith(`.${ref}`);
  if (!pooler(runtime) || !["5432", "6543"].includes(runtime.port)) throw new Error("Use this Supabase project's session or transaction pooler for CLOUD_DATABASE_URL.");
  if (runtime.port === "6543" && runtime.searchParams.get("pgbouncer") !== "true") throw new Error("Transaction pooling requires pgbouncer=true for Prisma.");
  const session = pooler(direct) && direct.port === "5432" && direct.hostname === runtime.hostname;
  const endpoint = direct.hostname === `db.${ref}.supabase.co` && (!direct.port || direct.port === "5432");
  if ((!session && !endpoint) || direct.searchParams.get("pgbouncer") === "true" || runtime.pathname !== direct.pathname) throw new Error("Migrations require the same project's direct endpoint or session pooler on port 5432.");
  return { runtimeUrl: runtime.href, directUrl: direct.href, target: `${direct.hostname}${direct.pathname}` };
}

function parseConnection(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Set CLOUD_DATABASE_URL and CLOUD_DIRECT_URL in .env.cloud.local. Keep credentials out of chat and Git.");
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid cloud connection URL. Copy it again from Supabase; credentials were not printed."); }
  if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.username || !url.password || url.pathname.length < 2 || url.hash) {
    throw new Error("Cloud URLs must be complete PostgreSQL connection strings, including credentials and database name.");
  }
  if (!/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && !/^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname)) {
    throw new Error("These pilot commands accept Supabase database hosts only.");
  }
  for (const key of url.searchParams.keys()) {
    if (url.searchParams.getAll(key).length > 1 || ["host", "hostaddr", "port", "options", "service"].includes(key)) throw new Error("Remove duplicate parameters and connection overrides from cloud URLs.");
  }
  if (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public") throw new Error("This application uses the public schema.");
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
