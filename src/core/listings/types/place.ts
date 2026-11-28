// Written with the help of Claude

/** A point on the map. */
export interface Point {
  lat: number;
  lng: number;
}

/** How a point reads to a person: the building or the place there, and its address. */
export interface PlaceDescription {
  /** The place or the building, else the street and the house. */
  name: string;
  /** Street, house and district; may be empty. */
  address: string;
}

/** Where a listing's author suggests meeting (Д2.1): picked on the map, kept on the listing, not a catalog venue. */
export interface ListingPlace extends PlaceDescription {
  location: Point;
}
