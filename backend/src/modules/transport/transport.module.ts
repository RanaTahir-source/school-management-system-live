import { Module } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { RouteStopsService } from './route-stops.service';
import { RouteStopsController } from './route-stops.controller';
import { StudentTransportService } from './student-transport.service';
import { StudentTransportController } from './student-transport.controller';

@Module({
  controllers: [
    DriversController,
    VehiclesController,
    RoutesController,
    RouteStopsController,
    StudentTransportController,
  ],
  providers: [DriversService, VehiclesService, RoutesService, RouteStopsService, StudentTransportService],
})
export class TransportModule {}
