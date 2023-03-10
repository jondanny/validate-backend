import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '@api/user/user.module';
import { TicketUserExistsAndActiveValidator } from './validators/ticket-user-exists-and-active.validator';
import { TicketIsValidatableValidator } from './validators/ticket-is-validatable.validator';
import { TicketIsDeletableValidator } from './validators/ticket-is-deletable.validator';
import { RedisModule } from '@app/redis/redis.module';
import { TicketTypeModule } from '@api/ticket-type/ticket-type.module';
import { TicketRepository } from './ticket.repository';
import { EventModule } from '@api/event/event.module';
import { Ticket } from '@app/ticket/ticket.entity';
import { OutboxModule } from '@app/outbox/outbox.module';
import { TicketProviderEncryptionKeyModule } from '@app/ticket-provider-encryption-key/ticket-provider-encryption-key.module';
import { TicketModule as CommonTicketModule } from '@app/ticket/ticket.module';
import { TicketSubscriber } from '@app/ticket/ticket.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket]),
    UserModule,
    EventModule,
    RedisModule,
    OutboxModule,
    TicketTypeModule,
    TicketProviderEncryptionKeyModule,
    CommonTicketModule,
  ],
  providers: [
    TicketService,
    TicketRepository,
    TicketUserExistsAndActiveValidator,
    TicketIsValidatableValidator,
    TicketIsDeletableValidator,
    TicketSubscriber
  ],
  controllers: [TicketController],
  exports: [TicketService],
})
export class TicketModule {}
