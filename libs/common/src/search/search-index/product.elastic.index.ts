import { Inject, Injectable } from '@nestjs/common';
import { Order } from 'apps/orders/src/schemas/order.schema';
import { orderIndex } from '../constant/order.elastic';
import { SearchServiceInterface } from '../interface/search-service.interface';

/*
These methods are paramount important and indispensable when we need to create and update index in 
the Elasticsearch after inserting or updating events triggered with product collection. 
Indeed, after creating or updating the product via those two APIs that we have introduced in 
the previous section, we also need to update our product index in the Elasticsearch.

This implement actually can be invoked into the product service and do some business logic after a product inserting or updating. But there is some disadvantage that we have mentioned in the previous section.

*/
@Injectable()
export class OrderElasticIndex {
  constructor(
    @Inject('SearchServiceInterface')
    private readonly searchService: SearchServiceInterface<any>,
  ) {}

  public async insertOrderDocument(order: Order): Promise<any> {
    const data = this.orderDocument(order);
    return await this.searchService.insertIndex(data);
  }

  public async updateOrderDocument(order: Order): Promise<any> {
    const data = this.orderDocument(order);
    await this.deleteOrderDocument(order.id);
    return await this.searchService.insertIndex(data);
  }

  private async deleteOrderDocument(prodId: number): Promise<any> {
    const data = {
      index: orderIndex._index,
      type: orderIndex._type,
      id: prodId.toString(),
    };
    return await this.searchService.deleteDocument(data);
  }

  private bulkIndex(orderId: number): any {
    return {
      _index: orderIndex._index,
      _type: orderIndex._type,
      _id: orderId,
    };
  }

  private orderDocument(order: Order): any {
    const bulk = [];
    bulk.push({
      index: this.bulkIndex(order.id),
    });
    bulk.push(order);
    return {
      body: bulk,
      index: orderIndex._index,
      type: orderIndex._type,
    };
  }
}
