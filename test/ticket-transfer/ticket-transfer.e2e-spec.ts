import { HttpStatus, INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppBootstrapManager } from '@src/app-bootstrap.manager';
import { UserFactory } from '@src/database/factories/user.factory';
import { AppDataSource } from '@src/config/datasource';
import { TicketProviderFactory } from '@src/database/factories/ticket-provider.factory';
import { TestHelper } from '@test/helpers/test.helper';
import { TicketFactory } from '@src/database/factories/ticket.factory';
import { TicketTransfer } from '@src/ticket-transfer/ticket-transfer.entity';
import { TicketTransferFactory } from '@src/database/factories/ticket-transfer.factory';
import { ProducerService } from '@src/producer/producer.service';
import { UserStatus } from '@src/user/user.types';
import { TicketStatus } from '@src/ticket/ticket.types';
import { TicketTransferMessage } from '@src/ticket-transfer/messages/ticket-transfer.message';
import { TicketTransferEventPattern } from '@src/ticket-transfer/ticket-transfer.types';

describe('Ticket-transfer (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let testHelper: TestHelper;
  let producerService: ProducerService;

  beforeAll(async () => {
    const testingModuleBuilder = AppBootstrapManager.getTestingModuleBuilder();
    moduleFixture = await testingModuleBuilder.compile();
    producerService = moduleFixture.get<ProducerService>(ProducerService);
    jest.spyOn(producerService, 'emit').mockImplementation(async (): Promise<any> => null);

    app = moduleFixture.createNestApplication();
    AppBootstrapManager.setAppDefaults(app);
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

  it('checks that endpoints are protected', () => {
    request(app.getHttpServer()).get('/api/v1/ticket-transfers/1').expect(HttpStatus.UNAUTHORIZED);
    request(app.getHttpServer()).post('/api/v1/ticket-transfers').expect(HttpStatus.UNAUTHORIZED);
  });

  it('should post a ticket transfer and get validation errors', async () => {
    const ticketProvider = await TicketProviderFactory.create();
    const token = await testHelper.createTicketProviderToken(ticketProvider.id);

    await request(app.getHttpServer())
      .post('/api/v1/ticket-transfers')
      .set('Accept', 'application/json')
      .set('Api-Key', token)
      .then((response) => {
        expect(response.body.message).toEqual(
          expect.arrayContaining([
            'userUuid must be a UUID',
            'User not found',
            'ticketUuid must be a UUID',
            'Ticket not found',
          ]),
        );
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      });
  });

  it(`should not create a new ticket transfer if receiving user is not yet active`, async () => {
    const ticketProvider = await TicketProviderFactory.create();
    const token = await testHelper.createTicketProviderToken(ticketProvider.id);
    const userFrom = await UserFactory.create({ ticketProviderId: ticketProvider.id });
    const userTo = await UserFactory.create({ ticketProviderId: ticketProvider.id, status: UserStatus.Creating });
    const ticket = await TicketFactory.create({ ticketProviderId: ticketProvider.id, userId: userFrom.id });

    await request(app.getHttpServer())
      .post('/api/v1/ticket-transfers')
      .send({
        userUuid: userTo.uuid,
        ticketUuid: ticket.uuid,
      })
      .set('Accept', 'application/json')
      .set('Api-Key', token)
      .then(async (response) => {
        expect(response.body.message).toEqual(expect.arrayContaining(['User is not yet active']));
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      });
  });

  it(`should not create a new ticket transfer if transfering ticket is not yet active`, async () => {
    const ticketProvider = await TicketProviderFactory.create();
    const token = await testHelper.createTicketProviderToken(ticketProvider.id);
    const userFrom = await UserFactory.create({ ticketProviderId: ticketProvider.id });
    const userTo = await UserFactory.create({ ticketProviderId: ticketProvider.id });
    const ticket = await TicketFactory.create({
      ticketProviderId: ticketProvider.id,
      userId: userFrom.id,
      status: TicketStatus.Creating,
    });

    await request(app.getHttpServer())
      .post('/api/v1/ticket-transfers')
      .send({
        userUuid: userTo.uuid,
        ticketUuid: ticket.uuid,
      })
      .set('Accept', 'application/json')
      .set('Api-Key', token)
      .then(async (response) => {
        expect(response.body.message).toEqual(expect.arrayContaining(['Ticket is not yet active']));
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      });
  });

  it(`should not create a new ticket transfer if receiver is the current owner of the ticket`, async () => {
    const ticketProvider = await TicketProviderFactory.create();
    const token = await testHelper.createTicketProviderToken(ticketProvider.id);
    const currentOwner = await UserFactory.create({ ticketProviderId: ticketProvider.id });
    const ticket = await TicketFactory.create({
      ticketProviderId: ticketProvider.id,
      userId: currentOwner.id,
      status: TicketStatus.Active,
    });

    await request(app.getHttpServer())
      .post('/api/v1/ticket-transfers')
      .send({
        userUuid: currentOwner.uuid,
        ticketUuid: ticket.uuid,
      })
      .set('Accept', 'application/json')
      .set('Api-Key', token)
      .then(async (response) => {
        expect(response.body.message).toEqual(
          expect.arrayContaining(['The receiving user is already an owner of the ticket']),
        );
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      });
  });

  it(`should successfully create a new ticket transfer`, async () => {
    const ticketProvider = await TicketProviderFactory.create();
    const token = await testHelper.createTicketProviderToken(ticketProvider.id);
    const userFrom = await UserFactory.create({ ticketProviderId: ticketProvider.id });
    const userTo = await UserFactory.create({ ticketProviderId: ticketProvider.id });
    const ticket = await TicketFactory.create({ ticketProviderId: ticketProvider.id, userId: userFrom.id });

    await request(app.getHttpServer())
      .post('/api/v1/ticket-transfers')
      .send({
        userUuid: userTo.uuid,
        ticketUuid: ticket.uuid,
      })
      .set('Accept', 'application/json')
      .set('Api-Key', token)
      .then(async (response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            uuid: expect.any(String),
            createdAt: expect.any(String),
          }),
        );
        expect(response.status).toBe(HttpStatus.CREATED);

        const ticketTransfer = await AppDataSource.manager
          .getRepository(TicketTransfer)
          .findOne({ where: { uuid: response.body.uuid }, relations: ['userFrom', 'userTo', 'ticket'] });

        expect(ticketTransfer.userIdFrom).toEqual(userFrom.id);
        expect(ticketTransfer.userIdTo).toEqual(userTo.id);
        expect(ticketTransfer.ticketId).toEqual(ticket.id);
        expect(ticketTransfer.ticketProviderId).toEqual(ticketProvider.id);
        expect(ticketTransfer.userFrom).not.toBeNull();
        expect(ticketTransfer.userTo).not.toBeNull();
        expect(ticketTransfer.ticket).not.toBeNull();

        const expectedMessage = new TicketTransferMessage({
          transfer: expect.objectContaining({
            uuid: ticketTransfer.uuid,
            userFrom: expect.objectContaining({
              uuid: ticketTransfer.userFrom.uuid,
            }),
            userTo: expect.objectContaining({
              uuid: ticketTransfer.userTo.uuid,
            }),
            ticket: expect.objectContaining({
              uuid: ticketTransfer.ticket.uuid,
              tokenId: ticketTransfer.ticket.tokenId,
            }),
          }),
        });

        expect(producerService.emit).toHaveBeenCalledWith(TicketTransferEventPattern.TicketTransfer, {
          ...expectedMessage,
          operationUuid: expect.any(String),
        });
      });
  });

  it(`should not get ticket transfer by uuid, because it belongs to another ticket provider`, async () => {
    const ticketProvider = await TicketProviderFactory.create();
    const token = await testHelper.createTicketProviderToken(ticketProvider.id);
    const ticketProviderSecond = await TicketProviderFactory.create();
    const userFrom = await UserFactory.create({ ticketProviderId: ticketProviderSecond.id });
    const userTo = await UserFactory.create({ ticketProviderId: ticketProviderSecond.id });
    const ticket = await TicketFactory.create({ ticketProviderId: ticketProviderSecond.id, userId: userFrom.id });
    const ticketTransfer = await TicketTransferFactory.create({
      ticketProviderId: ticketProviderSecond.id,
      userIdFrom: userFrom.id,
      userIdTo: userTo.id,
      ticketId: ticket.id,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/ticket-transfers/${ticketTransfer.uuid}`)
      .set('Accept', 'application/json')
      .set('Api-Key', token)
      .then((response) => {
        expect(response.body.message).toEqual('Ticket transfer not found');
        expect(response.status).toBe(HttpStatus.NOT_FOUND);
      });
  });

  it(`should get ticket transfer by uuid successfully`, async () => {
    const ticketProvider = await TicketProviderFactory.create();
    const token = await testHelper.createTicketProviderToken(ticketProvider.id);
    const userFrom = await UserFactory.create({ ticketProviderId: ticketProvider.id });
    const userTo = await UserFactory.create({ ticketProviderId: ticketProvider.id });
    const ticket = await TicketFactory.create({ ticketProviderId: ticketProvider.id, userId: userFrom.id });
    const ticketTransfer = await TicketTransferFactory.create({
      ticketProviderId: ticketProvider.id,
      userIdFrom: userFrom.id,
      userIdTo: userTo.id,
      ticketId: ticket.id,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/ticket-transfers/${ticketTransfer.uuid}`)
      .set('Accept', 'application/json')
      .set('Api-Key', token)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            uuid: ticketTransfer.uuid,
            createdAt: expect.any(String),
            status: ticketTransfer.status,
          }),
        );
        expect(response.status).toBe(HttpStatus.OK);
      });
  });
});
