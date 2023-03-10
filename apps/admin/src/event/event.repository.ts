import { Injectable } from '@nestjs/common';
import { buildPaginator, PagingResult } from 'typeorm-cursor-pagination';
import { FindEventsDto } from './dto/find-events.dto';
import { EventRepository as CommonRepository } from '@app/event/event.repository';
import { Event } from '@app/event/event.entity';
import { FindOptionsWhere } from 'typeorm';
import { EntityName } from '@app/translation/translation.types';

@Injectable()
export class EventRepository extends CommonRepository {
  async getPaginatedQueryBuilder(searchParams: FindEventsDto): Promise<PagingResult<Event>> {
    const queryBuilder = this.createQueryBuilder('event').leftJoinAndSelect(
      'event.translations',
      'translations',
      'translations.entity_name = :entityName AND translations.entity_id = event.id',
      { entityName: EntityName.Event },
    );

    if (searchParams.ticketProviderId) {
      queryBuilder.where({
        ticketProviderId: searchParams.ticketProviderId,
      });
    }

    const paginator = buildPaginator({
      entity: Event,
      paginationKeys: ['id', searchParams.orderParam],
      query: {
        limit: searchParams.limit,
        order: searchParams.orderType,
        afterCursor: searchParams.afterCursor,
        beforeCursor: searchParams.beforeCursor,
      },
    });

    return paginator.paginate(queryBuilder);
  }

  async createOrInsert(
    name: string,
    ticketProviderId: number,
    description?: string,
    imageUrl?: string,
  ): Promise<Event> {
    const existingEvent = await this.findOneBy({ name, ticketProviderId });
    const data = { name, ticketProviderId };

    if (!existingEvent) {
      description && (data['description'] = description);
      imageUrl && (data['imageUrl'] = imageUrl);

      return this.save({ ...data });
    }

    return existingEvent;
  }

  async findOneBy(where: FindOptionsWhere<Event> | FindOptionsWhere<Event>[]): Promise<Event> {
    return this.createQueryBuilder('event')
      .where(where)
      .leftJoinAndSelect(
        'event.translations',
        'translations',
        'translations.entity_name = :entityName AND translations.entity_id = event.id',
        { entityName: EntityName.Event },
      )
      .getOne();
  }
}
