import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import { AppBootstrapManager } from '@src/app-bootstrap.manager';
import { AppDataSource } from '@src/config/datasource';
import { TestHelper } from '@test/helpers/test.helper';
import { ProducerService } from '@src/producer/producer.service';
import { InternalServerErrorExceptionsFilter } from '@src/common/filters/internal-server-error-exceptions.filter';
import { OutboxFactory } from '@src/database/factories/outbox.factory';
import { TicketEventPattern } from '@src/ticket/ticket.types';
import { OutboxStatus } from '@src/outbox/outbox.types';
import { Outbox } from '@src/outbox/outbox.entity';

describe('Producer (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let testHelper: TestHelper;
  let producerService: ProducerService;

  beforeAll(async () => {
    const testingModuleBuilder = AppBootstrapManager.getTestingModuleBuilder();
    moduleFixture = await testingModuleBuilder.compile();

    producerService = moduleFixture.get<ProducerService>(ProducerService);
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new InternalServerErrorExceptionsFilter());
    app.enableShutdownHooks();

    jest.spyOn(producerService, 'sendBatch');
    testHelper = new TestHelper(moduleFixture, jest);
    await AppDataSource.initialize();
    await app.init();
  });

  afterAll(async () => {
    jest.resetAllMocks().restoreAllMocks();
    await AppDataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await testHelper.cleanDatabase();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should read empty outbox table and send nothing', async () => {
    const messages = await producerService.produceMessages();

    expect(messages).toEqual([]);
  });

  it('should read outbox table with 5 records and send them in 1 go', async () => {
    const [firstItem, secondItem] = await OutboxFactory.createMany(2, {
      eventName: TicketEventPattern.TicketCreate,
      payload: JSON.stringify({ attribute: faker.random.word() }),
      status: OutboxStatus.Created,
    });
    const messages = await producerService.produceMessages();

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          topic: firstItem.eventName,
          messages: [
            {
              value: firstItem.payload,
            },
          ],
        }),
        expect.objectContaining({
          topic: secondItem.eventName,
          messages: [
            {
              value: secondItem.payload,
            },
          ],
        }),
      ]),
    );

    expect(producerService.sendBatch).toHaveBeenCalledWith(messages);

    const [outboxRecordOne, ourboxRecordTwo] = await AppDataSource.manager.getRepository(Outbox).find({});

    expect(outboxRecordOne.status).toBe(OutboxStatus.Sent);
    expect(outboxRecordOne.sentAt).not.toBeNull();
    expect(ourboxRecordTwo.status).toBe(OutboxStatus.Sent);
    expect(ourboxRecordTwo.sentAt).not.toBeNull();
  });
});
