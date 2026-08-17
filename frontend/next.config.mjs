/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg usa bindings nativos opcionales; que Next no intente empaquetarlo.
  serverExternalPackages: ['pg'],

  async headers() {
    return [
      {
        // Datos médicos: fuera de buscadores y de cachés intermedias.
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
