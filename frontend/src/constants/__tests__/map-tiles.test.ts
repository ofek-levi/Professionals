import { buildTileUrl, DEFAULT_TILE_URL, OSM_ATTRIBUTION, resolveMapTiles } from '../map-tiles';

describe('resolveMapTiles', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to OpenStreetMap with its licence credit', () => {
    expect(resolveMapTiles({})).toEqual({ urlTemplate: DEFAULT_TILE_URL, maxZoom: 19, attribution: OSM_ATTRIBUTION });
  });

  it('uses a custom https template and plain-text credit', () => {
    expect(resolveMapTiles({ url: ' https://tiles.example.com/{z}/{x}/{y}@2x.png ', attribution: '© Example\nMaps' })).toEqual({
      urlTemplate: 'https://tiles.example.com/{z}/{x}/{y}@2x.png',
      maxZoom: 19,
      attribution: { text: '© Example Maps', href: null },
    });
  });

  it('keeps the OpenStreetMap credit when only the URL changes', () => {
    expect(resolveMapTiles({ url: 'https://osm.example.com/{z}/{x}/{y}.png' }).attribution).toEqual(OSM_ATTRIBUTION);
  });

  it('never replaces the OpenStreetMap credit while OpenStreetMap tiles are shown', () => {
    // A credit without a URL, or with a URL that falls back to OpenStreetMap.
    for (const url of [undefined, 'http://tiles.example.com/{z}/{x}/{y}.png']) {
      expect(resolveMapTiles({ url, attribution: '© Example Maps' })).toEqual({ urlTemplate: DEFAULT_TILE_URL, maxZoom: 19, attribution: OSM_ATTRIBUTION });
    }
  });

  it('rejects templates that are not https, miss a coordinate or use placeholders the map cannot fill', () => {
    for (const url of [
      'http://tiles.example.com/{z}/{x}/{y}.png',
      'https://tiles.example.com/{z}/{x}.png',
      'javascript:alert(1)//{z}{x}{y}',
      'https://x/{z}/{x}/{y}"<',
      'https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey={apikey}',
      'https://api.example.com/{z}/{x}/{y}?access_token={accessToken}',
      'https://tiles.example.com/{ z }/{x}/{y}.png',
      'https://tiles.example.com/{z}/{x}/{y}.png?v={',
    ]) {
      expect(resolveMapTiles({ url }).urlTemplate).toBe(DEFAULT_TILE_URL);
    }
  });

  it('accepts every placeholder Leaflet fills', () => {
    const url = 'https://{s}.tiles.example.com/{z}/{x}/{-y}{r}.png?key=abc123';
    expect(resolveMapTiles({ url }).urlTemplate).toBe(url);
  });
});

describe('buildTileUrl', () => {
  it('fills the template like Leaflet', () => {
    expect(buildTileUrl(DEFAULT_TILE_URL, { z: 12, x: 2446, y: 1662 }, false)).toBe('https://tile.openstreetmap.org/12/2446/1662.png');
    // {s} rotates a/b/c by x + y; {r} is @2x on high-density screens; {-y} counts rows from the south.
    expect(buildTileUrl('https://{s}.example.com/{z}/{x}/{-y}{r}.png', { z: 2, x: 1, y: 0 }, true)).toBe('https://b.example.com/2/1/3@2x.png');
  });
});
