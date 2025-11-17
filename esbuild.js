const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`[ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

const copyTemplatesPlugin = {
	name: 'copy-templates',
	setup(build) {
		build.onEnd(() => {
			const srcTemplates = path.join(__dirname, 'src', 'prompt', 'templates');
			const distTemplates = path.join(__dirname, 'dist', 'templates');

			if (!fs.existsSync(distTemplates)) {
				fs.mkdirSync(distTemplates, { recursive: true });
			}

			if (fs.existsSync(srcTemplates)) {
				const files = fs.readdirSync(srcTemplates);
				files.forEach(file => {
					if (file.endsWith('.json')) {
						const srcFile = path.join(srcTemplates, file);
						const destFile = path.join(distTemplates, file);
						fs.copyFileSync(srcFile, destFile);
					}
				});
				console.log('[copy-templates] Templates copied to dist/templates');
			}
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			copyTemplatesPlugin,

			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
