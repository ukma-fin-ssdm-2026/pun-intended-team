// Written with the help of Claude
export interface PageRequest {
  limit: number;
  offset: number;
}

/** One page of a list; hasMore tells the client whether to ask for the next one. */
export interface Page<T> {
  items: T[];
  page: PageRequest & { hasMore: boolean };
}
