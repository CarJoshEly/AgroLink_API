import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponses, ApiOkResponseData, Public } from '../common/decorators';
import { GoogleMapsService } from '../google-maps';
import { LocationsService } from './locations.service';
import {
  CalculateDistanceDto,
  GeocodeAddressDto,
  ListMunicipalitiesQueryDto,
  NearbySellersQueryDto,
  ReverseGeocodeDto,
} from './dto';

@ApiTags('Locations')
@ApiCommonErrorResponses()
@Controller('locations')
export class LocationsController {
  constructor(
    private readonly locationsService: LocationsService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  @Public()
  @Get('departments')
  @ApiOperation({ summary: 'Listar departamentos de Honduras' })
  @ApiOkResponseData()
  listDepartments() {
    return this.locationsService.listDepartments();
  }

  @Public()
  @Get('municipalities')
  @ApiOperation({ summary: 'Listar municipios (opcionalmente filtrados por departamento)' })
  @ApiOkResponseData()
  listMunicipalities(@Query() query: ListMunicipalitiesQueryDto) {
    return this.locationsService.listMunicipalities(query.departmentId);
  }

  @Public()
  @Get('sellers/nearby')
  @ApiOperation({ summary: 'Buscar vendedores verificados cercanos a una coordenada' })
  @ApiOkResponseData()
  findNearbySellers(@Query() query: NearbySellersQueryDto) {
    return this.locationsService.findNearbySellers(query);
  }

  @Post('distance')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Calcular la distancia (línea recta) entre dos coordenadas' })
  @ApiOkResponseData()
  calculateDistance(@Body() dto: CalculateDistanceDto) {
    return this.locationsService.calculateDistanceKm(dto);
  }

  @Post('geocode')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Convertir una dirección en coordenadas (Google Maps)' })
  @ApiOkResponseData()
  geocode(@Body() dto: GeocodeAddressDto) {
    return this.googleMapsService.geocodeAddress(dto.address);
  }

  @Post('reverse-geocode')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Convertir coordenadas en una dirección legible (Google Maps)' })
  @ApiOkResponseData()
  reverseGeocode(@Body() dto: ReverseGeocodeDto) {
    return this.googleMapsService.reverseGeocode(dto.latitude, dto.longitude);
  }
}
