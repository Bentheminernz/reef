/**
 * Standalone webview generator for Nintendo game web services.
 * its based off Dycool/nso-webapp
 */

import {
	JSQR_CDN_URL,
	NOOKLINK_API_ORIGIN,
	NOOKLINK_DPL_ORIGIN,
	SMASH_WORLD_CDN_ORIGIN,
	SPLATNET3_API_ORIGIN,
	TRUSTED_NINTENDO_DOMAINS
} from '$lib/server/webviewDomains';

function isStrictNintendoOrigin(urlString: string): boolean {
	if (!urlString || typeof urlString !== 'string') return false;
	try {
		const parsed = new URL(urlString);
		if (parsed.protocol !== 'https:') return false;
		const hostname = parsed.hostname.toLowerCase();

		if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
		if (hostname.includes(':') || hostname.startsWith('[') || hostname.endsWith(']')) return false;
		if (
			hostname === 'localhost' ||
			hostname.endsWith('.localhost') ||
			hostname.endsWith('.local') ||
			hostname.endsWith('.internal')
		)
			return false;

		return TRUSTED_NINTENDO_DOMAINS.some(
			(domain) => hostname === domain || hostname.endsWith(`.${domain}`)
		);
	} catch {
		return false;
	}
}

function isOriginWhitelisted(targetOrigin: string, allowedOrigins: string[]): boolean {
	if (!isStrictNintendoOrigin(targetOrigin)) return false;
	if (allowedOrigins.includes(targetOrigin)) return true;

	try {
		const targetHost = new URL(targetOrigin).hostname.toLowerCase();
		for (const allowed of allowedOrigins) {
			let allowedHost = '';
			try {
				allowedHost = allowed.startsWith('http')
					? new URL(allowed).hostname.toLowerCase()
					: allowed.toLowerCase();
			} catch {
				allowedHost = allowed.replace(/^https?:\/\//i, '').toLowerCase();
			}

			if (allowedHost.startsWith('*.')) {
				const suffix = allowedHost.slice(2);
				if (targetHost === suffix || targetHost.endsWith('.' + suffix)) {
					return true;
				}
			} else if (allowedHost.startsWith('.')) {
				const suffix = allowedHost.slice(1);
				if (targetHost === suffix || targetHost.endsWith('.' + suffix)) {
					return true;
				}
			}
		}
	} catch {
		// Invalid origins are not eligible for proxying.
	}

	return false;
}

const SERVICE_QUIRKS_CSS: Record<string, string> = {
	'4834290508791808': `
        [class*="NavigationBar_exitButton"] { display: none !important; }
    `
};

function isZeldaNotesService(serviceId: string, serviceUri?: string): boolean {
	if (serviceId === '5935781783175168' || serviceId === '4974384874151936') return true;
	if (serviceUri) {
		const lower = serviceUri.toLowerCase();
		if (lower.includes('87abc152') || lower.includes('zelda') || lower.includes('znotes'))
			return true;
	}
	return false;
}

function isSplatNet3Service(serviceId: string, serviceUri?: string): boolean {
	if (serviceId === '4834290508791808') return true;
	if (serviceUri) {
		const lower = serviceUri.toLowerCase();
		if (lower.includes('av5ja') || lower.includes('usagi') || lower.includes('splatnet3'))
			return true;
	}
	return false;
}

function isSmashWorldService(serviceId: string, serviceUri?: string): boolean {
	if (serviceId === '5598642853249024' || serviceId === '5614999764533248') return true;
	if (serviceUri) {
		const lower = serviceUri.toLowerCase();
		if (lower.includes('smash') || lower.includes('aaaba') || lower.includes('smashbros'))
			return true;
	}
	return false;
}

function isSplatNet2Service(serviceId: string, serviceUri?: string): boolean {
	if (serviceId === '5741031244955648') return true;
	if (serviceUri) {
		const lower = serviceUri.toLowerCase();
		if (lower.includes('splatoon2.nintendo.net') || lower.includes('splatnet2')) return true;
	}
	return false;
}

function isNookLinkService(serviceId: string, serviceUri?: string): boolean {
	if (serviceId === '4953919198265344') return true;
	if (serviceUri) {
		const lower = serviceUri.toLowerCase();
		if (lower.includes('acbaa') || lower.includes('nooklink')) return true;
	}
	return false;
}

export function rewriteHtmlAssets(
	html: string,
	sessionId: string,
	serviceId: string,
	serviceUri: string | undefined,
	currentTargetUrl: string,
	allowedOrigins: string[]
): string {
	const currentOrigin = new URL(currentTargetUrl).origin;
	const proxyBase = `/api/nso/webview/${sessionId}/proxy`;

	function decodeHtmlEntities(value: string): string {
		return value
			.replace(/&amp;/gi, '&')
			.replace(/&#0*38;/g, '&')
			.replace(/&#x0*26;/gi, '&');
	}

	function toBrowserUrl(urlStr: string): string {
		if (!urlStr || typeof urlStr !== 'string') return urlStr;
		const trimmed = decodeHtmlEntities(urlStr).trim();
		if (
			trimmed.startsWith('/api/nso/webview/') ||
			trimmed.startsWith('data:') ||
			trimmed.startsWith('javascript:') ||
			trimmed.startsWith('#') ||
			trimmed.startsWith('mailto:') ||
			trimmed.startsWith('blob:') ||
			trimmed.startsWith('tel:')
		) {
			return urlStr;
		}

		try {
			let parsed: URL;
			if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
				parsed = new URL(trimmed);
			} else if (trimmed.startsWith('//')) {
				parsed = new URL('https:' + trimmed);
			} else if (trimmed.startsWith('/')) {
				parsed = new URL(trimmed, currentOrigin);
			} else {
				parsed = new URL(trimmed, currentTargetUrl);
			}

			const hostname = parsed.hostname.toLowerCase();
			const isStrictNintendo =
				hostname.endsWith('.srv.nintendo.net') ||
				hostname.endsWith('.nintendo.net') ||
				hostname.endsWith('.nintendo.com');

			if (isOriginWhitelisted(parsed.origin, allowedOrigins) || isStrictNintendo) {
				return `${proxyBase}?url=${encodeURIComponent(parsed.toString())}`;
			}
		} catch {
			// Preserve malformed or unsupported resource URLs unchanged.
		}

		return urlStr;
	}

	function toBrowserSrcSet(value: string): string {
		if (!value) return value;
		const candidates: string[] = [];
		let current = '';
		for (let i = 0; i < value.length; i++) {
			const ch = value[i];
			if (ch === ',' && !/^\s*data:/i.test(current)) {
				candidates.push(current);
				current = '';
			} else {
				current += ch;
			}
		}
		if (current.trim()) candidates.push(current);

		return candidates
			.map((candidate) => {
				const trimmed = candidate.trim();
				if (!trimmed) return candidate;
				const decoded = decodeHtmlEntities(trimmed);
				const spaceIndex = decoded.search(/\s/);
				const url = spaceIndex === -1 ? decoded : decoded.slice(0, spaceIndex);
				const descriptor = spaceIndex === -1 ? '' : decoded.slice(spaceIndex);
				if (/^(?:data:|blob:|#)/i.test(url)) return candidate;
				const proxied = toBrowserUrl(url);
				if (proxied === url) return candidate;
				return `${proxied}${descriptor}`;
			})
			.join(', ');
	}

	return html.replace(/<(script|link|img|source|video|audio|form|a)\b[^>]*>/gi, (tag) => {
		const out = tag.replace(
			/\b(src|srcset|href|action|poster)=(["'])([^"']+)\2/gi,
			(match, attr, quote, val) => {
				const name = attr.toLowerCase();
				if (
					name === 'href' &&
					(val.startsWith('#') ||
						val.startsWith('javascript:') ||
						val.startsWith('mailto:') ||
						val.startsWith('tel:'))
				) {
					return match;
				}
				if (name === 'srcset') {
					return `${attr}=${quote}${toBrowserSrcSet(val)}${quote}`;
				}
				return `${attr}=${quote}${toBrowserUrl(val)}${quote}`;
			}
		);

		return out;
	});
}

export function generateBridgeSnippet(
	sessionId: string,
	serviceId: string,
	currentTargetUrl: string,
	allowedOriginsList: string[]
): string {
	const jsonSessionId = JSON.stringify(sessionId);
	const jsonServiceId = JSON.stringify(serviceId);
	const currentOrigin = new URL(currentTargetUrl).origin;
	const jsonOrigin = JSON.stringify(currentOrigin);
	const jsonTargetUrl = JSON.stringify(currentTargetUrl);
	const jsonAllowedOrigins = JSON.stringify(allowedOriginsList);
	const customCss = SERVICE_QUIRKS_CSS[serviceId] ? SERVICE_QUIRKS_CSS[serviceId] : '';

	return `<script id="nso-znca-bridge">
(()=>{
const sessionId = ${jsonSessionId};
const serviceId = ${jsonServiceId};
const currentUpstreamOrigin = ${jsonOrigin};
const currentUpstreamUrl = ${jsonTargetUrl};
const allowedOrigins = ${jsonAllowedOrigins};
const proxyBase = '/api/nso/webview/' + sessionId + '/proxy';

if (${isSmashWorldService(serviceId, currentTargetUrl) || isNookLinkService(serviceId, currentTargetUrl) ? 'true' : 'false'}) {
    const NXAPI_WEBSERVICE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Safari/604.1';
    try {
        Object.defineProperty(Navigator.prototype, 'userAgent', {
            configurable: true,
            enumerable: true,
            get: function() { return NXAPI_WEBSERVICE_UA; }
        });
    } catch (e) {
        try {
            Object.defineProperty(navigator, 'userAgent', {
                configurable: true,
                enumerable: true,
                get: function() { return NXAPI_WEBSERVICE_UA; }
            });
        } catch(e2) {}
    }

    try { delete Navigator.prototype.userAgentData; } catch(e) {}
    try { delete navigator.userAgentData; } catch(e) {}
    if ('userAgentData' in navigator) {
        try {
            Object.defineProperty(Navigator.prototype, 'userAgentData', {
                configurable: true,
                enumerable: true,
                get: function() { return undefined; }
            });
        } catch(e) {
            try {
                Object.defineProperty(navigator, 'userAgentData', {
                    configurable: true,
                    enumerable: true,
                    get: function() { return undefined; }
                });
            } catch(e2) {}
        }
    }
}

if (${isSmashWorldService(serviceId, currentTargetUrl) ? 'true' : 'false'}) {
    try {
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', proxyBase + '?url=' + encodeURIComponent(currentUpstreamOrigin + '/'));
        }
    } catch(e) {}

    try {
        const origScriptSrcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
        if (origScriptSrcDesc && origScriptSrcDesc.set) {
            Object.defineProperty(HTMLScriptElement.prototype, 'src', {
                configurable: true,
                enumerable: true,
                get: function() { return origScriptSrcDesc.get.call(this); },
                set: function(val) {
                    return origScriptSrcDesc.set.call(this, toProxiedUrl(val));
                }
            });
        }

        const origLinkHrefDesc = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href');
        if (origLinkHrefDesc && origLinkHrefDesc.set) {
            Object.defineProperty(HTMLLinkElement.prototype, 'href', {
                configurable: true,
                enumerable: true,
                get: function() { return origLinkHrefDesc.get.call(this); },
                set: function(val) {
                    return origLinkHrefDesc.set.call(this, toProxiedUrl(val));
                }
            });
        }

        const origSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function(name, val) {
            const lower = String(name).toLowerCase();
            if (this.tagName === 'SCRIPT' && lower === 'src') {
                return origSetAttribute.call(this, name, toProxiedUrl(val));
            }
            if (this.tagName === 'LINK' && lower === 'href') {
                return origSetAttribute.call(this, name, toProxiedUrl(val));
            }
            return origSetAttribute.call(this, name, val);
        };
    } catch(e) {}
}

function isAllowedClientOrigin(origin) {
    try {
        const targetHost = new URL(origin).hostname.toLowerCase();
        for (const allowed of allowedOrigins) {
            let allowedHost = '';
            try {
                allowedHost = allowed.startsWith('http') ? new URL(allowed).hostname.toLowerCase() : String(allowed).toLowerCase();
            } catch(e) {
                allowedHost = String(allowed).toLowerCase();
                if (allowedHost.startsWith('https://')) allowedHost = allowedHost.slice(8);
                else if (allowedHost.startsWith('http://')) allowedHost = allowedHost.slice(7);
            }
            if (allowedHost.startsWith('*.')) {
                const suffix = allowedHost.slice(2);
                if (targetHost === suffix || targetHost.endsWith('.' + suffix)) return true;
            } else if (allowedHost.startsWith('.')) {
                const suffix = allowedHost.slice(1);
                if (targetHost === suffix || targetHost.endsWith('.' + suffix)) return true;
            } else if (targetHost === allowedHost) {
                return true;
            }
        }

        if (${isSmashWorldService(serviceId, currentTargetUrl) ? 'true' : 'false'} && origin === '${SMASH_WORLD_CDN_ORIGIN}') {
            return true;
        }

        if (${isSplatNet3Service(serviceId, currentTargetUrl) ? 'true' : 'false'} && origin === '${SPLATNET3_API_ORIGIN}') {
            return true;
        }

        if (${isNookLinkService(serviceId, currentTargetUrl) ? 'true' : 'false'} && (
            origin === '${NOOKLINK_API_ORIGIN}' ||
            origin === '${NOOKLINK_DPL_ORIGIN}'
        )) {
            return true;
        }
    } catch(e) {}
    return false;
}

function decodeHtmlEntities(rawUrl) {
    return rawUrl.replace(/&amp;/gi, '&').replace(/&#0*38;/g, '&').replace(/&#x0*26;/gi, '&');
}

function toProxiedUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
    if (rawUrl.startsWith('/api/nso/webview/') || /^(?:data|blob|javascript|mailto|tel):/i.test(rawUrl)) return rawUrl;
    const decodedUrl = decodeHtmlEntities(rawUrl);
    try {
        let parsed;
        if (decodedUrl.startsWith('http://') || decodedUrl.startsWith('https://')) {
            parsed = new URL(decodedUrl);
        } else if (decodedUrl.startsWith('//')) {
            parsed = new URL(location.protocol + decodedUrl);
        } else if (decodedUrl.startsWith('/')) {
            parsed = new URL(decodedUrl, currentUpstreamOrigin);
        } else {
            parsed = new URL(decodedUrl, currentUpstreamUrl);
        }

        if (${isNookLinkService(serviceId, currentTargetUrl) ? 'true' : 'false'} &&
            /^\\/api\\/sd\\/v1(?:\\/|$)/.test(parsed.pathname) &&
            (parsed.origin === location.origin ||
             (rawUrl.startsWith('/') && parsed.origin === '${NOOKLINK_DPL_ORIGIN}'))) {
            parsed = new URL(parsed.pathname + parsed.search + parsed.hash, '${NOOKLINK_API_ORIGIN}');
        }

        if (isAllowedClientOrigin(parsed.origin)) {
            return location.origin + proxyBase + '?url=' + encodeURIComponent(parsed.toString());
        }
    } catch(e) {}
    return rawUrl;
}

function toProxiedSrcSet(value) {
    if (!value || typeof value !== 'string') return value;
    const candidates = [];
    let current = '';
    for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        if (ch === ',' && !/^\\s*data:/i.test(current)) {
            candidates.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) candidates.push(current);

    return candidates.map((candidate) => {
        const trimmed = candidate.trim();
        if (!trimmed) return candidate;
        const decoded = decodeHtmlEntities(trimmed);
        const spaceIndex = decoded.search(/\\s/);
        const url = spaceIndex === -1 ? decoded : decoded.slice(0, spaceIndex);
        const descriptor = spaceIndex === -1 ? '' : decoded.slice(spaceIndex);
        if (/^(?:data:|blob:|#)/i.test(url)) return candidate;
        const proxied = toProxiedUrl(url);
        if (proxied === url) return candidate;
        return proxied + descriptor;
    }).join(', ');
}

try {
    const origSetAttributeResources = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, val) {
        const lower = String(name).toLowerCase();
        const tag = this.tagName || '';
        if ((lower === 'src' || lower === 'poster') && /^(?:IMG|SOURCE|VIDEO|AUDIO|TRACK)$/.test(tag)) {
            return origSetAttributeResources.call(this, name, toProxiedUrl(val));
        }
        if (lower === 'srcset' && /^(?:IMG|SOURCE)$/.test(tag)) {
            return origSetAttributeResources.call(this, name, toProxiedSrcSet(val));
        }
        return origSetAttributeResources.call(this, name, val);
    };

    const imageSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (imageSrcDesc && imageSrcDesc.set) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            configurable: true,
            enumerable: true,
            get: function() { return imageSrcDesc.get.call(this); },
            set: function(val) { return imageSrcDesc.set.call(this, toProxiedUrl(val)); }
        });
    }

    const imageSrcsetDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset');
    if (imageSrcsetDesc && imageSrcsetDesc.set) {
        Object.defineProperty(HTMLImageElement.prototype, 'srcset', {
            configurable: true,
            enumerable: true,
            get: function() { return imageSrcsetDesc.get.call(this); },
            set: function(val) { return imageSrcsetDesc.set.call(this, toProxiedSrcSet(val)); }
        });
    }

    for (const proto of [HTMLSourceElement.prototype, HTMLVideoElement.prototype, HTMLAudioElement.prototype]) {
        const srcDesc = Object.getOwnPropertyDescriptor(proto, 'src');
        if (srcDesc && srcDesc.set) {
            Object.defineProperty(proto, 'src', {
                configurable: true,
                enumerable: true,
                get: function() { return srcDesc.get.call(this); },
                set: function(val) { return srcDesc.set.call(this, toProxiedUrl(val)); }
            });
        }
        if (proto === HTMLSourceElement.prototype) {
            const srcsetDesc = Object.getOwnPropertyDescriptor(proto, 'srcset');
            if (srcsetDesc && srcsetDesc.set) {
                Object.defineProperty(proto, 'srcset', {
                    configurable: true,
                    enumerable: true,
                    get: function() { return srcsetDesc.get.call(this); },
                    set: function(val) { return srcsetDesc.set.call(this, toProxiedSrcSet(val)); }
                });
            }
        }
    }
} catch(e) {}

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
    try {
        if (typeof input === 'string') {
            return nativeFetch(toProxiedUrl(input), init);
        } else if (input instanceof Request) {
            return nativeFetch(new Request(toProxiedUrl(input.url), input), init);
        }
    } catch(e) {}
    return nativeFetch(input, init);
};

const nativeXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    try {
        return nativeXhrOpen.call(this, method, toProxiedUrl(String(url)), ...rest);
    } catch(e) {
        return nativeXhrOpen.call(this, method, url, ...rest);
    }
};

let requestCounter = 0;
const pendingCallbacks = new Map();

window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'NSO_RECEIVE_GAME_WEB_TOKEN') {
        const token = data.token || null;
        if (typeof window.znca?._private?.func_1d5e === 'function') {
            try { window.znca._private.func_1d5e(token); } catch(e) {}
        }
        if (typeof window.onGameWebTokenReceive === 'function') {
            try { window.onGameWebTokenReceive(token); } catch(e) {}
        }
        if (data.requestId && pendingCallbacks.has(data.requestId)) {
            const cb = pendingCallbacks.get(data.requestId);
            pendingCallbacks.delete(data.requestId);
            try { cb(token); } catch(e) {}
        }
    }
});

function postBridgeMessage(type, payload = {}) {
    try {
        window.parent.postMessage({ type, sessionId, serviceId, ...payload }, location.origin);
    } catch(e) {}
}

const TOURNAMENT_MANAGER_BROWSER_URL = 'https://c.nintendo.com/splatoon3-tournament';
const IS_SPLATNET3_WEBVIEW = ${isSplatNet3Service(serviceId, currentTargetUrl) ? 'true' : 'false'};
const nativeWindowOpen = typeof window.open === 'function' ? window.open.bind(window) : null;

function getTournamentManagerExternalUrl(rawUrl) {
    if (!rawUrl || !IS_SPLATNET3_WEBVIEW) return null;

    try {
        let candidate = new URL(String(rawUrl), currentUpstreamUrl);

        if (
            candidate.origin === location.origin &&
            candidate.pathname.includes('/api/nso/webview/') &&
            candidate.pathname.includes('/proxy')
        ) {
            const wrappedUrl = candidate.searchParams.get('url');
            if (wrappedUrl) candidate = new URL(wrappedUrl);
        }

        const hostname = candidate.hostname.toLowerCase();
        const path = candidate.pathname.toLowerCase();

        if (
            candidate.protocol === 'https:' &&
            hostname === 'c.nintendo.com' &&
            (path === '/splatoon3-tournament' || path.startsWith('/splatoon3-tournament/'))
        ) {
            return TOURNAMENT_MANAGER_BROWSER_URL;
        }
    } catch(e) {}

    return null;
}

function openTournamentManagerOutsideWebView(source) {
    if (!IS_SPLATNET3_WEBVIEW) return null;

    let opened = null;
    try {
        if (nativeWindowOpen) {
            opened = nativeWindowOpen(
                TOURNAMENT_MANAGER_BROWSER_URL,
                '_blank',
                'noopener,noreferrer'
            );
            if (opened) {
                try { opened.opener = null; } catch(e) {}
            }
        }
    } catch(e) {}

    if (!opened) {
        postBridgeMessage('NSO_OPEN_EXTERNAL_BROWSER', {
            url: TOURNAMENT_MANAGER_BROWSER_URL
        });
    }

    return opened;
}

if (IS_SPLATNET3_WEBVIEW) {
    try {
        if (window.navigation && typeof window.navigation.addEventListener === 'function') {
            window.navigation.addEventListener('navigate', (event) => {
                const destinationUrl =
                    event &&
                    event.destination &&
                    event.destination.url;

                if (!getTournamentManagerExternalUrl(destinationUrl)) return;
                if (event.cancelable) {
                    event.preventDefault();
                    openTournamentManagerOutsideWebView('navigation-api');

                    setTimeout(() => {
                        try {
                            const rootTarget = new URL('/', currentUpstreamUrl);
                            const rootProxy =
                                '/api/nso/webview/' +
                                encodeURIComponent(sessionId) +
                                '/proxy?url=' +
                                encodeURIComponent(rootTarget.toString());

                            window.location.replace(rootProxy);
                        } catch(e) {}
                    }, 0);
                }
            });
        }
    } catch(e) {}

    try {
        if (nativeWindowOpen) {
            window.open = function(url, target, features) {
                if (getTournamentManagerExternalUrl(url)) {
                    return openTournamentManagerOutsideWebView('window.open');
                }
                return nativeWindowOpen(url, target, features);
            };
        }
    } catch(e) {}
}

const api = {
    func_272e: function() {
        const reqId = 'req_' + (++requestCounter) + '_' + Date.now();
        postBridgeMessage('NSO_REQUEST_GAME_WEB_TOKEN', { requestId: reqId, isZelda: true });
    },
    func_2644: function(data) {
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            const pattern = String(parsed?.pattern ?? '0');

            if (navigator.vibrate) {
                if (pattern === '0') navigator.vibrate([15]);
                else if (pattern === '1') navigator.vibrate([15, 50, 15]);
                else if (pattern === '2') navigator.vibrate([40, 60, 40]);
            }
        } catch(e) {}
    },
    requestGameWebToken: function() {
        const reqId = 'req_' + (++requestCounter) + '_' + Date.now();
        postBridgeMessage('NSO_REQUEST_GAME_WEB_TOKEN', { requestId: reqId, isZelda: false });
    },
    restorePersistentData: function() {
        const key = 'nso_persist_' + serviceId;
        let val = '';
        if (${isZeldaNotesService(serviceId, currentTargetUrl) ? 'true' : 'false'}) {
            val = '';
        } else {
            val = localStorage.getItem(key);
            if (val === null || val === undefined) val = '';
        }

        let attempts = 0;
        const deliver = () => {
            let delivered = false;
            if (typeof window.onPersistentDataRestore === 'function') {
                try { window.onPersistentDataRestore.call(null, String(val ?? '')); delivered = true; } catch(e) {}
            }
            if (typeof window.znca?._private?.onPersistentDataRestore === 'function') {
                try { window.znca._private.onPersistentDataRestore(String(val ?? '')); delivered = true; } catch(e) {}
            }
            if (delivered) return;
            if (++attempts < 50) {
                setTimeout(deliver, 20);
            }
        };
        setTimeout(deliver, 0);
    },
    storePersistentData: function(val) {
        const key = 'nso_persist_' + serviceId;
        localStorage.setItem(key, String(val ?? ''));
        let attempts = 0;
        const deliver = () => {
            let delivered = false;
            if (typeof window.onPersistentDataStore === 'function') {
                try { window.onPersistentDataStore.call(null, ''); delivered = true; } catch(e) {}
            }
            if (typeof window.znca?._private?.onPersistentDataStore === 'function') {
                try { window.znca._private.onPersistentDataStore(''); delivered = true; } catch(e) {}
            }
            if (delivered) return;
            if (++attempts < 50) {
                setTimeout(deliver, 20);
            }
        };
        setTimeout(deliver, 0);
    },
    copyToClipboard: function(val) {
        if (navigator.clipboard) navigator.clipboard.writeText(String(val)).catch(()=>{});
        postBridgeMessage('NSO_COPY_TO_CLIPBOARD', { text: String(val) });
    },
    completeLoading: function() {
        postBridgeMessage('NSO_COMPLETE_LOADING');
    },
    closeWebView: function() {
        postBridgeMessage('NSO_CLOSE_WEBVIEW');
    },
    reloadExtension: function() {
        //
    },
    clearUnreadFlag: function() {
        postBridgeMessage('NSO_CLEAR_UNREAD');
    },
    openExternalBrowser: function(url) {
        try {
            const u = new URL(url);
            if (['http:', 'https:'].includes(u.protocol)) {
                postBridgeMessage('NSO_OPEN_EXTERNAL_BROWSER', { url: u.href });
                window.open(u.href, '_blank');
            }
        } catch(e) {}
    },
    invokeNativeShare: function(data) {
        try {
            const p = JSON.parse(data);
            if (navigator.share) navigator.share({ text: p.text || '', url: p.image_url || undefined }).catch(()=>{});
            postBridgeMessage('NSO_NATIVE_SHARE', p);
        } catch(e) {}
    },
    invokeNativeShareUrl: function(data) {
        try {
            const p = JSON.parse(data);
            if (navigator.share) navigator.share({ text: p.text || '', url: p.url || undefined }).catch(()=>{});
            postBridgeMessage('NSO_NATIVE_SHARE_URL', p);
        } catch(e) {}
    },
    downloadImages: function(imagesJson) {
        try {
            const list = JSON.parse(imagesJson);
            for (const item of (Array.isArray(list) ? list : [])) {
                const a = document.createElement('a');
                a.href = item;
                a.download = '';
                a.target = '_blank';
                a.click();
            }
        } catch(e) {}
    },
    sendMessage: function(data) {
        let msgType = '';
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            msgType = parsed?.type || '';
        } catch(e) {}
        postBridgeMessage('NSO_SEND_MESSAGE', { data });
    },
    openQRCodeReader: function(data) {
        postBridgeMessage('NSO_OPEN_QR_CODE_READER', { data });
    },
    closeQRCodeReader: function() {
        postBridgeMessage('NSO_CLOSE_QR_CODE_READER');
    },
    openQRCodeReaderFromPhotoLibrary: function(data) {
        postBridgeMessage('NSO_OPEN_QR_CODE_READER_FROM_PHOTO_LIBRARY', { data });

        if (!${isNookLinkService(serviceId, currentTargetUrl) ? 'true' : 'false'}) return;

        const previous = window.__nsoNookPhotoQrSession;
        if (previous && previous.input && previous.input.parentNode) {
            previous.closed = true;
            previous.input.parentNode.removeChild(previous.input);
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.setAttribute('aria-hidden', 'true');
        input.style.position = 'fixed';
        input.style.left = '-10000px';
        input.style.top = '-10000px';
        input.style.width = '1px';
        input.style.height = '1px';
        input.style.opacity = '0';

        const session = { input: input, closed: false };
        window.__nsoNookPhotoQrSession = session;

        const cleanup = () => {
            if (input.parentNode) input.parentNode.removeChild(input);
            if (window.__nsoNookPhotoQrSession === session) {
                window.__nsoNookPhotoQrSession = null;
            }
        };

        const getDecoder = () => {
            if (typeof window.jsQR === 'function') return Promise.resolve(window.jsQR);
            if (window.__nsoJsQrLoader) return window.__nsoJsQrLoader;

            window.__nsoJsQrLoader = new Promise((resolve, reject) => {
                const existing = document.getElementById('nso-jsqr-decoder');
                if (existing) {
                    existing.addEventListener('load', () => {
                        if (typeof window.jsQR === 'function') resolve(window.jsQR);
                        else reject(new Error('jsQR loaded without exposing window.jsQR'));
                    }, { once: true });
                    existing.addEventListener('error', () => reject(new Error('jsQR failed to load')), { once: true });
                    return;
                }

                const script = document.createElement('script');
                script.id = 'nso-jsqr-decoder';
                script.src = '${JSQR_CDN_URL}';
                script.referrerPolicy = 'no-referrer';
                script.onload = () => {
                    if (typeof window.jsQR === 'function') resolve(window.jsQR);
                    else reject(new Error('jsQR loaded without exposing window.jsQR'));
                };
                script.onerror = () => reject(new Error('jsQR failed to load'));
                (document.head || document.documentElement).appendChild(script);
            }).catch(err => {
                window.__nsoJsQrLoader = null;
                throw err;
            });

            return window.__nsoJsQrLoader;
        };

        const imageDataFromFile = async (file) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error('Canvas 2D context is unavailable');

            let source;
            let sourceWidth = 0;
            let sourceHeight = 0;
            let objectUrl = null;

            try {
                if (typeof createImageBitmap === 'function') {
                    source = await createImageBitmap(file);
                    sourceWidth = source.width;
                    sourceHeight = source.height;
                } else {
                    objectUrl = URL.createObjectURL(file);
                    source = await new Promise((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.onerror = () => reject(new Error('Selected image could not be decoded'));
                        img.src = objectUrl;
                    });
                    sourceWidth = source.naturalWidth || source.width;
                    sourceHeight = source.naturalHeight || source.height;
                }

                if (!sourceWidth || !sourceHeight) throw new Error('Selected image has invalid dimensions');

                const maxDimension = 3000;
                const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
                canvas.width = Math.max(1, Math.round(sourceWidth * scale));
                canvas.height = Math.max(1, Math.round(sourceHeight * scale));
                ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
                return ctx.getImageData(0, 0, canvas.width, canvas.height);
            } finally {
                if (source && typeof source.close === 'function') {
                    try { source.close(); } catch(e) {}
                }
                if (objectUrl) URL.revokeObjectURL(objectUrl);
            }
        };

        const bytesToBase64 = (bytes) => {
            let binary = '';
            const view = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
            const chunkSize = 0x8000;
            for (let i = 0; i < view.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, view.subarray(i, i + chunkSize));
            }
            return btoa(binary);
        };

        const getProSheetIndex = (bytes) => {
            if (!bytes || bytes.length !== 563) return null;
            const c0 = bytes[0];
            const c1 = bytes[1];
            const c2 = bytes[2];
            if (
                (c0 >> 4) === 3 &&
                (c1 >> 4) === 3 &&
                (c2 & 0x0f) === 4 &&
                bytes[3] === 0x02 &&
                bytes[4] === 0x1c
            ) {
                const index = c0 & 0x0f;
                return index >= 0 && index <= 3 ? index : null;
            }
            return null;
        };

        const waitForQrCallback = async () => {
            for (let i = 0; i < 100; i++) {
                if (typeof window.onQRCodeRead === 'function') return window.onQRCodeRead;
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            return null;
        };

        input.addEventListener('cancel', () => {
            cleanup();
        }, { once: true });

        input.addEventListener('change', async () => {
            const files = Array.from(input.files || []);
            if (!files.length) {
                cleanup();
                return;
            }

            try {
                const decoder = await getDecoder();
                const decoded = [];

                for (const file of files) {
                    if (session.closed) break;
                    const imageData = await imageDataFromFile(file);
                    const result = decoder(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: 'attemptBoth'
                    });
                    if (!result || !result.binaryData) {
                        throw new Error('No QR code found in selected image: ' + (file.name || 'unnamed image'));
                    }
                    const bytes = Uint8Array.from(result.binaryData);
                    decoded.push({
                        payload: bytesToBase64(bytes),
                        proSheetIndex: getProSheetIndex(bytes)
                    });
                }

                if (decoded.length > 1 && decoded.every(item => item.proSheetIndex !== null)) {
                    decoded.sort((a, b) => a.proSheetIndex - b.proSheetIndex);
                }

                const callback = await waitForQrCallback();
                if (!callback) throw new Error('NookLink did not register window.onQRCodeRead');

                for (const item of decoded) {
                    if (session.closed) break;
                    callback(item.payload);
                    await Promise.resolve();
                }
            } catch(err) {
                console.warn('[NookLinkBridge] photo-library QR decode failed', err);
                const callback = await waitForQrCallback();
                if (!session.closed && callback) {
                    try { callback(); } catch(e) {}
                }
            } finally {
                cleanup();
            }
        }, { once: true });

        (document.body || document.documentElement).appendChild(input);
        input.click();
    },
    closeQRCodeReaderFromPhotoLibrary: function() {
        const session = window.__nsoNookPhotoQrSession;
        if (session) {
            session.closed = true;
            if (session.input && session.input.parentNode) {
                session.input.parentNode.removeChild(session.input);
            }
            window.__nsoNookPhotoQrSession = null;
        }
        postBridgeMessage('NSO_CLOSE_QR_CODE_READER_FROM_PHOTO_LIBRARY');
    },
    openQRCodeReaderForCheckin: function(data) {
        if (!${isSplatNet3Service(serviceId, currentTargetUrl) ? 'true' : 'false'}) {
            return;
        }

        let options = {};
        try {
            options = typeof data === 'string' ? JSON.parse(data) : (data || {});
        } catch(e) {}

        const source = options && options.source === 'photo_library'
            ? 'photo_library'
            : 'camera';

        const previous = window.__nsoSplatNetCheckinQrSession;
        if (previous) {
            previous.closed = true;
            if (previous.input && previous.input.parentNode) {
                previous.input.parentNode.removeChild(previous.input);
            }
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = false;
        input.setAttribute('aria-hidden', 'true');

        if (source === 'camera') {
            input.setAttribute('capture', 'environment');
        }

        input.style.position = 'fixed';
        input.style.left = '-10000px';
        input.style.top = '-10000px';
        input.style.width = '1px';
        input.style.height = '1px';
        input.style.opacity = '0';

        const session = {
            input,
            source,
            closed: false,
            completed: false
        };
        window.__nsoSplatNetCheckinQrSession = session;

        const cleanup = () => {
            if (input.parentNode) input.parentNode.removeChild(input);
            if (window.__nsoSplatNetCheckinQrSession === session) {
                window.__nsoSplatNetCheckinQrSession = null;
            }
        };

        const waitForCallback = async () => {
            for (let i = 0; i < 200; i++) {
                if (typeof window.onQRCodeReadForCheckin === 'function') {
                    return window.onQRCodeReadForCheckin;
                }
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            return null;
        };

        const deliver = async (status, text) => {
            if (session.closed || session.completed) return false;

            const callback = await waitForCallback();
            if (!callback || session.closed || session.completed) {
                console.warn('[SplatNet3QR] onQRCodeReadForCheckin callback was not registered');
                return false;
            }

            session.completed = true;
            const result = JSON.stringify({
                status,
                text: status === 'SUCCEEDED' ? String(text || '') : null
            });

            try {
                callback.call(null, result);
                return true;
            } catch(err) {
                console.warn('[SplatNet3QR] callback failed', err);
                return false;
            }
        };

        const getDecoder = () => {
            if (typeof window.jsQR === 'function') return Promise.resolve(window.jsQR);
            if (window.__nsoJsQrLoader) return window.__nsoJsQrLoader;

            window.__nsoJsQrLoader = new Promise((resolve, reject) => {
                const existing = document.getElementById('nso-jsqr-decoder');
                if (existing) {
                    if (typeof window.jsQR === 'function') {
                        resolve(window.jsQR);
                        return;
                    }

                    existing.addEventListener('load', () => {
                        if (typeof window.jsQR === 'function') resolve(window.jsQR);
                        else reject(new Error('jsQR loaded without exposing window.jsQR'));
                    }, { once: true });
                    existing.addEventListener(
                        'error',
                        () => reject(new Error('jsQR failed to load')),
                        { once: true }
                    );
                    return;
                }

                const script = document.createElement('script');
                script.id = 'nso-jsqr-decoder';
                script.src = '${JSQR_CDN_URL}';
                script.referrerPolicy = 'no-referrer';
                script.onload = () => {
                    if (typeof window.jsQR === 'function') resolve(window.jsQR);
                    else reject(new Error('jsQR loaded without exposing window.jsQR'));
                };
                script.onerror = () => reject(new Error('jsQR failed to load'));
                (document.head || document.documentElement).appendChild(script);
            }).catch(err => {
                window.__nsoJsQrLoader = null;
                throw err;
            });

            return window.__nsoJsQrLoader;
        };

        const imageDataFromFile = async (file) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error('Canvas 2D context is unavailable');

            let sourceImage;
            let sourceWidth = 0;
            let sourceHeight = 0;
            let objectUrl = null;

            try {
                if (typeof createImageBitmap === 'function') {
                    sourceImage = await createImageBitmap(file);
                    sourceWidth = sourceImage.width;
                    sourceHeight = sourceImage.height;
                } else {
                    objectUrl = URL.createObjectURL(file);
                    sourceImage = await new Promise((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.onerror = () => reject(new Error('Selected image could not be decoded'));
                        img.src = objectUrl;
                    });
                    sourceWidth = sourceImage.naturalWidth || sourceImage.width;
                    sourceHeight = sourceImage.naturalHeight || sourceImage.height;
                }

                if (!sourceWidth || !sourceHeight) {
                    throw new Error('Selected image has invalid dimensions');
                }

                const maxDimension = 3000;
                const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
                canvas.width = Math.max(1, Math.round(sourceWidth * scale));
                canvas.height = Math.max(1, Math.round(sourceHeight * scale));
                ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

                return ctx.getImageData(0, 0, canvas.width, canvas.height);
            } finally {
                if (sourceImage && typeof sourceImage.close === 'function') {
                    try { sourceImage.close(); } catch(e) {}
                }
                if (objectUrl) URL.revokeObjectURL(objectUrl);
            }
        };

        const bytesToBase64 = (bytes) => {
            let binary = '';
            const view = bytes instanceof Uint8Array
                ? bytes
                : Uint8Array.from(bytes || []);
            const chunkSize = 0x8000;

            for (let i = 0; i < view.length; i += chunkSize) {
                binary += String.fromCharCode.apply(
                    null,
                    view.subarray(i, i + chunkSize)
                );
            }

            return btoa(binary);
        };

        input.addEventListener('cancel', async () => {
            try {
                await deliver('CANCELLED', null);
            } finally {
                cleanup();
            }
        }, { once: true });

        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];

            if (!file) {
                try {
                    await deliver('CANCELLED', null);
                } finally {
                    cleanup();
                }
                return;
            }

            try {
                const decoder = await getDecoder();
                if (session.closed) return;

                const imageData = await imageDataFromFile(file);
                if (session.closed) return;

                const result = decoder(
                    imageData.data,
                    imageData.width,
                    imageData.height,
                    { inversionAttempts: 'attemptBoth' }
                );

                if (!result || !result.binaryData || !result.binaryData.length) {
                    throw new Error('No QR code found in selected image');
                }

                const payload = bytesToBase64(
                    Uint8Array.from(result.binaryData)
                );

                await deliver('SUCCEEDED', payload);
            } catch(err) {
                console.warn('[SplatNet3QR] QR decode failed', err);
                await deliver('ERROR', null);
            } finally {
                cleanup();
            }
        }, { once: true });

        (document.body || document.documentElement).appendChild(input);

        try {
            input.click();
        } catch(err) {
            console.warn('[SplatNet3QR] picker could not be opened', err);
            deliver('ERROR', null).finally(cleanup);
        }
    }
};

window.jsBridge = api;
Object.assign(window, api);

const IS_NOOKLINK_READY_SERVICE = ${isNookLinkService(serviceId, currentTargetUrl) ? 'true' : 'false'};
const IS_SPLATNET2_READY_SERVICE = ${isSplatNet2Service(serviceId, currentTargetUrl) ? 'true' : 'false'};
const IS_SMASH_READY_SERVICE = ${isSmashWorldService(serviceId, currentTargetUrl) ? 'true' : 'false'};
let nsoServiceReadySent = false;

function signalNsoServiceReady(source) {
    if (nsoServiceReadySent) return;
    nsoServiceReadySent = true;
    postBridgeMessage('NSO_COMPLETE_LOADING', { source: source || 'service-ready' });
}

function onNsoDomReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
        queueMicrotask(callback);
    }
}

if (IS_NOOKLINK_READY_SERVICE) {
    window.addEventListener('error', (e) => {
        console.warn('[NookLinkJsError]', {
            message: e.message,
            script: e.filename ? new URL(e.filename, location.href).pathname : 'inline',
            line: e.lineno,
            column: e.colno,
            errorName: e.error ? e.error.name : 'Error'
        });
    });
    window.addEventListener('unhandledrejection', (e) => {
        console.warn('[NookLinkUnhandledRejection]', { reason: String(e.reason) });
    });
    onNsoDomReady(() => {
        signalNsoServiceReady('nooklink-domcontentloaded');
    });
}

if (IS_SPLATNET2_READY_SERVICE) {
    onNsoDomReady(() => {
        let upstreamPath = '';
        try { upstreamPath = new URL(currentUpstreamUrl).pathname; } catch(e) {}
        if (upstreamPath === '/home' || upstreamPath.startsWith('/home/')) {
            signalNsoServiceReady('splatnet2-home-domcontentloaded');
        }
    });
}

if (IS_SMASH_READY_SERVICE) {
    onNsoDomReady(() => {
        let observer = null;
        const checkSmashReady = () => {
            if (nsoServiceReadySent) {
                try { observer?.disconnect(); } catch(e) {}
                return true;
            }
            const root = document.getElementById('content') || document.getElementById('root') || document.getElementById('app');
            if (!root || root.children.length === 0) return false;
            const textLength = String(root.innerText || '').trim().length;
            const hasInteractiveUi = Boolean(root.querySelector('img,button,a,nav,main,section,article,[role="button"],[role="link"]'));
            if (textLength < 8 && !hasInteractiveUi) return false;
            signalNsoServiceReady('smash-react-rendered');
            try { observer?.disconnect(); } catch(e) {}
            return true;
        };

        if (!checkSmashReady() && typeof MutationObserver === 'function') {
            observer = new MutationObserver(checkSmashReady);
            observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
            setTimeout(checkSmashReady, 250);
            setTimeout(checkSmashReady, 750);
            setTimeout(checkSmashReady, 1500);
        }
    });
}

const baseReset = 'html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }';
const combinedCss = baseReset + (${JSON.stringify(customCss)} ? ' ' + ${JSON.stringify(customCss)} : '');
const s = document.createElement('style');
s.textContent = combinedCss;
document.head ? document.head.appendChild(s) : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
})();
</script>`;
}

export interface WebviewHtmlOptions {
	sessionId: string;
	serviceId: string;
	serviceUri?: string;
	currentTargetUrl: string;
	allowedOrigins: string[];
	initialHtml?: string;
	fragment?: boolean;
}

const MINIMAL_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<div id="app"></div>
</body>
</html>
`;

export function buildWebviewHtml(options: WebviewHtmlOptions): string {
	const {
		sessionId,
		serviceId,
		serviceUri,
		currentTargetUrl,
		allowedOrigins,
		initialHtml,
		fragment
	} = options;

	const source =
		initialHtml !== undefined && initialHtml !== null && initialHtml.length > 0
			? initialHtml.replace(/<!--[\s\S]*?-->/g, '')
			: MINIMAL_SHELL;

	const rewritten = rewriteHtmlAssets(
		source,
		sessionId,
		serviceId,
		serviceUri,
		currentTargetUrl,
		allowedOrigins
	);
	const bridge = generateBridgeSnippet(sessionId, serviceId, currentTargetUrl, allowedOrigins);

	if (fragment) {
		return injectBridge(rewritten, bridge);
	}

	const headMatch = rewritten.match(/<head[^>]*>/i);
	if (headMatch) {
		return rewritten.replace(/<head[^>]*>/i, (match) => `${match}\n${bridge}`);
	}
	return `${bridge}\n${rewritten}`;
}

function injectBridge(html: string, bridge: string): string {
	const headMatch = html.match(/<head[^>]*>/i);
	if (headMatch && html.includes('<!DOCTYPE', 0)) {
		return html.replace(/<head[^>]*>/i, (match) => `${match}\n${bridge}`);
	}
	return `${bridge}\n${html}`;
}
