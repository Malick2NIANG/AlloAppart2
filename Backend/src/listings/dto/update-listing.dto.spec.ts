import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateListingDto } from './update-listing.dto';

async function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateListingDto, payload);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('UpdateListingDto — meublé (furnished)', () => {
  it('toujours facultatif en modification, même pour un type résidentiel en LOCATION (une annonce ancienne à `null` reste modifiable)', async () => {
    expect(
      await errorsFor({
        type: 'APPARTEMENT',
        transactionType: 'LOCATION',
        title: 'Nouveau titre',
      }),
    ).not.toContain('furnished');
  });

  it('accepté si fourni (true ou false)', async () => {
    expect(
      await errorsFor({ type: 'APPARTEMENT', furnished: true }),
    ).not.toContain('furnished');
    expect(await errorsFor({ type: 'VILLA', furnished: false })).not.toContain(
      'furnished',
    );
  });
});
