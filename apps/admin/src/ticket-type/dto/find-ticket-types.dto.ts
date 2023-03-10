import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min, Validate, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { EventExistsValidator } from '../validators/event-exists.validator';
import { TicketProviderExistsValidator } from '@admin/ticket-provider/validators/ticket-provider-exists.validator';
import { CursorFilterDto } from '@app/common/pagination/cursor-filter.dto';
import { TicketType } from '@app/ticket-type/ticket-type.entity';

export class FindTicketTypesDto extends CursorFilterDto {
  @ApiProperty({
    example: '5e9d96f9-7103-4b8b-b3c6-c37608e38305',
    required: true,
    description: `Event uuid`,
  })
  @IsUUID()
  @IsOptional()
  @ValidateIf((o) => o.eventUuid)
  @Validate(EventExistsValidator)
  eventUuid: string;

  @ApiProperty({ example: 'createdAt', enum: ['createdAt'], required: false })
  @IsOptional()
  @IsIn(['createdAt'])
  orderParam: keyof TicketType = 'createdAt';

  @ApiProperty({ example: 10, minimum: 1, maximum: 50, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit = 50;

  @ApiProperty({
    example: 1,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Validate(TicketProviderExistsValidator)
  ticketProviderId: number;
}
