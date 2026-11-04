/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
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
