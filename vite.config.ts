import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
	plugins: [viteSingleFile()],
	build: {
		assetsInlineLimit: 100000000, // Very large limit to force inline everything
		chunkSizeWarningLimit: 100000000,
	},
});
