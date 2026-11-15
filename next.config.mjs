/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isolate browser verification from the developer's running server and build files.
  distDir: process.env.NEXT_TEST_BUILD === "1" ? ".next-test" : ".next",
};
export default nextConfig;
