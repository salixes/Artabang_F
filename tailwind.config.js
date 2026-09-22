/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "forest-deep": "#14532D",
        forest: "#1F6B3E",
        "forest-soft": "#2F6B45",
        sage: "#7FA684",
        "sage-pale": "#DCE9DD",
        gold: "#C89B3C",
        "gold-light": "#E8C77A",
        soil: "#6B4423",
        cream: "#F7F4EC",
        "cream-2": "#EFEADD",
        ink: "#1C2A20",
        "ink-soft": "#51604F",
        pending: "#E8934A",
        progress: "#3B82C4",
        resolved: "#2F6B45",
        danger: "#C24444",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Work Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        lg2: "22px",
        md2: "14px",
        sm2: "9px",
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(20,83,45,.18)",
        lift: "0 18px 40px -14px rgba(20,83,45,.28)",
      },
    },
  },
  plugins: [],
};
