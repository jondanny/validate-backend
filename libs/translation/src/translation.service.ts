import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { QueryRunner } from 'typeorm';
import { Translation } from './translation.entity';
import { EntityAttribute, EntityName, Locale, Translatable } from './translation.types';

@Injectable()
export class TranslationService {
  async saveTranslations(
    queryRunner: QueryRunner,
    entityName: EntityName,
    entityId: number,
    entityAttributes: EntityAttribute[],
    locale: Locale,
  ): Promise<Translation[]> {
    const insertResults = await Promise.all(
      entityAttributes.map((item) =>
        queryRunner.manager
          .createQueryBuilder(Translation, 'translation')
          .insert()
          .into(Translation)
          .values({
            entityName,
            entityId,
            entityAttribute: item.name as any,
            text: item.value,
            locale,
          })
          .orUpdate(['text'])
          .execute(),
      ),
    );

    return insertResults.map((insertResult) => plainToInstance(Translation, insertResult.generatedMaps.at(0)));
  }

  static mapEntity<T extends Translatable>(entity: T, locale: Locale) {
    if (entity?.translations.length === 0) {
      return entity;
    }

    const translations = entity.translations
      .filter((item) => item.locale === locale && item.entityName === entity.constructor.name)
      .reduce((acc, item) => {
        acc[item.entityAttribute] = item.text;

        return acc;
      }, {});

    return Object.assign(entity, translations || {});
  }
}
