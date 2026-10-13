// if im missing some please let me know!! ben@reefpresence.app
const classicsIds = [
	{ name: 'NES', id: '0100D870045B6000' },
	{ name: 'NES (JP)', id: '0100B4E00444C000' },
	{ name: 'SNES', id: '01008D300C50C000' },
	{ name: 'Game Boy / GBC', id: '0100C62011050000' },
	{ name: 'Game Boy / GBC (JP)', id: '0100395011044000' },
	{ name: 'Game Boy Advance', id: '010012F017576000' },
	{ name: 'Nintendo 64', id: '0100C9A00ECE6000' },
	{ name: 'Nintendo 64 Mature 17+', id: '0100E0601C632000' },
	{ name: 'Sega Genesis', id: '0100B3C014BDA000' },
	{ name: 'Virtual Boy', id: '0100BFC01D976000' },
	{ name: 'GameCube (Switch 2)', id: '040029A01D3E0000' }
] as const;

function isClassicId(id: string): boolean {
	return classicsIds.some((c) => c.id.toUpperCase() === id.trim().toUpperCase());
}

export { isClassicId, classicsIds };
