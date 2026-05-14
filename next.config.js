/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/solve": ["./public/dictionary.txt"],
  },
};

module.exports = nextConfig;
