import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiResponseHelper } from '@api/common/helpers/api-response.helper';
import { ParamToBodyInterceptor } from '@api/common/interceptors/param-to-body.interceptor';
import { RequestToBodyInterceptor } from '@api/common/interceptors/request-to-body.interceptor';
import { AuthRequest } from '@api/common/types/auth.request';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { DeleteTicketDto } from './dto/delete-ticket.dto';
import { FindTicketsDto } from './dto/find-tickets.dto';
import { ValidateTicketDto } from './dto/validate-ticket.dto';
import { Ticket } from './ticket.entity';
import { TicketService } from './ticket.service';
import { TicketPaginatedResult } from './ticket.types';

@ApiResponse(ApiResponseHelper.unauthorized())
@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @ApiOperation({ description: `Find tickets` })
  @ApiResponse(ApiResponseHelper.success(TicketPaginatedResult))
  @ApiResponse(ApiResponseHelper.validationErrors(['Validation failed (uuid is expected)']))
  @UseInterceptors(ClassSerializerInterceptor)
  @HttpCode(HttpStatus.OK)
  @Get()
  async findAllPaginated(
    @Query() searchParams: FindTicketsDto,
    @Req() req: AuthRequest,
  ): Promise<TicketPaginatedResult> {
    return this.ticketService.findAllPaginated(searchParams, req.ticketProvider.id);
  }

  @ApiOperation({ description: `Get ticket by uuid` })
  @ApiResponse(ApiResponseHelper.success(Ticket))
  @ApiResponse(ApiResponseHelper.notFound('Ticket not found'))
  @ApiResponse(ApiResponseHelper.validationErrors(['Validation failed (uuid is expected)']))
  @UseInterceptors(ClassSerializerInterceptor)
  @Get(':uuid')
  async findOne(@Param('uuid', ParseUUIDPipe) uuid: string, @Req() req: AuthRequest): Promise<Ticket> {
    const ticket = await this.ticketService.findByUuidAndProvider(uuid, req.ticketProvider.id);

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  @ApiOperation({ description: `Validate ticket by uuid` })
  @ApiResponse(ApiResponseHelper.success(Ticket))
  @ApiResponse(ApiResponseHelper.notFound('Ticket is already used or not created yet'))
  @ApiResponse(ApiResponseHelper.validationErrors(['Validation failed (uuid is expected)']))
  @UseInterceptors(
    ClassSerializerInterceptor,
    new RequestToBodyInterceptor('ticketProvider', 'ticketProvider'),
    new ParamToBodyInterceptor('uuid', 'uuid'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('validate')
  async validate(@Body() body: ValidateTicketDto): Promise<Ticket> {
    const validatedTicket = await this.ticketService.validate(body);

    if (!validatedTicket) {
      throw new NotFoundException('Ticket not found');
    }

    return validatedTicket;
  }

  @ApiOperation({ description: `Create a new ticket` })
  @ApiResponse(ApiResponseHelper.success(Ticket, HttpStatus.CREATED))
  @ApiResponse(ApiResponseHelper.validationErrors(['Validation failed (uuid is expected)']))
  @UseInterceptors(
    ClassSerializerInterceptor,
    new RequestToBodyInterceptor('ticketProvider', 'ticketProvider'),
    new RequestToBodyInterceptor('ticketProvider', 'user.ticketProvider'),
  )
  @Post()
  async create(@Body() body: CreateTicketDto): Promise<Ticket> {
    return this.ticketService.create(body);
  }

  @ApiOperation({ description: `Delete a ticket` })
  @ApiResponse(ApiResponseHelper.success(Ticket, HttpStatus.OK))
  @ApiResponse(ApiResponseHelper.validationErrors(['Validation failed (uuid is expected)']))
  @UseInterceptors(
    ClassSerializerInterceptor,
    new RequestToBodyInterceptor('ticketProvider', 'ticketProvider'),
    new ParamToBodyInterceptor('uuid', 'uuid'),
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':uuid')
  async delete(@Body() body: DeleteTicketDto): Promise<void> {
    await this.ticketService.delete(body);
  }
}
