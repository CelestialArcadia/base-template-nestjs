import { Body, Controller, Post } from '@nestjs/common';
import { OrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('place-order')
  placeOrder(@Body() order: OrderDto) {
    return this.ordersService.placeOrder(order);
  }
}
