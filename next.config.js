/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "26mb", // allow homework uploads up to 25 MB
    },
  },
};

module.exports = nextConfig;
