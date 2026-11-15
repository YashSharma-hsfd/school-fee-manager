/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isolate browser verification from the developer's running server and build files.
  distDir: process.env.NEXT_TEST_BUILD === "1" ? ".next-test" : ".next",
  // Optional single-worker builds for constrained local environments.
  ...(process.env.NEXT_BUILD_WORKERS === "1" ? { experimental: { cpus: 1 } } : {}),
};
export default nextConfig;
