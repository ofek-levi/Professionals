import { DEFAULT_TILE_URL, OSM_ATTRIBUTION, resolveMapTiles } from '../map-tiles';

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

  it('rejects templates that are not https or miss a coordinate', () => {
    for (const url of ['http://tiles.example.com/{z}/{x}/{y}.png', 'https://tiles.example.com/{z}/{x}.png', 'javascript:alert(1)//{z}{x}{y}', 'https://x/{z}/{x}/{y}"<']) {
      expect(resolveMapTiles({ url }).urlTemplate).toBe(DEFAULT_TILE_URL);
    }
  });
});
