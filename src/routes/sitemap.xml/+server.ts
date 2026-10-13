import type { RequestHandler } from './$types';

const pages: { path: string; changefreq: string; priority: string }[] = [
	{ path: '/', changefreq: 'weekly', priority: '1.0' },
	{ path: '/login', changefreq: 'monthly', priority: '0.8' },
	{ path: '/privacy', changefreq: 'yearly', priority: '0.3' },
	{ path: '/accept-privacy', changefreq: 'yearly', priority: '0.1' }
];

export const GET: RequestHandler = ({ request }) => {
	const origin = new URL(request.url).origin;

	const urlset = pages
		.map(
			(page) =>
				`<url><loc>${origin}${page.path}</loc><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`
		)
		.join('\n');

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
			`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>\n`,
		{
			headers: {
				'content-type': 'application/xml; charset=utf-8'
			}
		}
	);
};
