/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta de referência do CRM: cabeçalhos de etapa em azul-marinho,
        // cards brancos, alertas em vermelho/amarelo/azul/verde.
        navy: {
          50: "#eef1f7",
          100: "#d3daea",
          200: "#a7b5d5",
          300: "#7b90c0",
          400: "#4f6bab",
          500: "#2f4a86",
          600: "#1f3566", // cabeçalho de etapa
          700: "#182a52",
          800: "#11203e",
          900: "#0a152a",
        },
        alert: {
          overdue: "#dc2626", // vermelho — atrasado
          today: "#d97706", // amarelo/âmbar — vence hoje
          upcoming: "#2563eb", // azul — futuro
          done: "#16a34a", // verde — concluído
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      // Tokens de espaçamento/raio/sombra do redesign visual — usados para
      // manter consistência entre cards, colunas do funil e superfícies.
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgb(15 23 42 / 0.04)",
        card: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)",
        raised: "0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
};
