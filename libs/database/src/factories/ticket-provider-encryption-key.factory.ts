import { faker } from '@faker-js/faker';
import { AppDataSource } from '@app/common/configs/datasource';
import { TicketProviderEncryptionKey } from '@app/ticket-provider-encryption-key/ticket-provider-encryption-key.entity';
import { SECRET_KEY_LENGTH } from '@app/ticket-provider-encryption-key/ticket-provider-encryption.types';

export class TicketProviderEncryptionKeyFactory {
  static async create(data?: Partial<TicketProviderEncryptionKey>) {
    const ticketProviderEncryptionKey = new TicketProviderEncryptionKey();
    ticketProviderEncryptionKey.secretKey = faker.random.alphaNumeric(SECRET_KEY_LENGTH);

    return AppDataSource.manager
      .getRepository(TicketProviderEncryptionKey)
      .save({ ...ticketProviderEncryptionKey, ...data });
  }
}
