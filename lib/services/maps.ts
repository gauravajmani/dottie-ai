import axios from 'axios';

export interface Location {
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

export interface DirectionsResult {
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  steps: Array<{
    instruction: string;
    distance: {
      text: string;
      value: number;
    };
    duration: {
      text: string;
      value: number;
    };
  }>;
}

export interface PlaceDetails {
  name: string;
  address: string;
  phoneNumber?: string;
  rating?: number;
  openingHours?: {
    isOpen: boolean;
    periods: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };
  website?: string;
  photos?: string[];
}

export class MapsService {
  private apiKey: string;
  private client: any;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY!;
    this.client = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api',
      params: {
        key: this.apiKey,
      },
    });
  }

  async geocode(address: string): Promise<Location> {
    try {
      const response = await this.client.get('/geocode/json', {
        params: {
          address,
        },
      });

      if (!response.data.results.length) {
        throw new Error('No results found');
      }

      const result = response.data.results[0];
      return {
        address: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId: result.place_id,
      };
    } catch (error) {
      console.error('Error geocoding address:', error);
      throw error;
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<Location> {
    try {
      const response = await this.client.get('/geocode/json', {
        params: {
          latlng: `${latitude},${longitude}`,
        },
      });

      if (!response.data.results.length) {
        throw new Error('No results found');
      }

      const result = response.data.results[0];
      return {
        address: result.formatted_address,
        latitude,
        longitude,
        placeId: result.place_id,
      };
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      throw error;
    }
  }

  async getDirections(
    origin: string | Location,
    destination: string | Location,
    options: {
      mode?: 'driving' | 'walking' | 'bicycling' | 'transit';
      alternatives?: boolean;
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      departureTime?: Date;
    } = {}
  ): Promise<DirectionsResult[]> {
    try {
      const originStr = typeof origin === 'string' ? origin : `${origin.latitude},${origin.longitude}`;
      const destStr = typeof destination === 'string' ? destination : `${destination.latitude},${destination.longitude}`;

      const response = await this.client.get('/directions/json', {
        params: {
          origin: originStr,
          destination: destStr,
          mode: options.mode || 'driving',
          alternatives: options.alternatives || false,
          avoid: [
            options.avoidTolls && 'tolls',
            options.avoidHighways && 'highways',
          ].filter(Boolean).join('|'),
          departure_time: options.departureTime?.getTime(),
        },
      });

      if (!response.data.routes.length) {
        throw new Error('No routes found');
      }

      return response.data.routes.map((route: any) => ({
        distance: route.legs[0].distance,
        duration: route.legs[0].duration,
        steps: route.legs[0].steps.map((step: any) => ({
          instruction: step.html_instructions,
          distance: step.distance,
          duration: step.duration,
        })),
      }));
    } catch (error) {
      console.error('Error getting directions:', error);
      throw error;
    }
  }

  async searchPlaces(
    query: string,
    options: {
      location?: Location;
      radius?: number; // meters
      type?: string;
      openNow?: boolean;
    } = {}
  ): Promise<PlaceDetails[]> {
    try {
      const response = await this.client.get('/place/textsearch/json', {
        params: {
          query,
          location: options.location && `${options.location.latitude},${options.location.longitude}`,
          radius: options.radius,
          type: options.type,
          opennow: options.openNow,
        },
      });

      return await Promise.all(
        response.data.results.map((place: any) => this.getPlaceDetails(place.place_id))
      );
    } catch (error) {
      console.error('Error searching places:', error);
      throw error;
    }
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    try {
      const response = await this.client.get('/place/details/json', {
        params: {
          place_id: placeId,
          fields: [
            'name',
            'formatted_address',
            'formatted_phone_number',
            'rating',
            'opening_hours',
            'website',
            'photos',
          ].join(','),
        },
      });

      const place = response.data.result;
      return {
        name: place.name,
        address: place.formatted_address,
        phoneNumber: place.formatted_phone_number,
        rating: place.rating,
        openingHours: place.opening_hours && {
          isOpen: place.opening_hours.open_now,
          periods: place.opening_hours.periods,
        },
        website: place.website,
        photos: place.photos?.map((photo: any) =>
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${this.apiKey}`
        ),
      };
    } catch (error) {
      console.error('Error getting place details:', error);
      throw error;
    }
  }

  async getDistanceMatrix(
    origins: Array<string | Location>,
    destinations: Array<string | Location>,
    options: {
      mode?: 'driving' | 'walking' | 'bicycling' | 'transit';
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      departureTime?: Date;
    } = {}
  ) {
    try {
      const originsStr = origins.map(o =>
        typeof o === 'string' ? o : `${o.latitude},${o.longitude}`
      );
      const destinationsStr = destinations.map(d =>
        typeof d === 'string' ? d : `${d.latitude},${d.longitude}`
      );

      const response = await this.client.get('/distancematrix/json', {
        params: {
          origins: originsStr.join('|'),
          destinations: destinationsStr.join('|'),
          mode: options.mode || 'driving',
          avoid: [
            options.avoidTolls && 'tolls',
            options.avoidHighways && 'highways',
          ].filter(Boolean).join('|'),
          departure_time: options.departureTime?.getTime(),
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error getting distance matrix:', error);
      throw error;
    }
  }
}