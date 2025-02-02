import { IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class OrderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsPositive()
  quantity: number;
}
