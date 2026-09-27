import { selectPaginatedList, type PaginatedInfiniteData } from '../query-scope';

describe('selectPaginatedList', () => {
  it('flattens pages, keeps the first occurrence of an id and reads totalCount from page 1', () => {
    const data: PaginatedInfiniteData<{ id: string; label: string }> = {
      pageParams: [null, 'k1'],
      pages: [
        { items: [{ id: 'c', label: 'new' }, { id: 'b', label: 'first' }], nextCursor: 'k1', totalCount: 4 },
        { items: [{ id: 'b', label: 'repeated' }, { id: 'a', label: 'old' }], nextCursor: null, totalCount: 3 },
      ],
    };
    const list = selectPaginatedList(data);
    expect(list.items).toEqual([
      { id: 'c', label: 'new' },
      { id: 'b', label: 'first' },
      { id: 'a', label: 'old' },
    ]);
    expect(list.totalCount).toBe(4);
    expect(list.pages).toBe(data.pages);
  });
});
