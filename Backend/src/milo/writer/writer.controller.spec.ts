import { Test, TestingModule } from '@nestjs/testing';
import { WriterController } from './writer.controller';
import { WriterService } from './writer.service';
import type { WriteDescriptionDto } from './dto/write-description.dto';

describe('WriterController', () => {
  let controller: WriterController;
  let writeMock: jest.Mock;

  beforeEach(async () => {
    writeMock = jest
      .fn()
      .mockReturnValue({ text: 'texte généré', fallback: false });
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WriterController],
      providers: [{ provide: WriterService, useValue: { write: writeMock } }],
    }).compile();
    controller = module.get(WriterController);
  });

  it('délègue au service et renvoie son résultat tel quel', () => {
    const dto: WriteDescriptionDto = {
      locale: 'fr',
      type: 'APPARTEMENT',
      city: 'Dakar',
    };
    const result = controller.writeDescription(dto);
    expect(writeMock).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ text: 'texte généré', fallback: false });
  });
});
