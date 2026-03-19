// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	base: '/proxmark3-web-client/docs',
	integrations: [
		starlight({
			title: 'Proxmark3 Web Client',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/ahzs645/proxmark3-web-client' }],
			customCss: [],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Connecting Your Device', slug: 'getting-started/connecting' },
					],
				},
				{
					label: 'Features',
					items: [
						{ label: 'HF - Mifare Classic', slug: 'features/mifare-classic' },
						{ label: 'HF - Magic Cards', slug: 'features/magic-cards' },
						{ label: 'LF Operations', slug: 'features/lf-operations' },
						{ label: 'Traffic Capture', slug: 'features/traffic-capture' },
						{ label: 'Memory Editor', slug: 'features/memory-editor' },
						{ label: 'Terminal', slug: 'features/terminal' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'Overview', slug: 'architecture/overview' },
						{ label: 'Transport Layer', slug: 'architecture/transport' },
						{ label: 'WASM Backend', slug: 'architecture/wasm' },
					],
				},
				{
					label: 'Desktop App',
					items: [
						{ label: 'Tauri Setup', slug: 'desktop/tauri' },
						{ label: 'Bluetooth Support', slug: 'desktop/bluetooth' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
