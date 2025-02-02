import { BaseSchema } from '@app/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema()
export class Order extends BaseSchema {
  @ApiProperty({ example: 'Red Trainers', description: 'The product name' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({
    example: '50',
    description: 'The quantity of the product',
  })
  @Prop({ required: true })
  quantity: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
