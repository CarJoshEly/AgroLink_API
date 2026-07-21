import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type GeocodeResult = { latitude: number; longitude: number; formattedAddress: string };
type ReverseGeocodeResult = { formattedAddress: string };

/** Respuesta mínima de la Geocoding API que realmente usamos. */
interface GoogleGeocodeResponse {
  status: string;
  results: {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
  }[];
}

@Injectable()
export class GoogleMapsService {
  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.configService.get<string>('googleMaps.apiKey');
  }

  private ensureConfigured(): string {
    const key = this.apiKey;
    if (!key) {
      throw new ServiceUnavailableException(
        'La integración con Google Maps no está configurada (falta GOOGLE_MAPS_API_KEY)',
      );
    }
    return key;
  }

  async geocodeAddress(address: string): Promise<GeocodeResult> {
    const key = this.ensureConfigured();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const data = await this.fetchGeocode(url);

    const result = data.results[0];
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    };
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    const key = this.ensureConfigured();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${key}`;
    const data = await this.fetchGeocode(url);

    return { formattedAddress: data.results[0].formatted_address };
  }

  private async fetchGeocode(url: string): Promise<GoogleGeocodeResponse> {
    const response = await fetch(url);
    const data = (await response.json()) as GoogleGeocodeResponse;

    if (data.status !== 'OK' || !data.results?.length) {
      throw new BadRequestException(
        `No se pudo resolver la ubicación con Google Maps (status: ${data.status})`,
      );
    }
    return data;
  }
}
