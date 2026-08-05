import { IsOptional, IsUUID } from 'class-validator';

// routeStopId omitted or null unassigns the student from transport.
export class AssignTransportDto {
  @IsOptional()
  @IsUUID()
  routeStopId?: string | null;
}
