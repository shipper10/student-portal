/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  // Belt-and-braces: lib/courses.js builds class names into objects that are
  // then spread into template strings elsewhere, which Tailwind's static
  // scanner can usually still find once lib/ is in `content` above — but
  // safelisting them explicitly guarantees a color never silently
  // disappears from a production build again.
  safelist: [
    "border-red-500", "border-purple-500", "border-green-500", "border-amber-500",
    "bg-red-100", "text-red-800", "dark:bg-red-900/40", "dark:text-red-300",
    "bg-purple-100", "text-purple-800", "dark:bg-purple-900/40", "dark:text-purple-300",
    "bg-green-100", "text-green-800", "dark:bg-green-900/40", "dark:text-green-300",
    "bg-amber-100", "text-amber-800", "dark:bg-amber-900/40", "dark:text-amber-300",
    "bg-gray-100", "text-gray-600", "dark:bg-gray-800", "dark:text-gray-400",
    "bg-green-500", "bg-teal-500", "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-red-500", "bg-gray-400",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
