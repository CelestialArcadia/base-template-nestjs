import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { OrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('place-order')
  placeOrder(@Body() order: OrderDto) {
    return this.ordersService.placeOrder(order);
  }

  @Get('/search')
  public async search(@Query() query: any): Promise<any> {
    return await this.ordersService.search(query.q);
  }
}
