/** `GET /geo/search?q=` and `GET /geo/reverse?lat=&lng=` */
export interface PlaceSearchParams {
  query: string;
  limit?: number;
}

export interface ReverseGeocodeParams {
  latitude: number;
  longitude: number;
}
