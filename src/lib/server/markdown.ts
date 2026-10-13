import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export async function renderMarkdown(content: string | null | undefined) {
	if (!content) {
		return '';
	}

	return sanitizeHtml(await marked.parse(content), {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
		allowedSchemesByTag: { img: ['http', 'https'] },
		transformTags: {
			a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
			img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' })
		}
	});
}
