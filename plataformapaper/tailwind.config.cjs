/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(17, 16, 35, 0.12)",
      },
    },
  },
  plugins: [],
};
