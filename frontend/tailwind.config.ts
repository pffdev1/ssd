import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./auth.ts"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#001534",
        panel: "#1e3a5f",
        mist: "#eaf6ff",
        accent: "#1f406b",
        line: "#bfd2e7",
        success: "#2f6f5c",
        warning: "#a86a3b"
      },
      boxShadow: {
        glass: "0 18px 45px rgba(0, 21, 52, 0.16)"
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(circle at 18% 20%, rgba(31, 64, 107, 0.2), transparent 34%), radial-gradient(circle at 82% 0%, rgba(234, 246, 255, 0.65), transparent 30%), linear-gradient(135deg, #001534 0%, #1e3a5f 54%, #1f406b 100%)"
      }
    }
  },
  plugins: []
};

export default config;
