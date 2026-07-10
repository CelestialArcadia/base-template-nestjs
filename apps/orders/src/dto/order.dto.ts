import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class OrderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsPositive()
  quantity: number;

  /**
   * Minor units (cents), e.g. 1250 = €12.50. Integer, never a float — binary
   * floating point cannot represent 0.10, and money that rounds is money lost.
   */
  @IsInt()
  @IsPositive()
  unitPriceCents: number;
}
