import { UserRole } from '@prisma/client';
import { AvailabilitySlotsController } from './availability-slots.controller';

describe('AvailabilitySlotsController', () => {
  const availabilitySlotsServiceMock = {
    createMine: jest.fn(),
    listMine: jest.fn(),
    updateMine: jest.fn(),
    removeMine: jest.fn(),
    listForTherapistProfile: jest.fn(),
  };

  const controller = new AvailabilitySlotsController(
    availabilitySlotsServiceMock as never,
  );
  const THERAPIST_USER = {
    sub: 'therapist-user-1',
    email: 't@mail.com',
    role: UserRole.PHYSIOTHERAPIST,
  };
  const REQ = { user: THERAPIST_USER };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates createMine with req.user and dto', async () => {
    const dto = {
      slotDate: '2099-06-01',
      startTime: '2099-06-01T09:00:00.000Z',
      endTime: '2099-06-01T10:00:00.000Z',
    };
    availabilitySlotsServiceMock.createMine.mockResolvedValue({ id: 'slot-1' });

    await controller.createMine(REQ as never, dto as never);

    expect(availabilitySlotsServiceMock.createMine).toHaveBeenCalledWith(
      THERAPIST_USER,
      dto,
    );
  });

  it('delegates listMine with req.user and query', async () => {
    const query = { page: 2, limit: 5, from: '2099-06-01' };
    availabilitySlotsServiceMock.listMine.mockResolvedValue([{ id: 'slot-1' }]);

    await controller.listMine(REQ as never, query as never);

    expect(availabilitySlotsServiceMock.listMine).toHaveBeenCalledWith(
      THERAPIST_USER,
      query,
    );
  });

  it('delegates updateMine with req.user, slotId, and dto', async () => {
    const dto = { isAvailable: false };
    availabilitySlotsServiceMock.updateMine.mockResolvedValue({ id: 'slot-1' });

    await controller.updateMine(REQ as never, 'slot-1', dto as never);

    expect(availabilitySlotsServiceMock.updateMine).toHaveBeenCalledWith(
      THERAPIST_USER,
      'slot-1',
      dto,
    );
  });

  it('delegates removeMine with req.user and slotId', async () => {
    availabilitySlotsServiceMock.removeMine.mockResolvedValue({
      message: 'Availability slot deleted.',
    });

    await controller.removeMine(REQ as never, 'slot-1');

    expect(availabilitySlotsServiceMock.removeMine).toHaveBeenCalledWith(
      THERAPIST_USER,
      'slot-1',
    );
  });

  it('delegates listForProfile with profileId and query', async () => {
    const query = { page: 1, limit: 10, to: '2099-06-30' };
    availabilitySlotsServiceMock.listForTherapistProfile.mockResolvedValue([
      { id: 'slot-1' },
    ]);

    await controller.listForProfile('profile-1', query as never);

    expect(
      availabilitySlotsServiceMock.listForTherapistProfile,
    ).toHaveBeenCalledWith('profile-1', query);
  });
});
