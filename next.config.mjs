/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@supabase/ssr", "@supabase/supabase-js"],
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: false,
      },
      {
        source: "/dashboard/:path*",
        destination: "/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
