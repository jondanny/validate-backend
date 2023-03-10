import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TicketProviderEncryptionKey } from '@app/ticket-provider-encryption-key/ticket-provider-encryption-key.entity';
import { ApiResponseHelper } from '@app/common/helpers/api-response.helper';
import { TicketProviderEncryptionKeyService } from '@app/ticket-provider-encryption-key/ticket-provider-encryption-key.service';
import { AuthRequest } from '@app/common/types/auth.request';
import { RequestToBodyInterceptor } from '@app/common/interceptors/request-to-body.interceptor';

@ApiResponse(ApiResponseHelper.unauthorized())
@Controller('ticket-provider-encryption-keys')
export class TicketProviderEncryptionKeyController {
  constructor(private readonly ticketProviderEncryptionKeyService: TicketProviderEncryptionKeyService) {}

  @ApiOperation({ description: `Get encryption key by version` })
  @ApiResponse(ApiResponseHelper.success(TicketProviderEncryptionKey))
  @ApiResponse(ApiResponseHelper.notFound('Encryption key not found'))
  @ApiResponse(ApiResponseHelper.validationErrors(['Validation failed (integer is expected)']))
  @UseInterceptors(ClassSerializerInterceptor)
  @Get(':version')
  async findOne(
    @Param('version', ParseIntPipe) version: number,
    @Req() req: AuthRequest,
  ): Promise<TicketProviderEncryptionKey> {
    const encryptionKey = await this.ticketProviderEncryptionKeyService.findByVersion(version, req.ticketProvider.id);

    if (!encryptionKey) {
      throw new NotFoundException('Encryption key not found');
    }

    return encryptionKey;
  }

  @ApiOperation({ description: `Create new encryption key` })
  @ApiResponse(ApiResponseHelper.success(TicketProviderEncryptionKey, HttpStatus.CREATED))
  @UseInterceptors(ClassSerializerInterceptor, new RequestToBodyInterceptor('ticketProvider', 'ticketProvider'))
  @Post()
  async create(@Req() req: AuthRequest): Promise<TicketProviderEncryptionKey> {
    return this.ticketProviderEncryptionKeyService.create(req.ticketProvider.id);
  }
}
