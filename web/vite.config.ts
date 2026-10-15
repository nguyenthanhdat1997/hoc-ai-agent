import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // cho phép import mã nguồn Python từ ../agent-lab (hiển thị trong tab Code thực hành)
  server: { fs: { allow: [".."] } },
});
