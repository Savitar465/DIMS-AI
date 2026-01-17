export class PaginatedResource<T> {
  totalItems: number;
  items: T[];
  page: number;
  size: number;

  constructor(props:{totalItems: number, items: T[], page: number, size: number}) {
    this.totalItems = props.totalItems;
    this.items = props.items;
    this.page = props.page;
    this.size = props.size;
  }
}