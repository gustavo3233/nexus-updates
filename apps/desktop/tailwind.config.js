/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nexus: {
          primary: "#FF7A00",
          dark: "#E56600",
          ink: "#1F2937",
          muted: "#6B7280",
          border: "#E5E7EB",
          success: "#16A34A",
          error: "#EF4444",
          warning: "#F59E0B"
        }
      }
    }
  },
  plugins: []
};
