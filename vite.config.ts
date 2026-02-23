import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      // TEFAS CORS bypass (yalnızca geliştirme ortamı)
      '/proxy/tefas': {
        target: 'https://www.tefas.gov.tr',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/tefas/, '/api/DB'),
        secure: true,
        headers: {
          'Referer': 'https://www.tefas.gov.tr/',
          'Origin': 'https://www.tefas.gov.tr',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
        },
      },
      // Claude API proxy (yalnızca geliştirme ortamı)
      // x-api-key header'ı frontend'den otomatik geçer,
      // anthropic-version header'ı ise burada eklenir.
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: () => '/v1/messages',
        secure: true,
        headers: {
          'anthropic-version': '2023-06-01',
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
