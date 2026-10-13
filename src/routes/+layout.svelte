<script lang="ts">
	import './layout.css';
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.png';
	import appleTouchIcon from '$lib/assets/apple-touch-icon.png';

	let { children } = $props();

	const meta = $derived($page.data.meta);
	const title = $derived(meta?.title ?? 'Reef');
	const description = $derived(
		meta?.description ?? 'Share your Nintendo Switch presence on Discord with Reef.'
	);
	const canonical = $derived(new URL($page.url.pathname, $page.url).href);
	const ogImage = $derived(new URL(appleTouchIcon, $page.url.origin).href);
	const websiteJsonHtml = $derived(
		`<script type="application/ld+json">${JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: 'Reef',
			url: `${$page.url.origin}/`
		})}` +
			'</scr' +
			'ipt>'
	);
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="128x128" href={favicon} />
	<link rel="apple-touch-icon" sizes="180x180" href={appleTouchIcon} />

	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Reef" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={ogImage} />

	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>
<main class="container mx-auto p-4">
	{@render children()}
</main>
<!-- Structured data works anywhere in the document (svelte:head escapes markup).
     The content is generated from our own schema object, never user input. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -->
{@html websiteJsonHtml}
